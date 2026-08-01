function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Health V5 — DEV')
    .addItem('สร้าง/ตรวจฐานข้อมูล 20 ชีต', 'runFoundationSetupFromMenu')
    .addItem('ตรวจสอบ Foundation', 'runFoundationAuditFromMenu')
    .addSeparator()
    .addItem('G2: สร้างข้อมูลจำลอง', 'runMockDataSeedFromMenu')
    .addItem('G2: ตรวจ Data Integrity', 'runDataIntegrityAuditFromMenu')
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
