function verifyStaffFirstUse(firstName, lastName, phone, roleKey, deviceReference) {
  var requestId = createRequestId_();
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  try {
    if (['TEACHER', 'EXECUTIVE'].indexOf(roleKey) === -1) return genericAuthFailure_(requestId, 'ROLE_INVALID');
    var matches = buildIntegrityCache_(spreadsheet).StaffDB.filter(function (staff) {
      return staff.RoleKey === roleKey && normalizeIdentityText_(staff.FirstName) === normalizeIdentityText_(firstName) &&
        normalizeIdentityText_(staff.LastName) === normalizeIdentityText_(lastName);
    });
    if (matches.length > 1) matches = matches.filter(function (staff) { return normalizeIdentityText_(staff.Phone) === normalizeIdentityText_(phone); });
    if (matches.length !== 1 || !isStaffEligible_(matches[0]) || isStaffLocked_(matches[0])) return genericAuthFailure_(requestId, 'STAFF_VERIFICATION_FAILED');
    var staff = matches[0];
    if (phone && normalizeIdentityText_(staff.Phone) !== normalizeIdentityText_(phone)) {
      sendSecurityAlert_('STAFF_DATA_CHANGE_REQUEST', staff.StaffID, '', requestId);
      return genericAuthFailure_(requestId, 'CONTACT_REVIEW_REQUIRED');
    }
    var enrolled = enrollTrustedDevice_(spreadsheet, staff, deviceReference);
    resetFailedAttempts_(spreadsheet, findStaffById_(staff.StaffID), true);
    sendSecurityAlert_('TRUSTED_DEVICE_ENROLLED', staff.StaffID, '', requestId);
    return createApiResult_(true, requestId, { device: enrolled.publicDevice, session: createSession_(findStaffById_(staff.StaffID), enrolled.deviceReferenceHash) });
  } catch (error) {
    console.error('verifyStaffFirstUse failed', requestId, error);
    return genericAuthFailure_(requestId, 'STAFF_VERIFICATION_FAILED');
  }
}

function enrollTrustedDevice_(spreadsheet, staff, deviceReference) {
  var token = randomToken_();
  var salt = Utilities.getUuid();
  var expiresAt = getTermEndDate_(spreadsheet);
  var payload = {
    tokenHash: secureHash_(token, salt),
    deviceReferenceHash: secureHash_(deviceReference || 'UNKNOWN_DEVICE', salt),
    expiresAt: expiresAt.toISOString(), enrolledAt: new Date().toISOString(), active: true,
  };
  repositoryUpdate_(spreadsheet, 'StaffDB', staff.StaffID, { PINHash: JSON.stringify(payload), PINSalt: salt }, staff.RowVersion, 'SYSTEM_DEVICE');
  return { publicDevice: { staffId: staff.StaffID, deviceToken: token, expiresAt: payload.expiresAt }, deviceReferenceHash: payload.deviceReferenceHash };
}

function validateTrustedDevice(staffId, deviceToken, deviceReference) {
  var requestId = createRequestId_();
  try {
    var staff = findStaffById_(staffId);
    if (!staff || !isStaffEligible_(staff) || isStaffLocked_(staff)) return genericAuthFailure_(requestId, 'DEVICE_INVALID');
    var payload = parseDevicePayload_(staff);
    var valid = payload && payload.active && new Date(payload.expiresAt).getTime() > Date.now() &&
      constantTimeEqual_(secureHash_(deviceToken, staff.PINSalt), payload.tokenHash) &&
      constantTimeEqual_(secureHash_(deviceReference || 'UNKNOWN_DEVICE', staff.PINSalt), payload.deviceReferenceHash);
    if (!valid) return genericAuthFailure_(requestId, 'DEVICE_INVALID');
    return createApiResult_(true, requestId, createSession_(staff, payload.deviceReferenceHash));
  } catch (error) {
    return genericAuthFailure_(requestId, 'DEVICE_INVALID');
  }
}

function enrollTrustedDevice(staffId, verificationToken, deviceReference) {
  var requestId = createRequestId_();
  try {
    var verification = getExpiringSecret_('DEVICE_VERIFY', verificationToken);
    if (!verification || verification.staffId !== staffId) return genericAuthFailure_(requestId, 'VERIFICATION_INVALID');
    var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    var staff = findStaffById_(staffId);
    var enrolled = enrollTrustedDevice_(spreadsheet, staff, deviceReference);
    deleteSecret_('DEVICE_VERIFY', verificationToken);
    return createApiResult_(true, requestId, enrolled.publicDevice);
  } catch (error) {
    return genericAuthFailure_(requestId, 'DEVICE_ENROLL_FAILED');
  }
}

