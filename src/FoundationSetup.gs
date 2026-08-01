function setupDevelopmentDatabase() {
  var requestId = createRequestId_();
  var lock = LockService.getDocumentLock();

  try {
    lock.waitLock(30000);
    var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    if (!spreadsheet) {
      throw new Error('This function must run from the bound DEV spreadsheet.');
    }

    spreadsheet.setSpreadsheetTimeZone(HEALTH_V5_FOUNDATION.timezone);
    var createdSheets = [];
    var existingSheets = [];

    HEALTH_V5_SCHEMA.forEach(function (schema) {
      var sheet = spreadsheet.getSheetByName(schema.name);
      if (!sheet) {
        sheet = spreadsheet.insertSheet(schema.name);
        createdSheets.push(schema.name);
      } else {
        existingSheets.push(schema.name);
      }

      prepareCanonicalSheet_(sheet, schema);
    });

    removeBlankNonCanonicalSheets_(spreadsheet);
    orderCanonicalSheets_(spreadsheet);
    var seedSummary = seedFoundationData_(spreadsheet);
    SpreadsheetApp.flush();

    var audit = auditFoundation_(spreadsheet);
    if (!audit.passed) {
      throw new Error('FOUNDATION_AUDIT_FAILED: ' + audit.errors.join(' | '));
    }

    return createApiResult_(true, requestId, {
      schemaVersion: HEALTH_V5_SCHEMA_VERSION,
      spreadsheetId: spreadsheet.getId(),
      createdSheets: createdSheets,
      reusedSheets: existingSheets,
      seededRows: seedSummary,
      audit: audit,
    });
  } catch (error) {
    console.error('setupDevelopmentDatabase failed', requestId, error);
    return createApiResult_(false, requestId, null, mapFoundationError_(error));
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
}

function prepareCanonicalSheet_(sheet, schema) {
  var headers = getCanonicalHeaders_(schema);
  ensureCanonicalDimensions_(sheet, schema.fieldCount);
  ensureCanonicalHeader_(sheet, headers);
  applyCanonicalHeaderStyle_(sheet, schema);
  applyCanonicalColumnRules_(sheet, schema);
  ensureCanonicalHeaderProtection_(sheet, schema.fieldCount);
}

function ensureCanonicalDimensions_(sheet, fieldCount) {
  var maxColumns = sheet.getMaxColumns();
  if (maxColumns < fieldCount) {
    sheet.insertColumnsAfter(maxColumns, fieldCount - maxColumns);
  } else if (maxColumns > fieldCount) {
    var extraWidth = maxColumns - fieldCount;
    var extraRange = sheet.getRange(1, fieldCount + 1, sheet.getMaxRows(), extraWidth);
    if (extraRange.getDisplayValues().some(function (row) {
      return row.some(function (value) { return value !== ''; });
    })) {
      throw new Error('NON_CANONICAL_DATA_OUTSIDE_SCHEMA:' + sheet.getName());
    }
    sheet.deleteColumns(fieldCount + 1, extraWidth);
  }

  var minimumRows = HEALTH_V5_FOUNDATION.dataRowCount + 1;
  if (sheet.getMaxRows() < minimumRows) {
    sheet.insertRowsAfter(sheet.getMaxRows(), minimumRows - sheet.getMaxRows());
  }
}

function ensureCanonicalHeader_(sheet, headers) {
  var headerRange = sheet.getRange(1, 1, 1, headers.length);
  var currentHeaders = headerRange.getDisplayValues()[0];
  var hasHeaderContent = currentHeaders.some(function (value) { return value !== ''; });

  if (hasHeaderContent && !arraysEqual_(currentHeaders, headers)) {
    throw new Error('HEADER_MISMATCH:' + sheet.getName());
  }

  if (!hasHeaderContent) {
    headerRange.setValues([headers]);
  }
}

function applyCanonicalHeaderStyle_(sheet, schema) {
  var headerRange = sheet.getRange(1, 1, 1, schema.fieldCount);
  headerRange
    .setBackground(HEALTH_V5_FOUNDATION.headerBackground)
    .setFontColor(HEALTH_V5_FOUNDATION.headerForeground)
    .setFontFamily(HEALTH_V5_FOUNDATION.headerFont)
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle')
    .setWrap(true);
  sheet.setFrozenRows(1);
  sheet.setRowHeight(1, HEALTH_V5_FOUNDATION.headerHeight);
  sheet.setTabColor(HEALTH_V5_FOUNDATION.headerBackground);

  schema.fields.forEach(function (field, index) {
    var note = [
      'Type: ' + field.type,
      'Required: ' + (field.required ? 'Y' : 'N'),
      'Validation: ' + field.validation,
      'Relation: ' + (field.relation || '—'),
      'Sensitivity: ' + field.sensitivity,
    ].join('\n');
    sheet.getRange(1, index + 1).setNote(note);
    sheet.setColumnWidth(index + 1, getColumnWidth_(field));
  });
}

function applyCanonicalColumnRules_(sheet, schema) {
  var rowCount = sheet.getMaxRows() - 1;
  schema.fields.forEach(function (field, index) {
    var range = sheet.getRange(2, index + 1, rowCount, 1);
    range.setNumberFormat(getNumberFormat_(field.type));

    if (field.type === 'BOOLEAN') {
      range.insertCheckboxes();
    } else if (field.allowedValues.length > 1) {
      var validation = SpreadsheetApp.newDataValidation()
        .requireValueInList(field.allowedValues, true)
        .setAllowInvalid(false)
        .setHelpText('Allowed: ' + field.allowedValues.join(', '))
        .build();
      range.setDataValidation(validation);
    }
  });
}

function ensureCanonicalHeaderProtection_(sheet, fieldCount) {
  var protections = sheet.getProtections(SpreadsheetApp.ProtectionType.RANGE);
  var exists = protections.some(function (protection) {
    return protection.getDescription() === HEALTH_V5_FOUNDATION.headerProtectionDescription;
  });

  if (!exists) {
    sheet.getRange(1, 1, 1, fieldCount)
      .protect()
      .setDescription(HEALTH_V5_FOUNDATION.headerProtectionDescription)
      .setWarningOnly(true);
  }
}

function removeBlankNonCanonicalSheets_(spreadsheet) {
  var canonicalNames = HEALTH_V5_SCHEMA.map(function (schema) { return schema.name; });
  spreadsheet.getSheets().forEach(function (sheet) {
    if (canonicalNames.indexOf(sheet.getName()) !== -1) return;
    if (sheet.getDataRange().getDisplayValues().some(function (row) {
      return row.some(function (value) { return value !== ''; });
    })) {
      throw new Error('NON_CANONICAL_SHEET_HAS_DATA:' + sheet.getName());
    }
    spreadsheet.deleteSheet(sheet);
  });
}

function orderCanonicalSheets_(spreadsheet) {
  HEALTH_V5_SCHEMA.forEach(function (schema, index) {
    var sheet = spreadsheet.getSheetByName(schema.name);
    spreadsheet.setActiveSheet(sheet);
    spreadsheet.moveActiveSheet(index + 1);
  });
  spreadsheet.setActiveSheet(spreadsheet.getSheetByName('ConfigDB'));
}

function arraysEqual_(left, right) {
  if (left.length !== right.length) return false;
  for (var index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

function getNumberFormat_(type) {
  if (type === 'NUMBER') return '0.########';
  if (type === 'DATE') return 'yyyy-mm-dd';
  if (type === 'DATETIME') return 'yyyy-mm-dd hh:mm:ss';
  return '@';
}

function getColumnWidth_(field) {
  if (field.type === 'BOOLEAN') return 110;
  if (field.type === 'DATE' || field.type === 'DATETIME') return 165;
  if (field.name.indexOf('Note') !== -1 || field.name.indexOf('Description') !== -1) return 260;
  if (field.type === 'JSON') return 280;
  return Math.max(130, Math.min(220, field.name.length * 11));
}

function mapFoundationError_(error) {
  var message = String(error && error.message ? error.message : error);
  if (message.indexOf('HEADER_MISMATCH:') === 0) return 'HEADER_MISMATCH';
  if (message.indexOf('NON_CANONICAL_SHEET_HAS_DATA:') === 0) return 'NON_CANONICAL_SHEET_HAS_DATA';
  if (message.indexOf('NON_CANONICAL_DATA_OUTSIDE_SCHEMA:') === 0) return 'NON_CANONICAL_DATA_OUTSIDE_SCHEMA';
  if (message.indexOf('FOUNDATION_AUDIT_FAILED:') === 0) return 'FOUNDATION_AUDIT_FAILED';
  return 'FOUNDATION_SETUP_FAILED';
}
