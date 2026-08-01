function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Health V5 — DEV')
    .addItem('สร้าง/ตรวจฐานข้อมูล 20 ชีต', 'runFoundationSetupFromMenu')
    .addItem('ตรวจสอบ Foundation', 'runFoundationAuditFromMenu')
    .addSeparator()
    .addItem('G2: สร้างข้อมูลจำลอง', 'runMockDataSeedFromMenu')
    .addItem('G2: ตรวจ Data Integrity', 'runDataIntegrityAuditFromMenu')
    .addSeparator()
    .addItem('G3: ตั้งค่าทดสอบ Email OTP', 'setupG3EmailTestFromMenu')
    .addItem('G3: ทดสอบ Login และ Email OTP', 'testG3EmailOtpFromMenu')
    .addItem('G3: ทดสอบ Trusted Device', 'testG3TrustedDeviceFromMenu')
    .addItem('G3: ซ่อมค่าตาม Blueprint', 'repairG3ContractsFromMenu')
    .addItem('G3: ตรวจ Security Contracts', 'runG3SecurityAuditFromMenu')
    .addItem('G3: ล้างบัญชีอีเมลทดสอบ', 'resetG3EmailTestFromMenu')
    .addToUi();
}

function runFoundationSetupFromMenu() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  spreadsheet.toast('กำลังสร้างและตรวจฐานข้อมูล กรุณารอสักครู่…', 'Health V5 — DEV', -1);
  var result = setupDevelopmentDatabase();
  if (result.success) {
    spreadsheet.toast('สร้างฐานข้อมูลสำเร็จ: 20 ชีต และ Foundation Audit ผ่าน', 'Health V5 — DEV', 10);
  } else {
    SpreadsheetApp.getUi().alert('สร้างฐานข้อมูลไม่สำเร็จ\nError code: ' + result.errorCode + '\nRequest ID: ' + result.requestId);
  }
}

function runFoundationAuditFromMenu() {
  var result = runFoundationAudit();
  if (result.success) {
    SpreadsheetApp.getUi().alert(
      'Foundation Audit ผ่าน\nจำนวนชีต: ' + result.data.sheetCount +
      '\nจำนวนคอลัมน์รวม: ' + result.data.totalFieldCount +
      '\nSchema: v' + result.data.schemaVersion
    );
  } else {
    SpreadsheetApp.getUi().alert('Foundation Audit ไม่ผ่าน\nError code: ' + result.errorCode + '\nRequest ID: ' + result.requestId);
  }
}

function runMockDataSeedFromMenu() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  spreadsheet.toast('กำลังสร้างข้อมูลจำลองและตรวจความถูกต้อง…', 'Health V5 — DEV', -1);
  var result = seedMockData();
  if (result.success) {
    spreadsheet.toast('สร้างข้อมูลจำลองสำเร็จ และ G2 Data Integrity ผ่าน', 'Health V5 — DEV', 10);
  } else {
    SpreadsheetApp.getUi().alert('สร้างข้อมูลจำลองไม่สำเร็จ\nError code: ' + result.errorCode + '\nRequest ID: ' + result.requestId);
  }
}

function runDataIntegrityAuditFromMenu() {
  var result = runDataIntegrityAudit();
  if (result.success) {
    SpreadsheetApp.getUi().alert(
      'G2 Data Integrity ผ่าน\nจำนวนระเบียนที่ตรวจ: ' + result.data.audit.totalRecords +
      '\nข้อผิดพลาด: ' + result.data.audit.errorCount +
      '\nPK/FK, Soft delete และ RowVersion: ผ่าน'
    );
  } else {
    var diagnostic = buildG2Diagnostic_();
    SpreadsheetApp.getUi().alert(
      'G2 Data Integrity ไม่ผ่าน\nError code: ' + result.errorCode +
      '\nRequest ID: ' + result.requestId +
      '\n\nผลวินิจฉัย (ไม่แสดงค่าข้อมูล):\n' + diagnostic
    );
  }
}

