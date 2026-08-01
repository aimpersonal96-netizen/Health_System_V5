function runG3SecurityAudit() {
  var requestId = createRequestId_();
  try {
    var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    var tests = runG3ContractTests_(spreadsheet);
    return createApiResult_(tests.passed, requestId, tests, tests.passed ? null : 'G3_AUDIT_FAILED');
  } catch (error) {
    console.error('runG3SecurityAudit failed', requestId, error);
    return createApiResult_(false, requestId, null, 'G3_AUDIT_FAILED');
  }
}

function runG3ContractTests_(spreadsheet) {
  var permissions = buildIntegrityCache_(spreadsheet).PermissionDB;
  var testHash = secureHash_('DEV-G3-SECRET', 'DEV-G3-SALT');
  var otpValues = {
    expiryMinutes: getSecurityConfigNumber_(spreadsheet, 'OTP_EXPIRY_MINUTES', 0),
    resendSeconds: getSecurityConfigNumber_(spreadsheet, 'OTP_RESEND_SECONDS', 0),
    maxSends: getSecurityConfigNumber_(spreadsheet, 'OTP_MAX_SENDS', 0),
  };
  var checks = {
    fourRolesPresent: ['ADMIN', 'HEALTH', 'TEACHER', 'EXECUTIVE'].every(function (role) {
      return buildIntegrityCache_(spreadsheet).RoleDB.some(function (record) { return record.RoleKey === role && record.RecordStatus === 'ACTIVE'; });
    }),
    teacherReadOnly: permissions.filter(function (p) { return p.RoleKey === 'TEACHER'; }).every(function (p) {
      return p.CanCreate !== true && p.CanUpdate !== true && p.CanCancel !== true && p.CanExport !== true;
    }),
    executiveReadOnly: permissions.filter(function (p) { return p.RoleKey === 'EXECUTIVE'; }).every(function (p) {
      return p.CanCreate !== true && p.CanUpdate !== true && p.CanCancel !== true && p.CanExport !== true;
    }),
    healthCannotModifySchema: permissions.filter(function (p) { return p.RoleKey === 'HEALTH'; }).every(function (p) { return p.CanModifySchema !== true; }),
    contextExactlyThree: arraysEqual_(HEALTH_V5_SECURITY.validContexts, ['CLASSROOM', 'DUTY', 'DORM']),
    genericAuthError: genericAuthFailure_('G3-TEST', 'DETAIL').errorCode === 'AUTHENTICATION_FAILED',
    nationalIdMasked: maskNationalId_('1234567890123') === '*********0123',
    medicationFieldMask: Object.keys(maskFields_('TEACHER', 'MEDICATION_PLAN', { MedicineName: 'X', Dose: '1', NationalID: '123', PINHash: 'secret' })).every(function (field) {
      return ['MedicineName', 'Strength', 'Dose', 'MorningBeforeMeal', 'MorningAfterMeal', 'NoonBeforeMeal', 'NoonAfterMeal', 'EveningBeforeMeal', 'EveningAfterMeal', 'Bedtime', 'PRNInstruction', 'Route', 'Precaution'].indexOf(field) !== -1;
    }),
    otpPolicy: otpValues.expiryMinutes === 10 && otpValues.resendSeconds === 60 && otpValues.maxSends === 3,
    sessionPolicy: getSecurityConfigNumber_(spreadsheet, 'SESSION_MINUTES', 0) === 30 && getSecurityConfigNumber_(spreadsheet, 'IDLE_MINUTES', 0) === 15,
    lockoutPolicy: getSecurityConfigNumber_(spreadsheet, 'FAILED_ATTEMPT_LIMIT', 0) === 5 && getSecurityConfigNumber_(spreadsheet, 'LOCKOUT_MINUTES', 0) === 15,
    emailModeConfigured: ['LOG_ONLY', 'SEND'].indexOf(getEmailDeliveryMode_()) !== -1,
    backendContextScopeCheck: setTeacherContext.toString().indexOf('validateTeacherContextScope_') !== -1,
    saltedHashRoundTrip: testHash.length === 64 && constantTimeEqual_(testHash, secureHash_('DEV-G3-SECRET', 'DEV-G3-SALT')) && !constantTimeEqual_(testHash, secureHash_('WRONG', 'DEV-G3-SALT')),
    otpSingleUseContract: verifyOtp.toString().indexOf("deleteSecret_('PREAUTH'") !== -1,
    trustedDeviceTermExpiryContract: enrollTrustedDevice_.toString().indexOf('getTermEndDate_') !== -1,
    sessionAbsoluteAndIdleContract: requireSession_.toString().indexOf('absoluteExpiresAt') !== -1 && requireSession_.toString().indexOf('idleMinutes') !== -1,
  };
  return { passed: Object.keys(checks).every(function (key) { return checks[key] === true; }), checks: checks, otpValues: otpValues };
}
