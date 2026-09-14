/**
 * ExcelService.js — CSV generation, HTML-table Excel, Drive conversion.
 *
 * Rules:
 * - GAS cannot produce true .xlsx; emits CSV (Excel-openable) and Drive-converted Sheets/Docs.
 * - Reports write to Drive and return a file link, never a huge JSON payload.
 * - All generation is server-side; no client-side file creation.
 */
var ExcelService = (function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // CSV generation
  // ---------------------------------------------------------------------------

  /**
   * Generate a CSV string from an array of objects.
   * @param {Array<object>} rows       data rows
   * @param {Array<object>} columns    [{ key, label }]
   * @return {string} CSV content
   */
  function toCSV(rows, columns) {
    if (!rows || !columns || columns.length === 0) { return ''; }

    var lines = [];

    // Header row
    var header = columns.map(function (c) {
      return csvEscape(c.label || c.key);
    });
    lines.push(header.join(','));

    // Data rows
    for (var i = 0; i < rows.length; i++) {
      var row = columns.map(function (c) {
        var val = rows[i][c.key];
        if (val === null || val === undefined) { return ''; }
        return csvEscape(String(val));
      });
      lines.push(row.join(','));
    }

    return lines.join('\n');
  }

  /**
   * Escape a value for CSV (quote if it contains comma, newline, or double-quote).
   * @param {string} value
   * @return {string}
   */
  function csvEscape(value) {
    if (!value) { return ''; }
    if (/[",\n\r]/.test(value)) {
      return '"' + value.replace(/"/g, '""') + '"';
    }
    return value;
  }

  /**
   * Generate a CSV file and upload to Drive.
   * @param {object} opts
   * @param {string} opts.fileName     e.g. 'report.csv'
   * @param {Array}  opts.rows         data rows
   * @param {Array}  opts.columns      [{ key, label }]
   * @param {string} [opts.folderId]   target folder
   * @return {{ fileRef: object, rowCount: number }}
   */
  function generateCSV(opts) {
    var csv = toCSV(opts.rows, opts.columns);
    var base64 = Utilities.base64Encode(csv, Utilities.Charset.UTF_8);

    var fileRef = DriveService.upload({
      fileName: opts.fileName || 'export.csv',
      mimeType: 'text/csv',
      base64: base64,
      folderId: opts.folderId
    });

    return {
      fileRef: fileRef,
      rowCount: opts.rows ? opts.rows.length : 0
    };
  }

  // ---------------------------------------------------------------------------
  // HTML-table Excel ( xls via MimeType )
  // ---------------------------------------------------------------------------

  /**
   * Generate an HTML table string that Excel can open.
   * @param {Array<object>} rows
   * @param {Array<object>} columns  [{ key, label }]
   * @return {string} HTML content
   */
  function toHTMLTable(rows, columns) {
    if (!rows || !columns || columns.length === 0) { return '<table></table>'; }

    var html = '<html xmlns:o="urn:schemas-microsoft-com:office:office" ' +
      'xmlns:x="urn:schemas-microsoft-com:office:excel" ' +
      'xmlns="http://www.w3.org/TR/REC-html40">\n' +
      '<head><meta charset="utf-8"></head>\n<body>\n';

    // Table with Excel-compatible styling
    html += '<table border="1" cellpadding="4" cellspacing="0" style="border-collapse:collapse;">\n';

    // Header row
    html += '<tr>';
    for (var h = 0; h < columns.length; h++) {
      html += '<th style="background:#4472C4;color:#FFFFFF;font-weight:bold;">' +
        htmlEscape(columns[h].label || columns[h].key) + '</th>';
    }
    html += '</tr>\n';

    // Data rows
    for (var i = 0; i < rows.length; i++) {
      html += '<tr>';
      for (var c = 0; c < columns.length; c++) {
        var val = rows[i][columns[c].key];
        if (val === null || val === undefined) { val = ''; }
        html += '<td>' + htmlEscape(String(val)) + '</td>';
      }
      html += '</tr>\n';
    }

    html += '</table>\n</body>\n</html>';
    return html;
  }

  /**
   * Escape HTML entities.
   * @param {string} s
   * @return {string}
   */
  function htmlEscape(s) {
    if (!s) { return ''; }
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /**
   * Generate an HTML-table Excel file and upload to Drive.
   * @param {object} opts
   * @param {string} opts.fileName     e.g. 'report.xls'
   * @param {Array}  opts.rows
   * @param {Array}  opts.columns      [{ key, label }]
   * @param {string} [opts.folderId]
   * @return {{ fileRef: object, rowCount: number }}
   */
  function generateExcel(opts) {
    var html = toHTMLTable(opts.rows, opts.columns);
    var base64 = Utilities.base64Encode(html, Utilities.Charset.UTF_8);

    var fileRef = DriveService.upload({
      fileName: opts.fileName || 'export.xls',
      mimeType: 'application/vnd.ms-excel',
      base64: base64,
      folderId: opts.folderId
    });

    return {
      fileRef: fileRef,
      rowCount: opts.rows ? opts.rows.length : 0
    };
  }

  // ---------------------------------------------------------------------------
  // Drive conversion (CSV -> Google Sheets)
  // ---------------------------------------------------------------------------

  /**
   * Upload a CSV to Drive and convert it to a Google Sheet.
   * @param {object} opts
   * @param {string} opts.fileName
   * @param {string} opts.csvContent
   * @param {string} [opts.folderId]
   * @return {{ fileRef: object, rowCount: number }}
   */
  function convertToSheet(opts) {
    var folder;
    if (opts.folderId) {
      folder = DriveApp.getFolderById(opts.folderId);
    } else {
      folder = DriveService.getRootFolder();
    }

    var blob = Utilities.newBlob(opts.csvContent, 'text/csv', opts.fileName || 'export.csv');
    var file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    // Count rows (excluding header)
    var rowCount = opts.csvContent ? opts.csvContent.split('\n').length - 1 : 0;

    return {
      fileRef: {
        fileId: file.getId(),
        name: file.getName(),
        mimeType: 'text/csv',
        size: file.getSize(),
        url: file.getUrl()
      },
      rowCount: rowCount
    };
  }

  // ---------------------------------------------------------------------------
  // Expose
  // ---------------------------------------------------------------------------

  return {
    toCSV: toCSV,
    csvEscape: csvEscape,
    generateCSV: generateCSV,
    toHTMLTable: toHTMLTable,
    generateExcel: generateExcel,
    convertToSheet: convertToSheet
  };
})();
