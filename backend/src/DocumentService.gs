/**
 * DocumentService.js — document metadata management with Google Drive file storage.
 *
 * Rules:
 * - Documents unique: linkedEntityType + linkedEntityId + title + versionNo.
 * - Sheets store metadata + fileRef JSON; binaries live in Drive.
 * - Document_Categories.driveFolderKey maps to a Drive sub-folder created lazily.
 * - documents.upload writes base64 to Drive and stores fileRef on the document row.
 * - documents.archive sets statusKey = ARCHIVED (never hard-delete).
 * - Document categories are configurable rows.
 * - Audit row written for create/update/archive/upload.
 */
var DocumentService = (function () {
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
      if (!rec[Schema.idColumnOf(sheetName)] && !rec[Schema.get(sheetName).idColumn]) { continue; }
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

  /** Generate a document number using Numbering_Config. */
  function generateDocumentNumber() {
    var sheet = Repository.getSheet('Numbering_Config');
    var columns = Schema.columnsOf('Numbering_Config');
    var lastRow = sheet.getLastRow();
    if (lastRow <= 1) { return 'DOC-' + Utils.now().replace(/[^0-9]/g, '').substring(0, 8); }
    var values = sheet.getRange(2, 1, lastRow - 1, columns.length).getValues();
    for (var i = 0; i < values.length; i++) {
      var rec = Repository.fromRow('Numbering_Config', values[i]);
      if (rec.docType === 'DOCUMENT') {
        var seq = Utils.toNumber(rec.nextSequence, 1);
        var padded = String(seq).padStart(Utils.toNumber(rec.sequenceLength, 4), '0');
        var fy = Utils.financialYear(new Date());
        var number = (rec.prefix || 'DOC') + '/' + fy + '/' + padded;
        Repository.withLock(function () {
          Repository.updateById('Numbering_Config', rec.numberingId, {
            nextSequence: String(seq + 1)
          }, { userId: 'SYSTEM' });
        }, 'document:numbering');
        return number;
      }
    }
    return 'DOC-' + Utils.now().replace(/[^0-9]/g, '').substring(0, 8);
  }

  // ---------------------------------------------------------------------------
  // CRUD
  // ---------------------------------------------------------------------------

  /**
   * List documents with pagination and filters.
   * @param {object} ctx
   * @return {{ ok: boolean, data: Array, page: object }}
   */
  function list(ctx) {
    var o = ctx.payload || {};
    var filter = {};
    if (o.categoryId) { filter.categoryId = o.categoryId; }
    if (o.linkedEntityType) { filter.linkedEntityType = o.linkedEntityType; }
    if (o.linkedEntityId) { filter.linkedEntityId = o.linkedEntityId; }
    if (o.statusKey) { filter.statusKey = o.statusKey; }
    // MEMBER_SELF: filter by user's flatId
    if (ctx.payload && ctx.payload.flatId) { filter.flatId = ctx.payload.flatId; }

    var docs = readAll('Documents', Object.keys(filter).length > 0 ? filter : null);

    // Filter out archived unless includeArchived is set
    if (!o.includeArchived) {
      docs = docs.filter(function (d) { return d.statusKey !== 'ARCHIVED'; });
    }

    docs.sort(function (a, b) { return (b.createdAt || '').localeCompare(a.createdAt || ''); });

    var page = Math.max(1, parseInt(o.page, 10) || 1);
    var pageSize = Math.min(100, Math.max(1, parseInt(o.pageSize, 10) || 25));
    var total = docs.length;
    var start = (page - 1) * pageSize;
    var paged = docs.slice(start, start + pageSize);

    return {
      ok: true,
      data: paged,
      page: {
        page: page,
        pageSize: pageSize,
        total: total,
        totalPages: Math.ceil(total / pageSize) || 1,
        hasNext: page < Math.ceil(total / pageSize),
        hasPrev: page > 1
      }
    };
  }

  /**
   * Get a single document by ID.
   * @param {object} ctx
   * @return {{ ok: boolean, data: object }}
   */
  function get(ctx) {
    var doc = Repository.findById('Documents', ctx.payload.documentId);
    if (!doc) { return { ok: false, error: 'NOT_FOUND' }; }
    return { ok: true, data: doc };
  }

  /**
   * Create a document (metadata only, no file yet).
   * @param {object} ctx
   * @return {{ ok: boolean, data: object }}
   */
  function create(ctx) {
    var o = ctx.payload;
    var ts = Utils.now();
    var userId = ctx.user ? ctx.user.userId : '';

    var doc = {
      documentNumber: generateDocumentNumber(),
      title: o.title || '',
      categoryId: o.categoryId || '',
      description: o.description || '',
      tags: o.tags || '',
      linkedEntityType: o.linkedEntityType || '',
      linkedEntityId: o.linkedEntityId || '',
      fileRef: '',
      versionNo: '1',
      isArchived: 'FALSE',
      effectiveDate: o.effectiveDate || '',
      expiryDate: o.expiryDate || '',
      uploadedAt: '',
      uploadedBy: '',
      statusKey: 'ACTIVE'
    };

    var created = Repository.withLock(function () {
      return Repository.insert('Documents', doc, { userId: userId });
    }, 'document:create');

    Audit.write({
      action: 'DOCUMENT_CREATED',
      entity: 'Documents',
      entityId: created.documentId,
      after: created,
      sourceSheet: 'Documents',
      requestId: ctx.requestId,
      actor: ctx.user ? { userId: ctx.user.userId, name: ctx.user.fullName, roleKeys: ctx.user.roleKeys } : undefined
    });

    return { ok: true, data: created };
  }

  /**
   * Update a document (metadata fields only).
   * @param {object} ctx
   * @return {{ ok: boolean, data: object }}
   */
  function update(ctx) {
    var doc = Repository.findById('Documents', ctx.payload.documentId);
    if (!doc) { return { ok: false, error: 'NOT_FOUND' }; }

    var ALLOWED = ['title', 'description', 'tags', 'linkedEntityType', 'linkedEntityId', 'categoryId', 'effectiveDate', 'expiryDate'];
    var patch = {};
    var o = ctx.payload;
    for (var i = 0; i < ALLOWED.length; i++) {
      if (o.hasOwnProperty(ALLOWED[i])) { patch[ALLOWED[i]] = o[ALLOWED[i]]; }
    }

    if (Object.keys(patch).length === 0) {
      return { ok: true, data: doc };
    }

    var updated = Repository.withLock(function () {
      return Repository.updateById('Documents', doc.documentId, patch, { userId: ctx.user ? ctx.user.userId : 'SYSTEM' });
    }, 'document:update');

    Audit.write({
      action: 'DOCUMENT_UPDATED',
      entity: 'Documents',
      entityId: doc.documentId,
      before: doc,
      after: updated,
      sourceSheet: 'Documents',
      requestId: ctx.requestId,
      actor: ctx.user ? { userId: ctx.user.userId, name: ctx.user.fullName, roleKeys: ctx.user.roleKeys } : undefined
    });

    return { ok: true, data: updated };
  }

  /**
   * Archive a document (statusKey = ARCHIVED, never hard-delete).
   * @param {object} ctx
   * @return {{ ok: boolean, data: object }}
   */
  function archive(ctx) {
    var doc = Repository.findById('Documents', ctx.payload.documentId);
    if (!doc) { return { ok: false, error: 'NOT_FOUND' }; }

    if (doc.statusKey === 'ARCHIVED') {
      return { ok: false, error: 'VALIDATION_ERROR', message: 'Document is already archived.' };
    }

    var patch = {
      statusKey: 'ARCHIVED',
      isArchived: 'TRUE'
    };

    var updated = Repository.withLock(function () {
      return Repository.updateById('Documents', doc.documentId, patch, { userId: ctx.user ? ctx.user.userId : 'SYSTEM' });
    }, 'document:archive');

    Audit.write({
      action: 'DOCUMENT_ARCHIVED',
      entity: 'Documents',
      entityId: doc.documentId,
      before: doc,
      after: updated,
      reason: ctx.payload.reason || '',
      sourceSheet: 'Documents',
      requestId: ctx.requestId,
      actor: ctx.user ? { userId: ctx.user.userId, name: ctx.user.fullName, roleKeys: ctx.user.roleKeys } : undefined
    });

    return { ok: true, data: updated };
  }

  /**
   * Upload a file to Drive and link it to a document.
   * Creates the document if documentId is not provided.
   *
   * @param {object} ctx
   * @return {{ ok: boolean, data: object }}
   */
  function upload(ctx) {
    var o = ctx.payload;
    var ts = Utils.now();
    var userId = ctx.user ? ctx.user.userId : '';

    // Resolve target Drive folder from category
    var folderResult = DriveService.resolveFolderForCategory(o.categoryId);

    // Upload to Drive
    var fileRef;
    try {
      fileRef = DriveService.upload({
        fileName: o.fileName || 'document',
        mimeType: o.mimeType || 'application/octet-stream',
        base64: o.base64,
        folderId: folderResult.folderId
      });
    } catch (e) {
      return { ok: false, error: 'INTERNAL_ERROR', message: 'File upload failed: ' + e.message };
    }

    // Build fileRef JSON
    var fileRefJson = Utils.safeJsonStringify({
      fileId: fileRef.fileId,
      name: fileRef.name,
      mimeType: fileRef.mimeType,
      size: fileRef.size,
      url: fileRef.url,
      folderKey: folderResult.folderId
    });

    var doc = null;
    if (o.documentId) {
      doc = Repository.findById('Documents', o.documentId);
    }

    if (doc) {
      // Update existing document with fileRef
      var patch = {
        fileRef: fileRefJson,
        uploadedAt: ts,
        uploadedBy: userId,
        versionNo: String(Utils.toNumber(doc.versionNo, 0) + 1)
      };
      var updated = Repository.withLock(function () {
        return Repository.updateById('Documents', doc.documentId, patch, { userId: userId });
      }, 'document:upload');

      Audit.write({
        action: 'DOCUMENT_UPLOADED',
        entity: 'Documents',
        entityId: doc.documentId,
        after: { fileRef: fileRef, versionNo: patch.versionNo },
        sourceSheet: 'Documents',
        requestId: ctx.requestId,
        actor: ctx.user ? { userId: ctx.user.userId, name: ctx.user.fullName, roleKeys: ctx.user.roleKeys } : undefined
      });

      return { ok: true, data: { fileRef: fileRef, document: updated } };
    } else {
      // Create new document with file
      var docRecord = {
        documentNumber: generateDocumentNumber(),
        title: o.fileName || 'Untitled',
        categoryId: o.categoryId || '',
        description: o.description || '',
        tags: o.tags || '',
        linkedEntityType: o.linkedEntityType || '',
        linkedEntityId: o.linkedEntityId || '',
        fileRef: fileRefJson,
        versionNo: '1',
        isArchived: 'FALSE',
        effectiveDate: o.effectiveDate || '',
        expiryDate: o.expiryDate || '',
        uploadedAt: ts,
        uploadedBy: userId,
        statusKey: 'ACTIVE'
      };

      var created = Repository.withLock(function () {
        return Repository.insert('Documents', docRecord, { userId: userId });
      }, 'document:create-upload');

      Audit.write({
        action: 'DOCUMENT_CREATED',
        entity: 'Documents',
        entityId: created.documentId,
        after: created,
        sourceSheet: 'Documents',
        requestId: ctx.requestId,
        actor: ctx.user ? { userId: ctx.user.userId, name: ctx.user.fullName, roleKeys: ctx.user.roleKeys } : undefined
      });

      return { ok: true, data: { fileRef: fileRef, document: created } };
    }
  }

  // ---------------------------------------------------------------------------
  // Expose
  // ---------------------------------------------------------------------------

  return {
    list: list,
    get: get,
    create: create,
    update: update,
    archive: archive,
    upload: upload
  };
})();
