function configureG3DevelopmentAccounts_(adminEmail, healthEmail) {
  if (!isValidTestEmail_(adminEmail) || !isValidTestEmail_(healthEmail)) throw new Error('INVALID_TEST_EMAIL');
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var accounts = [
    { staffId: 'STF-DEV-ADMIN-01', email: adminEmail, username: 'dev.admin', role: 'ADMIN' },
    { staffId: 'STF-DEV-HEALTH-01', email: healthEmail, username: 'dev.health', role: 'HEALTH' },
  ];
  var result = [];
  accounts.forEach(function (account) {
    var staff = findStaffById_(account.staffId);
    if (!staff || staff.RoleKey !== account.role) throw new Error('DEV_STAFF_NOT_FOUND:' + account.staffId);
    var temporaryPin = randomNumericCode_(8);
    var salt = Utilities.getUuid();
    repositoryUpdate_(spreadsheet, 'StaffDB', staff.StaffID, {
      Email: String(account.email).trim(), Username: account.username,
      PINHash: secureHash_(temporaryPin, salt), PINSalt: salt,
      LoginEnabled: true, FailedLoginCount: 0, LockedUntil: '',
      Note: 'DEV Email OTP test account — remove after G3 acceptance',
    }, staff.RowVersion, 'SYSTEM_G3_SETUP');
    result.push({ role: account.role, username: account.username, temporaryPin: temporaryPin, email: account.email });
  });
  setEmailDeliveryMode_('SEND');
  MailApp.sendEmail({
    to: accounts.map(function (account) { return account.email; }).join(','),
    subject: '[Health V5 DEV] Email delivery test',
    body: 'ระบบ Health V5 DEV ส่งอีเมลทดสอบสำเร็จ\nไม่มีข้อมูลนักเรียนอยู่ในอีเมลนี้',
  });
  return result;
}

function resetG3DevelopmentAccounts_() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  [
    { staffId: 'STF-DEV-ADMIN-01', email: 'admin.health-v5@example.invalid' },
    { staffId: 'STF-DEV-HEALTH-01', email: 'health.health-v5@example.invalid' },
  ].forEach(function (account) {
    var staff = findStaffById_(account.staffId);
    repositoryUpdate_(spreadsheet, 'StaffDB', staff.StaffID, {
      Email: account.email, PINHash: '', PINSalt: '', LoginEnabled: false,
      FailedLoginCount: 0, LockedUntil: '', Note: 'ข้อมูลสมมติสำหรับ DEV เท่านั้น',
    }, staff.RowVersion, 'SYSTEM_G3_RESET');
  });
  setEmailDeliveryMode_('LOG_ONLY');
}

function isValidTestEmail_(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim()) && String(value).indexOf('example.invalid') === -1;
}
