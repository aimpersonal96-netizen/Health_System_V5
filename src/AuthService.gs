function loginStaff(username, pin) {
  var requestId = createRequestId_();
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  try {
    var staff = findSingleStaff_(function (record) {
      return normalizeIdentityText_(record.Username) === normalizeIdentityText_(username);
    });
    if (!staff || ['ADMIN', 'HEALTH'].indexOf(staff.RoleKey) === -1 || !isStaffEligible_(staff) || !staff.Email) {
      return genericAuthFailure_(requestId, 'INVALID_ACCOUNT');
    }
    if (isStaffLocked_(staff)) return genericAuthFailure_(requestId, 'LOCKED');
    if (!staff.PINHash || !staff.PINSalt || !constantTimeEqual_(secureHash_(pin, staff.PINSalt), staff.PINHash)) {
      registerFailedAttempt_(spreadsheet, staff, 'CREDENTIAL', requestId);
      return genericAuthFailure_(requestId, 'INVALID_CREDENTIAL');
    }
    resetFailedAttempts_(spreadsheet, staff);
    var challengeId = Utilities.getUuid();
    var expiry = new Date(Date.now() + getSecurityConfigNumber_(spreadsheet, 'OTP_EXPIRY_MINUTES', 10) * 60000);
    putExpiringSecret_('PREAUTH', challengeId, { staffId: staff.StaffID, sendCount: 0, windowStartedAt: new Date().toISOString() }, expiry);
    return createApiResult_(true, requestId, { challengeId: challengeId, maskedEmail: maskContact_(staff.Email), next: 'SEND_OTP' });
  } catch (error) {
    console.error('loginStaff failed', requestId, error);
    return genericAuthFailure_(requestId, 'INTERNAL');
  }
}

function sendOtp(challengeId) {
  var requestId = createRequestId_();
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  try {
    var preauth = getExpiringSecret_('PREAUTH', challengeId);
    if (!preauth) return genericAuthFailure_(requestId, 'CHALLENGE_INVALID');
    var staff = findStaffById_(preauth.staffId);
    if (!staff || !isStaffEligible_(staff)) return genericAuthFailure_(requestId, 'ACCOUNT_INACTIVE');
    var now = Date.now();
    var resendSeconds = getSecurityConfigNumber_(spreadsheet, 'OTP_RESEND_SECONDS', 60);
    var maxSends = getSecurityConfigNumber_(spreadsheet, 'OTP_MAX_SENDS', 3);
    var windowMinutes = getSecurityConfigNumber_(spreadsheet, 'OTP_WINDOW_MINUTES', 15);
    if (preauth.lastSentAt && now - new Date(preauth.lastSentAt).getTime() < resendSeconds * 1000) return createApiResult_(false, requestId, null, 'OTP_RESEND_TOO_SOON');
    if (now - new Date(preauth.windowStartedAt).getTime() >= windowMinutes * 60000) {
      preauth.windowStartedAt = new Date(now).toISOString(); preauth.sendCount = 0;
    }
    if (preauth.sendCount >= maxSends) return createApiResult_(false, requestId, null, 'OTP_RATE_LIMITED');
    var otp = randomNumericCode_(HEALTH_V5_SECURITY.otpDigits);
    var salt = Utilities.getUuid();
    preauth.otpHash = secureHash_(otp, salt); preauth.otpSalt = salt;
    preauth.lastSentAt = new Date(now).toISOString(); preauth.sendCount += 1; preauth.otpAttempts = 0;
    var expiry = new Date(now + getSecurityConfigNumber_(spreadsheet, 'OTP_EXPIRY_MINUTES', 10) * 60000);
    putExpiringSecret_('PREAUTH', challengeId, preauth, expiry);
    deliverOtp_(staff, otp, requestId);
    return createApiResult_(true, requestId, { maskedEmail: maskContact_(staff.Email), expiresInSeconds: Math.round((expiry.getTime() - now) / 1000), deliveryMode: getEmailDeliveryMode_() });
  } catch (error) {
    console.error('sendOtp failed', requestId, error);
    return createApiResult_(false, requestId, null, 'OTP_SEND_FAILED');
  }
}

function verifyOtp(challengeId, otp) {
  var requestId = createRequestId_();
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  try {
    var preauth = getExpiringSecret_('PREAUTH', challengeId);
    if (!preauth || !preauth.otpHash) return genericAuthFailure_(requestId, 'OTP_INVALID');
    var staff = findStaffById_(preauth.staffId);
    if (!staff || isStaffLocked_(staff)) return genericAuthFailure_(requestId, 'ACCOUNT_INVALID');
    if (!constantTimeEqual_(secureHash_(otp, preauth.otpSalt), preauth.otpHash)) {
      preauth.otpAttempts = Number(preauth.otpAttempts || 0) + 1;
      putExpiringSecret_('PREAUTH', challengeId, preauth, new Date(preauth.expiresAt));
      registerFailedAttempt_(spreadsheet, staff, 'OTP', requestId);
      return genericAuthFailure_(requestId, 'OTP_MISMATCH');
    }
    deleteSecret_('PREAUTH', challengeId);
    resetFailedAttempts_(spreadsheet, staff, true);
    return createApiResult_(true, requestId, createSession_(staff, 'CREDENTIAL_OTP'));
  } catch (error) {
    console.error('verifyOtp failed', requestId, error);
    return genericAuthFailure_(requestId, 'INTERNAL');
  }
}

function deliverOtp_(staff, otp, requestId) {
  if (getEmailDeliveryMode_() !== 'SEND') {
    console.info('DEV OTP delivery suppressed', requestId, staff.StaffID);
    return;
  }
  MailApp.sendEmail({ to: staff.Email, subject: 'Health V5 verification code', body: 'รหัสยืนยัน Health V5: ' + otp + '\nรหัสนี้มีอายุ 10 นาที' });
}

function findSingleStaff_(predicate) {
  var records = buildIntegrityCache_(SpreadsheetApp.getActiveSpreadsheet()).StaffDB.filter(predicate);
  return records.length === 1 ? records[0] : null;
}

function findStaffById_(staffId) {
  return findSingleStaff_(function (record) { return String(record.StaffID) === String(staffId); });
}

function isStaffEligible_(staff) {
  return staff.RecordStatus === 'ACTIVE' && staff.LoginEnabled === true;
}

function isStaffLocked_(staff) {
  return staff.LockedUntil && new Date(staff.LockedUntil).getTime() > Date.now();
}

function registerFailedAttempt_(spreadsheet, staff, verificationType, requestId) {
  var limit = getSecurityConfigNumber_(spreadsheet, 'FAILED_ATTEMPT_LIMIT', 5);
  var count = Number(staff.FailedLoginCount || 0) + 1;
  var patch = { FailedLoginCount: count };
  if (count >= limit) patch.LockedUntil = new Date(Date.now() + getSecurityConfigNumber_(spreadsheet, 'LOCKOUT_MINUTES', 15) * 60000).toISOString();
  repositoryUpdate_(spreadsheet, 'StaffDB', staff.StaffID, patch, staff.RowVersion, 'SYSTEM_AUTH');
  if (count >= limit) sendSecurityAlert_('LOCKOUT', staff.StaffID, '', requestId);
}

function resetFailedAttempts_(spreadsheet, staff, updateLastLogin) {
  var patch = { FailedLoginCount: 0, LockedUntil: '' };
  if (updateLastLogin) patch.LastLoginAt = new Date();
  repositoryUpdate_(spreadsheet, 'StaffDB', staff.StaffID, patch, staff.RowVersion, 'SYSTEM_AUTH');
}
