var HEALTH_V5_SECURITY = Object.freeze({
  propertyPrefix: 'HV5_',
  otpDigits: 6,
  hashRounds: 2500,
  devEmailMode: 'LOG_ONLY',
  validContexts: ['CLASSROOM', 'DUTY', 'DORM'],
});

function secureHash_(secret, salt) {
  var value = String(salt) + ':' + String(secret);
  for (var round = 0; round < HEALTH_V5_SECURITY.hashRounds; round += 1) {
    var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value, Utilities.Charset.UTF_8);
    value = digest.map(function (byte) {
      var normalized = byte < 0 ? byte + 256 : byte;
      return ('0' + normalized.toString(16)).slice(-2);
    }).join('');
  }
  return value;
}

function constantTimeEqual_(left, right) {
  left = String(left || '');
  right = String(right || '');
  var difference = left.length ^ right.length;
  var length = Math.max(left.length, right.length);
  for (var index = 0; index < length; index += 1) {
    difference |= (left.charCodeAt(index % Math.max(left.length, 1)) || 0) ^
      (right.charCodeAt(index % Math.max(right.length, 1)) || 0);
  }
  return difference === 0;
}

function randomToken_() {
  return Utilities.getUuid() + Utilities.getUuid().replace(/-/g, '');
}

function randomNumericCode_(digits) {
  var maximum = Math.pow(10, digits);
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, randomToken_());
  var number = 0;
  for (var index = 0; index < 6; index += 1) number = (number * 256 + (bytes[index] < 0 ? bytes[index] + 256 : bytes[index])) % maximum;
  return ('0000000000' + number).slice(-digits);
}

function securityPropertyKey_(type, id) {
  return HEALTH_V5_SECURITY.propertyPrefix + type + '_' + String(id);
}

function getEmailDeliveryMode_() {
  return PropertiesService.getScriptProperties().getProperty(securityPropertyKey_('CONFIG', 'EMAIL_MODE')) || HEALTH_V5_SECURITY.devEmailMode;
}

function setEmailDeliveryMode_(mode) {
  if (['LOG_ONLY', 'SEND'].indexOf(mode) === -1) throw new Error('INVALID_EMAIL_MODE');
  PropertiesService.getScriptProperties().setProperty(securityPropertyKey_('CONFIG', 'EMAIL_MODE'), mode);
}

function putExpiringSecret_(type, id, payload, expiresAt) {
  var stored = Object.assign({}, payload, { expiresAt: expiresAt.toISOString() });
  PropertiesService.getScriptProperties().setProperty(securityPropertyKey_(type, id), JSON.stringify(stored));
}

function getExpiringSecret_(type, id) {
  var raw = PropertiesService.getScriptProperties().getProperty(securityPropertyKey_(type, id));
  if (!raw) return null;
  var payload = JSON.parse(raw);
  if (!payload.expiresAt || new Date(payload.expiresAt).getTime() <= Date.now()) {
    deleteSecret_(type, id);
    return null;
  }
  return payload;
}

function deleteSecret_(type, id) {
  PropertiesService.getScriptProperties().deleteProperty(securityPropertyKey_(type, id));
}

function getSecurityConfigNumber_(spreadsheet, key, fallback) {
  var sheet = spreadsheet.getSheetByName('ConfigDB');
  var schema = getCanonicalSchema_('ConfigDB');
  var rows = buildIntegrityCache_(spreadsheet).ConfigDB;
  var match = rows.find(function (record) { return record.ConfigKey === key && record.RecordStatus === 'ACTIVE'; });
  return match && isFinite(Number(match.ConfigValue)) ? Number(match.ConfigValue) : fallback;
}

function genericAuthFailure_(requestId, code) {
  console.warn('Authentication rejected', requestId, code);
  return createApiResult_(false, requestId, null, 'AUTHENTICATION_FAILED');
}

function normalizeIdentityText_(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('th-TH');
}

function maskContact_(value) {
  value = String(value || '');
  if (!value) return '';
  if (value.indexOf('@') !== -1) {
    var parts = value.split('@');
    return parts[0].slice(0, 2) + '***@' + parts[1];
  }
  return '*'.repeat(Math.max(0, value.length - 3)) + value.slice(-3);
}
