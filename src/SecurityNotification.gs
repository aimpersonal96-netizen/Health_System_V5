function sendSecurityAlert(eventName, staffId, studentId, requestId) {
  var safeRequestId = requestId || createRequestId_();
  try {
    sendSecurityAlert_(eventName, staffId, studentId, safeRequestId);
    return createApiResult_(true, safeRequestId, { queued: true, mode: getEmailDeliveryMode_() });
  } catch (error) {
    console.error('sendSecurityAlert failed', safeRequestId, error);
    return createApiResult_(false, safeRequestId, null, 'SECURITY_ALERT_FAILED');
  }
}

function sendSecurityAlert_(eventName, staffId, studentId, requestId) {
  var allowedEvents = ['BREAK_GLASS_ACCESS', 'EXTERNAL_DATA_REQUEST', 'LOCKOUT', 'TRUSTED_DEVICE_ENROLLED', 'TRUSTED_DEVICE_REVOKED', 'STAFF_DATA_CHANGE_REQUEST', 'NATIONAL_ID_REVEALED'];
  if (allowedEvents.indexOf(eventName) === -1) throw new Error('UNSUPPORTED_SECURITY_EVENT');
  var payload = {
    Event: eventName, StaffID: String(staffId || ''), StudentID: String(studentId || ''),
    EventAt: new Date().toISOString(), RequestID: String(requestId),
  };
  var recipients = buildIntegrityCache_(SpreadsheetApp.getActiveSpreadsheet()).StaffDB.filter(function (staff) {
    return ['ADMIN', 'HEALTH'].indexOf(staff.RoleKey) !== -1 && staff.LoginEnabled === true && staff.RecordStatus === 'ACTIVE' && staff.Email;
  }).map(function (staff) { return staff.Email; });
  if (getEmailDeliveryMode_() !== 'SEND') {
    console.info('DEV security email suppressed', JSON.stringify(payload));
    return { recipients: recipients.length, mode: 'LOG_ONLY' };
  }
  if (!recipients.length) throw new Error('SECURITY_RECIPIENT_NOT_CONFIGURED');
  var body = Object.keys(payload).map(function (key) { return key + ': ' + payload[key]; }).join('\n');
  MailApp.sendEmail({ to: recipients.join(','), subject: '[Health V5] ' + eventName, body: body });
  return { recipients: recipients.length, mode: 'SEND' };
}
