function buildIntegrityCache_(spreadsheet) {
  var cache = {};
  HEALTH_V5_SCHEMA.forEach(function (schema) {
    var sheet = spreadsheet.getSheetByName(schema.name);
    var records = [];
    if (sheet && sheet.getLastRow() > 1) {
      var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, schema.fieldCount).getValues();
      values.forEach(function (row) {
        // Checkbox validation can make an otherwise empty row read as FALSE.
        // A canonical record exists only when its primary key (column 1) exists.
        if (isBlankValue_(row[0])) return;
        var record = {};
        schema.fields.forEach(function (field, index) {
          record[field.name] = normalizeStoredValue_(row[index], field);
        });
        records.push(record);
      });
    }
    cache[schema.name] = records;
  });
  return cache;
}

function validateRecordBatch_(sheetName, records, cache, excludedPrimaryKey) {
  var schema = getCanonicalSchema_(sheetName);
  var errors = [];
  records.forEach(function (record, index) {
    validateRecordShape_(schema, record).forEach(function (error) { errors.push(withRow_(error, index + 1)); });
    validateForeignKeys_(sheetName, record, cache).forEach(function (error) { errors.push(withRow_(error, index + 1)); });
  });
  validateUniqueConstraints_(sheetName, records, cache, excludedPrimaryKey).forEach(function (error) { errors.push(error); });
  return { passed: errors.length === 0, errors: errors };
}

function validateRecordShape_(schema, record) {
  var errors = [];
  schema.fields.forEach(function (field) {
    var value = record[field.name];
    if (field.required && isBlankValue_(value)) {
      errors.push({ code: 'REQUIRED_FIELD', field: field.name });
      return;
    }
    if (isBlankValue_(value)) return;
    if (!isValueOfType_(value, field.type)) errors.push({ code: 'INVALID_TYPE', field: field.name, expected: field.type });
    if (field.allowedValues.length && field.allowedValues.indexOf(normalizeAllowedValue_(value, field.type)) === -1) {
      errors.push({ code: 'INVALID_ALLOWED_VALUE', field: field.name });
    }
    if (field.name === 'RowVersion' && (!Number.isInteger(Number(value)) || Number(value) < 1)) {
      errors.push({ code: 'INVALID_ROW_VERSION', field: field.name });
    }
  });
  return errors;
}

function validateForeignKeys_(sheetName, record, cache) {
  var errors = [];
  Object.keys(HEALTH_V5_RELATIONS).forEach(function (path) {
    var parts = path.split('.');
    if (parts[0] !== sheetName) return;
    var value = record[parts[1]];
    if (isBlankValue_(value)) return;
    var target = HEALTH_V5_RELATIONS[path];
    var found = (cache[target[0]] || []).some(function (candidate) {
      return String(candidate[target[1]]) === String(value) && candidate.RecordStatus !== 'CANCELLED';
    });
    if (!found) errors.push({ code: 'FOREIGN_KEY_NOT_FOUND', field: parts[1], target: target.join('.') });
  });
  return errors;
}

function validateUniqueConstraints_(sheetName, records, cache, excludedPrimaryKey) {
  var errors = [];
  var schema = getCanonicalSchema_(sheetName);
  var primaryKey = schema.fields[0].name;
  (HEALTH_V5_UNIQUE_FIELDS[sheetName] || []).forEach(function (fields) {
    var seen = {};
    (cache[sheetName] || []).forEach(function (record) {
      if (excludedPrimaryKey && String(record[primaryKey]) === String(excludedPrimaryKey)) return;
      var key = uniqueKey_(record, fields);
      if (key) seen[key] = true;
    });
    records.forEach(function (record, index) {
      var key = uniqueKey_(record, fields);
      if (!key) return;
      if (seen[key]) errors.push({ code: 'DUPLICATE_UNIQUE_KEY', fields: fields, row: index + 1 });
      seen[key] = true;
    });
  });
  return errors;
}

function uniqueKey_(record, fields) {
  var values = fields.map(function (field) { return record[field]; });
  if (values.some(isBlankValue_)) return '';
  return values.map(function (value) { return String(value).trim().toLowerCase(); }).join('\u001f');
}

function isValueOfType_(value, type) {
  if (type === 'STRING' || type === 'JSON') return typeof value === 'string';
  if (type === 'NUMBER') return typeof value === 'number' && isFinite(value);
  if (type === 'BOOLEAN') return typeof value === 'boolean';
  if (type === 'DATE' || type === 'DATETIME') return value instanceof Date && !isNaN(value.getTime());
  return true;
}

function normalizeAllowedValue_(value, type) {
  if (type === 'BOOLEAN') return value ? 'TRUE' : 'FALSE';
  return String(value);
}

function normalizeStoredValue_(value, field) {
  if (isBlankValue_(value)) return value;
  if (field.type === 'BOOLEAN' && typeof value === 'string') {
    if (value.toUpperCase() === 'TRUE') return true;
    if (value.toUpperCase() === 'FALSE') return false;
  }
  if (field.type === 'NUMBER' && typeof value === 'string' && value.trim() !== '' && isFinite(Number(value))) {
    return Number(value);
  }
  if ((field.type === 'DATE' || field.type === 'DATETIME') && typeof value === 'string') {
    var parsed = new Date(value);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  return value;
}

function isBlankValue_(value) {
  return value === '' || value === null || typeof value === 'undefined';
}

function withRow_(error, row) {
  error.row = row;
  return error;
}
