/**
 * DriveService.js — Google Drive folder resolution, upload, view links, metadata.
 *
 * Rules:
 * - Document_Categories.driveFolderKey maps to a Drive sub-folder created lazily under DRIVE_ROOT_FOLDER_ID.
 * - Binaries live in Drive; Sheets store metadata + fileRef JSON.
 * - Only this file touches DriveApp.
 */
var DriveService = (function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /** Read all rows from a sheet with optional filter. */
  function readAll(sheetName, filter) {
    var sheet = Repository.getSheet(sheetName);
    var columns = Schema.columnsOf(sheetName);
    var lastRow = sheet.getLastRow();
    if (lastRow <= 1) { return []; }
    var values = sheet.getRange(2, 1, lastRow - 1, columns.length).getValues();
    var rows = [];
    for (var i = 0; i < values.length; i++) {
      var rec = Repository.fromRow(sheetName, values[i]);
      if (filter) {
        var match = Object.keys(filter).every(function (k) {
          return String(rec[k]) === String(filter[k]);
        });
        if (!match) { continue; }
      }
      rows.push(rec);
    }
    return rows;
  }

  /** Find a record by unique key fields. */
  function findByUnique(sheetName, uniqueKey) {
    var result = Repository.countBy(sheetName, uniqueKey);
    if (!result.exists) { return null; }
    var sheet = Repository.getSheet(sheetName);
    var columns = Schema.columnsOf(sheetName);
    var lastRow = sheet.getLastRow();
    if (lastRow <= 1) { return null; }
    var values = sheet.getRange(2, 1, lastRow - 1, columns.length).getValues();
    for (var i = 0; i < values.length; i++) {
      var rec = Repository.fromRow(sheetName, values[i]);
      var match = Object.keys(uniqueKey).every(function (k) {
        return String(rec[k]) === String(uniqueKey[k]);
      });
      if (match) { return rec; }
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // Folder resolution
  // ---------------------------------------------------------------------------

  /** Cache for resolved folder IDs (per execution). */
  var _folderCache = {};

  /**
   * Get or create the root Drive folder.
   * @return {GoogleAppsScript.Drive.Folder}
   */
  function getRootFolder() {
    var rootId = CONFIG.str('DRIVE_ROOT_FOLDER_ID');
    if (!rootId) { throw new Error('DRIVE_ROOT_FOLDER_ID not configured'); }
    var folder = DriveApp.getFolderById(rootId);
    if (!folder) { throw new Error('Root Drive folder not found: ' + rootId); }
    return folder;
  }

  /**
   * Resolve a Drive sub-folder by driveFolderKey from Document_Categories.
   * Creates the folder lazily if it doesn't exist.
   * @param {string} driveFolderKey  e.g. 'NOTICES', 'MEETINGS', 'COMPLAINTS'
   * @return {{ folderId: string, folder: GoogleAppsScript.Drive.Folder }}
   */
  function resolveFolder(driveFolderKey) {
    if (!driveFolderKey) {
      var root = getRootFolder();
      return { folderId: root.getId(), folder: root };
    }

    // Check execution cache
    if (_folderCache[driveFolderKey]) {
      return _folderCache[driveFolderKey];
    }

    var root = getRootFolder();

    // Search for existing sub-folder by name
    var folders = root.getFoldersByName(driveFolderKey);
    if (folders.hasNext()) {
      var folder = folders.next();
      var result = { folderId: folder.getId(), folder: folder };
      _folderCache[driveFolderKey] = result;
      return result;
    }

    // Create the folder
    var newFolder = root.createFolder(driveFolderKey);
    var result = { folderId: newFolder.getId(), folder: newFolder };
    _folderCache[driveFolderKey] = result;
    return result;
  }

  /**
   * Resolve folder for a document category (looks up Document_Categories.driveFolderKey).
   * @param {string} categoryId
   * @return {{ folderId: string, folder: GoogleAppsScript.Drive.Folder }}
   */
  function resolveFolderForCategory(categoryId) {
    if (!categoryId) {
      return resolveFolder(null);
    }

    var category = Repository.findById('Document_Categories', categoryId);
    if (!category || !category.driveFolderKey) {
      return resolveFolder(null);
    }

    return resolveFolder(category.driveFolderKey);
  }

  // ---------------------------------------------------------------------------
  // Upload
  // ---------------------------------------------------------------------------

  /**
   * Upload a file to Drive.
   * @param {object} opts
   * @param {string} opts.fileName
   * @param {string} opts.mimeType
   * @param {string} opts.base64       base64-encoded file content
   * @param {string} [opts.folderId]   target folder ID (default: root)
   * @return {{ fileId: string, name: string, mimeType: string, size: number, url: string }}
   */
  function upload(opts) {
    if (!opts.fileName || !opts.base64) {
      throw new Error('fileName and base64 are required for upload');
    }

    var folder;
    if (opts.folderId) {
      folder = DriveApp.getFolderById(opts.folderId);
    } else {
      folder = getRootFolder();
    }

    // Decode base64 to blob
    var contentType = opts.mimeType || 'application/octet-stream';
    var blob = Utilities.newBlob(Utilities.base64Decode(opts.base64), contentType, opts.fileName);

    // Create the file
    var file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    return {
      fileId: file.getId(),
      name: file.getName(),
      mimeType: file.getMimeType(),
      size: file.getSize(),
      url: file.getUrl()
    };
  }

  /**
   * Update an existing file's content.
   * @param {string} fileId
   * @param {string} base64       base64-encoded new content
   * @param {string} [mimeType]
   * @return {{ fileId: string, name: string, mimeType: string, size: number, url: string }}
   */
  function updateFile(fileId, base64, mimeType) {
    var file = DriveApp.getFileById(fileId);
    if (!file) { throw new Error('File not found: ' + fileId); }

    var blob = Utilities.newBlob(Utilities.base64Decode(base64), mimeType || file.getMimeType(), file.getName());
    file.setContent(blob);

    return {
      fileId: file.getId(),
      name: file.getName(),
      mimeType: file.getMimeType(),
      size: file.getSize(),
      url: file.getUrl()
    };
  }

  // ---------------------------------------------------------------------------
  // Links & metadata
  // ---------------------------------------------------------------------------

  /**
   * Get a view-only link for a file.
   * @param {string} fileId
   * @return {string} URL
   */
  function getViewLink(fileId) {
    if (!fileId) { return ''; }
    var file = DriveApp.getFileById(fileId);
    if (!file) { return ''; }
    return file.getUrl();
  }

  /**
   * Get file metadata.
   * @param {string} fileId
   * @return {{ fileId: string, name: string, mimeType: string, size: number, url: string, created: string, updated: string }|null}
   */
  function getMetadata(fileId) {
    if (!fileId) { return null; }
    try {
      var file = DriveApp.getFileById(fileId);
      if (!file) { return null; }
      return {
        fileId: file.getId(),
        name: file.getName(),
        mimeType: file.getMimeType(),
        size: file.getSize(),
        url: file.getUrl(),
        created: file.getDateCreated().toISOString(),
        updated: file.getLastUpdated().toISOString()
      };
    } catch (e) {
      return null;
    }
  }

  /**
   * Delete a file (move to trash).
   * @param {string} fileId
   * @return {boolean}
   */
  function trashFile(fileId) {
    if (!fileId) { return false; }
    try {
      var file = DriveApp.getFileById(fileId);
      if (!file) { return false; }
      file.setTrashed(true);
      return true;
    } catch (e) {
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // Expose
  // ---------------------------------------------------------------------------

  return {
    getRootFolder: getRootFolder,
    resolveFolder: resolveFolder,
    resolveFolderForCategory: resolveFolderForCategory,
    upload: upload,
    updateFile: updateFile,
    getViewLink: getViewLink,
    getMetadata: getMetadata,
    trashFile: trashFile
  };
})();
