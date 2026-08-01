var HEALTH_V5_FOUNDATION = Object.freeze({
  schemaVersion: '1.3.3',
  timezone: 'Asia/Bangkok',
  headerProtectionDescription: 'HEALTH_V5_CANONICAL_HEADER',
  headerBackground: '#0B1F3A',
  headerForeground: '#FFFFFF',
  headerFont: 'Prompt',
  headerHeight: 48,
  dataRowCount: 999,
  setupActor: 'SYSTEM_SETUP',
  activeStatus: 'ACTIVE',
  config: Object.freeze({
    academicYear: '2569',
    term: '1',
    termStartDate: '2026-05-01',
    termEndDate: '2026-10-31',
    sessionMinutes: '30',
    idleMinutes: '15',
    otpExpiryMinutes: '10',
    otpResendSeconds: '60',
    otpMaxSends: '3',
    otpWindowMinutes: '15',
    failedAttemptLimit: '5',
    lockoutMinutes: '15',
    emergencySessionMinutes: '5',
  }),
});

function createApiResult_(success, requestId, data, errorCode) {
  var result = {
    success: Boolean(success),
    requestId: requestId,
  };

  if (success) {
    result.data = data || {};
  } else {
    result.errorCode = errorCode || 'INTERNAL_ERROR';
  }

  return result;
}

function createRequestId_() {
  return Utilities.getUuid();
}

function getCanonicalSchema_(sheetName) {
  for (var index = 0; index < HEALTH_V5_SCHEMA.length; index += 1) {
    if (HEALTH_V5_SCHEMA[index].name === sheetName) {
      return HEALTH_V5_SCHEMA[index];
    }
  }
  throw new Error('Unknown canonical sheet: ' + sheetName);
}

function getCanonicalHeaders_(schema) {
  return schema.fields.map(function (field) {
    return field.name;
  });
}

function normalizeCellValue_(value) {
  if (value === null || typeof value === 'undefined') return '';
  return value;
}