function buildG2Diagnostic_() {
  try {
    var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    var audit = auditDataIntegrity_(spreadsheet);
    var controls = runG2ControlTests_(spreadsheet);
    var lines = [];
    audit.errors.slice(0, 8).forEach(function (error) {
      lines.push([
        error.code || 'UNKNOWN',
        error.sheet || '-',
        error.field || (error.fields ? error.fields.join('+') : '-'),
        'row ' + (error.row || '-'),
      ].join(' | '));
    });
    Object.keys(controls.tests).forEach(function (testName) {
      if (!controls.tests[testName]) lines.push('CONTROL_FAILED | ' + testName);
    });
    return lines.length ? lines.join('\n') : 'ไม่พบข้อผิดพลาดระดับระเบียน กรุณาส่ง Request ID ให้ผู้พัฒนา';
  } catch (error) {
    return 'DIAGNOSTIC_ERROR | ' + String(error && error.message ? error.message : error).slice(0, 200);
  }
}

function runG3SecurityAuditFromMenu() {
  var result = runG3SecurityAudit();
  if (result.success) {
    SpreadsheetApp.getUi().alert('G3 Security Contract Audit ผ่าน\nAuth/OTP/Session/Trusted Device/Permission/Field mask: ผ่าน\nDEV Email mode: ' + getEmailDeliveryMode_());
  } else {
    var diagnostic = buildG3Diagnostic_();
    SpreadsheetApp.getUi().alert('G3 Security Contract Audit ไม่ผ่าน\nError code: ' + result.errorCode + '\nRequest ID: ' + result.requestId + '\n\nผลวินิจฉัย:\n' + diagnostic);
  }
}

function buildG3Diagnostic_() {
  try {
    var tests = runG3ContractTests_(SpreadsheetApp.getActiveSpreadsheet());
    var failed = Object.keys(tests.checks).filter(function (name) { return tests.checks[name] !== true; });
    return failed.length ? failed.join('\n') : 'ไม่พบ Contract ที่ล้มเหลว';
  } catch (error) {
    return 'DIAGNOSTIC_ERROR: ' + String(error && error.message ? error.message : error).slice(0, 160);
  }
}

function setupG3EmailTestFromMenu() {
  var ui = SpreadsheetApp.getUi();
  var adminPrompt = ui.prompt('G3 Email OTP — ADMIN', 'กรอกอีเมลส่วนตัวสำหรับบัญชี ADMIN ทดสอบ', ui.ButtonSet.OK_CANCEL);
  if (adminPrompt.getSelectedButton() !== ui.Button.OK) return;
  var healthPrompt = ui.prompt('G3 Email OTP — HEALTH', 'กรอกอีเมลส่วนตัวอีกบัญชีสำหรับ HEALTH ทดสอบ', ui.ButtonSet.OK_CANCEL);
  if (healthPrompt.getSelectedButton() !== ui.Button.OK) return;
  try {
    var accounts = configureG3DevelopmentAccounts_(adminPrompt.getResponseText(), healthPrompt.getResponseText());
    var message = ['ตั้งค่าและส่งอีเมลทดสอบแล้ว', 'เก็บ PIN นี้ชั่วคราว หน้าต่างจะแสดงเพียงครั้งเดียว', ''];
    accounts.forEach(function (account) {
      message.push(account.role + ' — Username: ' + account.username + ' — PIN: ' + account.temporaryPin);
    });
    ui.alert(message.join('\n'));
  } catch (error) {
    ui.alert('ตั้งค่าทดสอบไม่สำเร็จ\nError: ' + String(error && error.message ? error.message : error).slice(0, 160));
  }
}

function resetG3EmailTestFromMenu() {
  var ui = SpreadsheetApp.getUi();
  var answer = ui.alert('ล้างบัญชีอีเมลทดสอบ?', 'อีเมลจริงและ PIN ทดสอบจะถูกลบออกจาก StaffDB และกลับเป็น LOG_ONLY', ui.ButtonSet.YES_NO);
  if (answer !== ui.Button.YES) return;
  try {
    resetG3DevelopmentAccounts_();
    ui.alert('ล้างอีเมลและ PIN ทดสอบเรียบร้อยแล้ว');
  } catch (error) {
    ui.alert('ล้างบัญชีทดสอบไม่สำเร็จ');
  }
}