function beginTrustedDeviceReplacement(staffId) {
  var requestId = createRequestId_();
  try {
    var staff = findStaffById_(staffId);
    if (!staff || ['TEACHER', 'EXECUTIVE'].indexOf(staff.RoleKey) === -1 || !isStaffEligible_(staff)) return genericAuthFailure_(requestId, 'STAFF_INVALID');
    var choices = ['LastName', 'Phone', 'Email'];
    var seed = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, requestId);
    var first = Math.abs(seed[0]) % choices.length;
    var second = (first + 1 + Math.abs(seed[1]) % (choices.length - 1)) % choices.length;
    var fields = [choices[first], choices[second]];
    var challengeId = Utilities.getUuid();
    putExpiringSecret_('DEVICE_CHANGE', challengeId, { staffId: staffId, fields: fields, attempts: 0 }, new Date(Date.now() + 10 * 60000));
    return createApiResult_(true, requestId, { challengeId: challengeId, fields: fields });
  } catch (error) {
    return genericAuthFailure_(requestId, 'DEVICE_CHANGE_FAILED');
  }
}

function replaceTrustedDevice(challengeId, answers, deviceReference) {
  var requestId = createRequestId_();
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  try {
    var challenge = getExpiringSecret_('DEVICE_CHANGE', challengeId);
    if (!challenge) return genericAuthFailure_(requestId, 'CHALLENGE_INVALID');
    var staff = findStaffById_(challenge.staffId);
    var correct = challenge.fields.every(function (field) {
      return normalizeIdentityText_(answers && answers[field]) === normalizeIdentityText_(staff[field]);
    });
    if (!correct) {
      challenge.attempts += 1;
      putExpiringSecret_('DEVICE_CHANGE', challengeId, challenge, new Date(challenge.expiresAt));
      if (challenge.fields.indexOf('Phone') !== -1 || challenge.fields.indexOf('Email') !== -1) {
        sendSecurityAlert_('STAFF_DATA_CHANGE_REQUEST', staff.StaffID, '', requestId);
      }
      registerFailedAttempt_(spreadsheet, staff, 'DEVICE_CHANGE', requestId);
      return genericAuthFailure_(requestId, 'ANSWERS_INVALID');
    }
    var enrolled = enrollTrustedDevice_(spreadsheet, staff, deviceReference);
    deleteSecret_('DEVICE_CHANGE', challengeId);
    sendSecurityAlert_('TRUSTED_DEVICE_REVOKED', staff.StaffID, '', requestId);
    sendSecurityAlert_('TRUSTED_DEVICE_ENROLLED', staff.StaffID, '', requestId);
    return createApiResult_(true, requestId, enrolled.publicDevice);
  } catch (error) {
    return genericAuthFailure_(requestId, 'DEVICE_CHANGE_FAILED');
  }
}

function revokeTrustedDevice(sessionId, sessionToken) {
  var requestId = createRequestId_();
  try {
    var session = requireSession_(sessionId, sessionToken, false);
    var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    var staff = findStaffById_(session.staffId);
    repositoryUpdate_(spreadsheet, 'StaffDB', staff.StaffID, { PINHash: '', PINSalt: '' }, staff.RowVersion, staff.StaffID);
    revokeSession_(sessionId);
    sendSecurityAlert_('TRUSTED_DEVICE_REVOKED', staff.StaffID, '', requestId);
    return createApiResult_(true, requestId, { revoked: true });
  } catch (error) {
    return createApiResult_(false, requestId, null, 'DEVICE_REVOKE_FAILED');
  }
}

function adminRevokeTrustedDevice(sessionId, sessionToken, targetStaffId, reason) {
  var requestId = createRequestId_();
  try {
    if (!reason) throw new Error('REASON_REQUIRED');
    var session = requireSession_(sessionId, sessionToken, true);
    authorizeResource_(session, 'USER_MANAGEMENT', 'UPDATE');
    var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    var staff = findStaffById_(targetStaffId);
    repositoryUpdate_(spreadsheet, 'StaffDB', staff.StaffID, { PINHash: '', PINSalt: '', Note: reason }, staff.RowVersion, session.staffId);
    sendSecurityAlert_('TRUSTED_DEVICE_REVOKED', staff.StaffID, '', requestId);
    return createApiResult_(true, requestId, { revoked: true, staffId: staff.StaffID });
  } catch (error) {
    return createApiResult_(false, requestId, null, 'DEVICE_REVOKE_FAILED');
  }
}

function parseDevicePayload_(staff) {
  try { return staff.PINHash ? JSON.parse(staff.PINHash) : null; } catch (error) { return null; }
}

function getTermEndDate_(spreadsheet) {
  var records = buildIntegrityCache_(spreadsheet).ConfigDB;
  var config = records.find(function (record) { return record.ConfigKey === 'TERM_END_DATE' && record.RecordStatus === 'ACTIVE'; });
  var date = config ? new Date(config.ConfigValue + 'T23:59:59+07:00') : null;
  if (!date || isNaN(date.getTime()) || date.getTime() <= Date.now()) throw new Error('TERM_END_DATE_INVALID');
  return date;
}
