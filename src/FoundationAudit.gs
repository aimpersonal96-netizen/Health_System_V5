function runFoundationAudit() {
  var requestId = createRequestId_();
  try {
    var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    if (!spreadsheet) throw new Error('BOUND_SPREADSHEET_REQUIRED');
    var audit = auditFoundation_(spreadsheet);
    return createApiResult_(audit.passed, requestId, audit, audit.passed ? null : 'FOUNDATION_AUDIT_FAILED');
  } catch (error) {
    console.error('runFoundationAudit failed', requestId, error);
    return createApiResult_(false, requestId, null, 'FOUNDATION_AUDIT_FAILED');
  }
}

function auditFoundation_(spreadsheet) {
  var errors = [];
  var warnings = [];
  var expectedNames = HEALTH_V5_SCHEMA.map(function (schema) { return schema.name; });
  var actualNames = spreadsheet.getSheets().map(function (sheet) { return sheet.getName(); });
  if (!arraysEqual_(actualNames, expectedNames)) errors.push('SHEET_ORDER_OR_SET_MISMATCH');

  var sheetResults = HEALTH_V5_SCHEMA.map(function (schema, index) {
    var sheet = spreadsheet.getSheetByName(schema.name);
    var result = { name: schema.name, order: index + 1, fieldCount: schema.fieldCount, passed: true };
    if (!sheet) {
      errors.push('MISSING_SHEET:' + schema.name);
      result.passed = false;
      return result;
    }
    if (sheet.getMaxColumns() !== schema.fieldCount) {
      errors.push('FIELD_COUNT_MISMATCH:' + schema.name);
      result.passed = false;
    }
    var actualHeaders = sheet.getRange(1, 1, 1, schema.fieldCount).getDisplayValues()[0];
    if (!arraysEqual_(actualHeaders, getCanonicalHeaders_(schema))) {
      errors.push('HEADER_MISMATCH:' + schema.name);
      result.passed = false;
    }
    if (sheet.getFrozenRows() !== 1) {
      errors.push('HEADER_NOT_FROZEN:' + schema.name);
      result.passed = false;
    }
    var protectedHeader = sheet.getProtections(SpreadsheetApp.ProtectionType.RANGE).some(function (protection) {
      return protection.getDescription() === HEALTH_V5_FOUNDATION.headerProtectionDescription;
    });
    if (!protectedHeader) {
      errors.push('HEADER_NOT_PROTECTED:' + schema.name);
      result.passed = false;
    }
    return result;
  });

  auditSeedKeys_(spreadsheet, 'ConfigDB', 'ConfigID', 15, errors);
  auditSeedKeys_(spreadsheet, 'RoleDB', 'RoleKey', 4, errors);
  auditSeedKeys_(spreadsheet, 'PermissionDB', 'PermissionID', 56, errors);
  return {
    passed: errors.length === 0,
    schemaVersion: HEALTH_V5_SCHEMA_VERSION,
    sheetCount: actualNames.length,
    totalFieldCount: HEALTH_V5_SCHEMA.reduce(function (sum, schema) { return sum + schema.fieldCount; }, 0),
    errors: errors,
    warnings: warnings,
    sheetResults: sheetResults,
  };
}

function auditSeedKeys_(spreadsheet, sheetName, keyName, minimumCount, errors) {
  var sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) return;
  var headers = getCanonicalHeaders_(getCanonicalSchema_(sheetName));
  var keyColumn = headers.indexOf(keyName) + 1;
  var keys = [];
  if (sheet.getLastRow() > 1) {
    keys = sheet.getRange(2, keyColumn, sheet.getLastRow() - 1, 1).getDisplayValues()
      .map(function (row) { return row[0]; })
      .filter(function (value) { return value !== ''; });
  }
  var unique = {};
  keys.forEach(function (key) {
    if (unique[key]) errors.push('DUPLICATE_SEED_KEY:' + sheetName + ':' + key);
    unique[key] = true;
  });
  if (keys.length < minimumCount) errors.push('SEED_ROWS_MISSING:' + sheetName);
}
