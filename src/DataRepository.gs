function repositoryCreateBatch_(spreadsheet, sheetName, records, actor) {
  var lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  try {
    var schema = getCanonicalSchema_(sheetName);
    var prepared = records.map(function (record) {
      return prepareRecordForCreate_(schema, record, actor || HEALTH_V5_AUDIT_ACTOR);
    });
    var cache = buildIntegrityCache_(spreadsheet);
    var validation = validateRecordBatch_(sheetName, prepared, cache, null);
    if (!validation.passed) throw new Error('VALIDATION_FAILED:' + JSON.stringify(validation.errors));
    appendRecordObjects_(spreadsheet.getSheetByName(sheetName), schema, prepared);
    SpreadsheetApp.flush();
    return { created: prepared.length, records: prepared };
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
}

function repositoryUpdate_(spreadsheet, sheetName, primaryKey, patch, expectedRowVersion, actor) {
  var lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  try {
    var schema = getCanonicalSchema_(sheetName);
    var sheet = spreadsheet.getSheetByName(sheetName);
    var located = findRecordRow_(sheet, schema.fields[0].name, primaryKey);
    if (!located) throw new Error('RECORD_NOT_FOUND');
    var current = rowToRecord_(sheet, schema, located.rowNumber);
    if (Number(current.RowVersion || 1) !== Number(expectedRowVersion)) throw new Error('ROW_VERSION_CONFLICT');
    var updated = {};
    getCanonicalHeaders_(schema).forEach(function (name) { updated[name] = current[name]; });
    Object.keys(patch || {}).forEach(function (name) {
      if (name === schema.fields[0].name || ['CreatedAt', 'CreatedBy', 'RowVersion'].indexOf(name) !== -1) return;
      if (typeof updated[name] !== 'undefined') updated[name] = patch[name];
    });
    updated.UpdatedAt = new Date();
    updated.UpdatedBy = actor || HEALTH_V5_AUDIT_ACTOR;
    updated.RowVersion = Number(current.RowVersion || 1) + 1;
    var cache = buildIntegrityCache_(spreadsheet);
    var validation = validateRecordBatch_(sheetName, [updated], cache, primaryKey);
    if (!validation.passed) throw new Error('VALIDATION_FAILED:' + JSON.stringify(validation.errors));
    writeRecordRow_(sheet, schema, located.rowNumber, updated);
    SpreadsheetApp.flush();
    return { before: current, after: updated };
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
}

function repositorySoftDelete_(spreadsheet, sheetName, primaryKey, expectedRowVersion, actor, reason) {
  if (!reason) throw new Error('CHANGE_REASON_REQUIRED');
  return repositoryUpdate_(spreadsheet, sheetName, primaryKey, {
    RecordStatus: 'CANCELLED', Note: reason,
  }, expectedRowVersion, actor);
}

function prepareRecordForCreate_(schema, input, actor) {
  var now = new Date();
  var output = {};
  schema.fields.forEach(function (field) {
    var value = input[field.name];
    if (isBlankValue_(value) && !isBlankValue_(field.defaultValue) && field.defaultValue !== '—') {
      value = coerceDefaultValue_(field);
    }
    output[field.name] = isBlankValue_(value) ? '' : value;
  });
  if (schema.fields.some(function (field) { return field.name === 'RecordStatus'; }) && !output.RecordStatus) output.RecordStatus = 'ACTIVE';
  if (typeof output.CreatedAt !== 'undefined' && !output.CreatedAt) output.CreatedAt = now;
  if (typeof output.CreatedBy !== 'undefined' && !output.CreatedBy) output.CreatedBy = actor;
  if (typeof output.UpdatedAt !== 'undefined') output.UpdatedAt = now;
  if (typeof output.UpdatedBy !== 'undefined') output.UpdatedBy = actor;
  if (typeof output.RowVersion !== 'undefined') output.RowVersion = 1;
  return output;
}

function appendRecordObjects_(sheet, schema, records) {
  if (!records.length) return;
  var headers = getCanonicalHeaders_(schema);
  var rows = records.map(function (record) {
    return headers.map(function (header) { return normalizeCellValue_(record[header]); });
  });
  var startRow = findNextRecordRow_(sheet);
  ensureRowsAvailable_(sheet, startRow + rows.length - 1);
  sheet.getRange(startRow, 1, rows.length, headers.length).setValues(rows);
}

function findNextRecordRow_(sheet) {
  var maxRows = sheet.getMaxRows();
  if (maxRows < 2) return 2;
  var ids = sheet.getRange(2, 1, maxRows - 1, 1).getDisplayValues();
  for (var index = ids.length - 1; index >= 0; index -= 1) {
    if (ids[index][0] !== '') return index + 3;
  }
  return 2;
}

function ensureRowsAvailable_(sheet, requiredLastRow) {
  if (requiredLastRow > sheet.getMaxRows()) {
    sheet.insertRowsAfter(sheet.getMaxRows(), requiredLastRow - sheet.getMaxRows());
  }
}

function compactDevRecords_(spreadsheet) {
  var summary = {};
  HEALTH_V5_SCHEMA.forEach(function (schema) {
    var sheet = spreadsheet.getSheetByName(schema.name);
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      summary[schema.name] = 0;
      return;
    }
    var range = sheet.getRange(2, 1, lastRow - 1, schema.fieldCount);
    var values = range.getValues();
    var records = [];
    var unsafeBlankKeyRows = [];
    values.forEach(function (row, index) {
      if (!isBlankValue_(row[0])) {
        records.push(row);
        return;
      }
      var hasUnexpectedData = row.some(function (value) {
        return !isBlankValue_(value) && value !== false;
      });
      if (hasUnexpectedData) unsafeBlankKeyRows.push(index + 2);
    });
    if (unsafeBlankKeyRows.length) {
      throw new Error('BLANK_PRIMARY_KEY_WITH_DATA:' + schema.name + ':' + unsafeBlankKeyRows.slice(0, 5).join(','));
    }
    var alreadyCompact = records.length === 0 || values.slice(0, records.length).every(function (row) {
      return !isBlankValue_(row[0]);
    });
    if (!alreadyCompact) {
      range.clearContent();
      sheet.getRange(2, 1, records.length, schema.fieldCount).setValues(records);
    }
    summary[schema.name] = alreadyCompact ? 0 : records.length;
  });
  SpreadsheetApp.flush();
  return summary;
}

function normalizeCanonicalStoredTypes_(spreadsheet) {
  var summary = {};
  HEALTH_V5_SCHEMA.forEach(function (schema) {
    var sheet = spreadsheet.getSheetByName(schema.name);
    var lastRecordRow = findNextRecordRow_(sheet) - 1;
    var changed = 0;
    if (lastRecordRow < 2) {
      summary[schema.name] = 0;
      return;
    }
    schema.fields.forEach(function (field, index) {
      if (['BOOLEAN', 'NUMBER', 'DATE', 'DATETIME'].indexOf(field.type) === -1) return;
      var range = sheet.getRange(2, index + 1, lastRecordRow - 1, 1);
      var values = range.getValues();
      var fieldChanged = false;
      var normalized = values.map(function (row) {
        var value = normalizeStoredValue_(row[0], field);
        if (value !== row[0]) {
          changed += 1;
          fieldChanged = true;
        }
        return [value];
      });
      range.setNumberFormat(getNumberFormat_(field.type));
      if (fieldChanged) range.setValues(normalized);
    });
    summary[schema.name] = changed;
  });
  SpreadsheetApp.flush();
  return summary;
}

function writeRecordRow_(sheet, schema, rowNumber, record) {
  var row = getCanonicalHeaders_(schema).map(function (header) { return normalizeCellValue_(record[header]); });
  sheet.getRange(rowNumber, 1, 1, row.length).setValues([row]);
}

function findRecordRow_(sheet, keyName, keyValue) {
  var schema = getCanonicalSchema_(sheet.getName());
  var column = getCanonicalHeaders_(schema).indexOf(keyName) + 1;
  if (column < 1 || sheet.getLastRow() < 2) return null;
  var finder = sheet.getRange(2, column, sheet.getLastRow() - 1, 1)
    .createTextFinder(String(keyValue)).matchEntireCell(true).findNext();
  return finder ? { rowNumber: finder.getRow() } : null;
}

function rowToRecord_(sheet, schema, rowNumber) {
  var values = sheet.getRange(rowNumber, 1, 1, schema.fieldCount).getValues()[0];
  var record = {};
  schema.fields.forEach(function (field, index) {
    record[field.name] = normalizeStoredValue_(values[index], field);
  });
  return record;
}

function coerceDefaultValue_(field) {
  if (field.type === 'BOOLEAN') return String(field.defaultValue).toUpperCase() === 'TRUE';
  if (field.type === 'NUMBER') return Number(field.defaultValue);
  return field.defaultValue;
}
