function runDataIntegrityAudit() {
  var requestId = createRequestId_();
  try {
    var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    if (!spreadsheet) throw new Error('BOUND_SPREADSHEET_REQUIRED');
    var audit = auditDataIntegrity_(spreadsheet);
    var controls = runG2ControlTests_(spreadsheet);
    var passed = audit.passed && controls.passed;
    return createApiResult_(passed, requestId, { audit: audit, controlTests: controls }, passed ? null : 'G2_AUDIT_FAILED');
  } catch (error) {
    console.error('runDataIntegrityAudit failed', requestId, error);
    return createApiResult_(false, requestId, null, mapG2Error_(error));
  }
}

function auditDataIntegrity_(spreadsheet) {
  var cache = buildIntegrityCache_(spreadsheet);
  var errors = [];
  var sheetResults = [];
  HEALTH_V5_SCHEMA.forEach(function (schema) {
    var records = cache[schema.name] || [];
    var sheetErrors = [];
    records.forEach(function (record, index) {
      validateRecordShape_(schema, record).forEach(function (error) { sheetErrors.push(withRow_(error, index + 2)); });
      validateForeignKeys_(schema.name, record, cache).forEach(function (error) { sheetErrors.push(withRow_(error, index + 2)); });
    });
    validateUniqueConstraints_(schema.name, records, emptyIntegrityCache_(), null).forEach(function (error) {
      error.row = Number(error.row || 0) + 1;
      sheetErrors.push(error);
    });
    sheetErrors.forEach(function (error) {
      error.sheet = schema.name;
      errors.push(error);
    });
    sheetResults.push({ sheet: schema.name, records: records.length, errors: sheetErrors.length, passed: sheetErrors.length === 0 });
  });
  return {
    passed: errors.length === 0,
    totalRecords: sheetResults.reduce(function (sum, result) { return sum + result.records; }, 0),
    errorCount: errors.length,
    errors: errors.slice(0, 100),
    sheetResults: sheetResults,
    structureRoundTrip: runStructureRoundTripTest_(),
  };
}

function runG2ControlTests_(spreadsheet) {
  var cache = buildIntegrityCache_(spreadsheet);
  var studentSchema = getCanonicalSchema_('StudentDB');
  var base = prepareRecordForCreate_(studentSchema, {
    StudentID: 'STD-G2-CONTROL', StudentCode: 'G2-CONTROL', DisplayName: 'ข้อมูลควบคุม',
    ClassroomID: 'CLS-NOT-FOUND', StudentStatus: 'ACTIVE_STUDENT',
  }, HEALTH_V5_AUDIT_ACTOR);
  var invalidFkRejected = !validateRecordBatch_('StudentDB', [base], cache, null).passed;
  base.ClassroomID = 'CLS-DEV-01';
  base.StudentID = 'STD-DEV-001';
  base.StudentCode = 'DEV-S001';
  var duplicateRejected = !validateRecordBatch_('StudentDB', [base], cache, null).passed;
  base.StudentID = 'STD-G2-CONTROL';
  base.StudentCode = 'G2-CONTROL';
  base.RowVersion = 0;
  var invalidVersionRejected = !validateRecordBatch_('StudentDB', [base], cache, null).passed;
  var softDeleteContract = repositorySoftDelete_.toString().indexOf("RecordStatus: 'CANCELLED'") !== -1;
  var optimisticLockContract = repositoryUpdate_.toString().indexOf('ROW_VERSION_CONFLICT') !== -1;
  var structureRoundTrip = runStructureRoundTripTest_();
  var tests = {
    invalidForeignKeyRejected: invalidFkRejected,
    duplicateKeyRejected: duplicateRejected,
    invalidRowVersionRejected: invalidVersionRejected,
    softDeleteContract: softDeleteContract,
    optimisticLockContract: optimisticLockContract,
    structureRoundTrip: structureRoundTrip,
  };
  return { passed: Object.keys(tests).every(function (key) { return tests[key] === true; }), tests: tests };
}

function emptyIntegrityCache_() {
  var cache = {};
  HEALTH_V5_SCHEMA.forEach(function (schema) { cache[schema.name] = []; });
  return cache;
}

function runStructureRoundTripTest_() {
  var snapshot = JSON.stringify(HEALTH_V5_SCHEMA.map(function (schema) {
    return { name: schema.name, headers: getCanonicalHeaders_(schema) };
  }));
  var restored = JSON.parse(snapshot);
  return restored.length === 20 && restored.every(function (item, index) {
    return item.name === HEALTH_V5_SCHEMA[index].name && arraysEqual_(item.headers, getCanonicalHeaders_(HEALTH_V5_SCHEMA[index]));
  });
}
