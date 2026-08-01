function authorizeResource(sessionId, sessionToken, resourceKey, action) {
  var requestId = createRequestId_();
  try {
    var session = requireSession_(sessionId, sessionToken, true);
    var decision = authorizeResource_(session, resourceKey, action || 'VIEW');
    return createApiResult_(decision.allowed, requestId, decision.allowed ? decision : null, decision.allowed ? null : 'ACCESS_DENIED');
  } catch (error) {
    return createApiResult_(false, requestId, null, error.message === 'ACCESS_DENIED' ? 'ACCESS_DENIED' : 'SESSION_INVALID');
  }
}

function authorizeResource_(session, resourceKey, action) {
  var permission = buildIntegrityCache_(SpreadsheetApp.getActiveSpreadsheet()).PermissionDB.find(function (record) {
    return record.RoleKey === session.roleKey && record.ResourceKey === resourceKey && record.RecordStatus === 'ACTIVE';
  });
  var actionFields = { VIEW: 'CanView', CREATE: 'CanCreate', UPDATE: 'CanUpdate', CANCEL: 'CanCancel', EXPORT: 'CanExport', REPORT: 'CanViewReports', MODIFY_SCHEMA: 'CanModifySchema' };
  var field = actionFields[action];
  if (!permission || !field || permission[field] !== true) throw new Error('ACCESS_DENIED');
  if (session.roleKey === 'TEACHER' && (!session.context || HEALTH_V5_SECURITY.validContexts.indexOf(session.context.type) === -1)) throw new Error('ACCESS_DENIED');
  return {
    allowed: true, roleKey: session.roleKey, resourceKey: resourceKey, action: action,
    dataScope: permission.DataScope, context: session.context || null,
    canViewNationalID: permission.CanViewNationalID === true,
  };
}

function maskFields(sessionId, sessionToken, resourceKey, record) {
  var requestId = createRequestId_();
  try {
    var session = requireSession_(sessionId, sessionToken, true);
    authorizeResource_(session, resourceKey, 'VIEW');
    return createApiResult_(true, requestId, maskFields_(session.roleKey, resourceKey, record));
  } catch (error) {
    return createApiResult_(false, requestId, null, error.message === 'ACCESS_DENIED' ? 'ACCESS_DENIED' : 'SESSION_INVALID');
  }
}

function maskFields_(roleKey, resourceKey, record) {
  var output = {};
  Object.keys(record || {}).forEach(function (field) { output[field] = record[field]; });
  if (output.NationalID) output.NationalID = maskNationalId_(output.NationalID);
  if (roleKey === 'TEACHER' && resourceKey === 'MEDICATION_PLAN') {
    var allowed = ['MedicineName', 'Strength', 'Dose', 'MorningBeforeMeal', 'MorningAfterMeal', 'NoonBeforeMeal', 'NoonAfterMeal', 'EveningBeforeMeal', 'EveningAfterMeal', 'Bedtime', 'PRNInstruction', 'Route', 'Precaution'];
    var medication = {};
    allowed.forEach(function (field) { if (typeof output[field] !== 'undefined') medication[field] = output[field]; });
    return medication;
  }
  var alwaysPrivate = ['PINHash', 'PINSalt', 'BeforeJSON', 'AfterJSON', 'PreviousHash', 'EntryHash'];
  alwaysPrivate.forEach(function (field) { delete output[field]; });
  return output;
}

function maskNationalId_(value) {
  value = String(value || '');
  if (value.length <= 4) return '*'.repeat(value.length);
  return '*'.repeat(value.length - 4) + value.slice(-4);
}