function testG3EmailOtpFromMenu() {
  var ui = SpreadsheetApp.getUi();
  var usernamePrompt = ui.prompt('ทดสอบ Login', 'กรอก Username ทดสอบ เช่น dev.admin', ui.ButtonSet.OK_CANCEL);
  if (usernamePrompt.getSelectedButton() !== ui.Button.OK) return;
  var pinPrompt = ui.prompt('ทดสอบ Login', 'กรอก PIN ชั่วคราวจากขั้นตั้งค่า', ui.ButtonSet.OK_CANCEL);
  if (pinPrompt.getSelectedButton() !== ui.Button.OK) return;
  var login = loginStaff(usernamePrompt.getResponseText(), pinPrompt.getResponseText());
  if (!login.success) { ui.alert('Login ขั้นแรกไม่ผ่าน\nRequest ID: ' + login.requestId); return; }
  var sent = sendOtp(login.data.challengeId);
  if (!sent.success) { ui.alert('ส่ง OTP ไม่สำเร็จ\nError: ' + sent.errorCode + '\nRequest ID: ' + sent.requestId); return; }
  var otpPrompt = ui.prompt('ตรวจอีเมล ' + sent.data.maskedEmail, 'กรอกรหัส OTP 6 หลักที่ได้รับ', ui.ButtonSet.OK_CANCEL);
  if (otpPrompt.getSelectedButton() !== ui.Button.OK) return;
  var verified = verifyOtp(login.data.challengeId, otpPrompt.getResponseText());
  if (!verified.success) { ui.alert('OTP ไม่ผ่าน\nRequest ID: ' + verified.requestId); return; }
  ui.alert('Login + Email OTP + Session ผ่าน\nRole: ' + usernamePrompt.getResponseText() + '\nSession อายุ: ' + verified.data.expiresInSeconds + ' วินาที');
}

function testG3TrustedDeviceFromMenu() {
  var ui = SpreadsheetApp.getUi();
  try {
    var deviceReference = 'DEV-G3-MENU-DEVICE';
    var firstUse = verifyStaffFirstUse('สมชาย', 'ใจดี', '0000000101', 'TEACHER', deviceReference);
    if (!firstUse.success) throw new Error('FIRST_USE_FAILED:' + firstUse.requestId);
    var device = firstUse.data.device;
    var trusted = validateTrustedDevice(device.staffId, device.deviceToken, deviceReference);
    if (!trusted.success) throw new Error('DEVICE_VALIDATION_FAILED:' + trusted.requestId);
    var context = setTeacherContext(trusted.data.sessionId, trusted.data.sessionToken, { type: 'CLASSROOM', scopeId: 'CLS-DEV-01' });
    if (!context.success) throw new Error('CONTEXT_FAILED:' + context.requestId);
    var revoked = revokeTrustedDevice(trusted.data.sessionId, trusted.data.sessionToken);
    if (!revoked.success) throw new Error('REVOKE_FAILED:' + revoked.requestId);
    ui.alert('Trusted Device ผ่าน\nFirst-use verification: ผ่าน\nCLASSROOM scope: ผ่าน\nSelf revoke: ผ่าน');
  } catch (error) {
    ui.alert('Trusted Device Test ไม่ผ่าน\n' + String(error && error.message ? error.message : error).slice(0, 180));
  }
}

function repairG3ContractsFromMenu() {
  var ui = SpreadsheetApp.getUi();
  try {
    var repaired = repairG3LockedContracts_();
    ui.alert('ซ่อมค่าตาม Blueprint สำเร็จ\nConfig ที่แก้: ' + repaired.config + '\nPermission ที่แก้: ' + repaired.permissions);
  } catch (error) {
    ui.alert('ซ่อมค่าไม่สำเร็จ\n' + String(error && error.message ? error.message : error).slice(0, 180));
  }
}
