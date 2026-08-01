function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Health V5 — DEV')
    .addItem('สร้าง/ตรวจฐานข้อมูล 20 ชีต', 'runFoundationSetupFromMenu')
    .addItem('ตรวจสอบ Foundation', 'runFoundationAuditFromMenu')
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
