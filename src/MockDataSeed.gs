function seedMockData() {
  var requestId = createRequestId_();
  try {
    var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    if (!spreadsheet) throw new Error('BOUND_SPREADSHEET_REQUIRED');
    var summary = {};
    var compactedRows = compactDevRecords_(spreadsheet);
    var normalizedCells = normalizeCanonicalStoredTypes_(spreadsheet);
    var batches = buildMockDataBatches_();
    ['StaffDB', 'ClassroomDB', 'DormDB', 'StudentDB', 'StudentDormHistoryDB', 'DutyDB', 'AssignmentDB', 'DrugDB'].forEach(function (sheetName) {
      var missing = filterMissingMockRecords_(spreadsheet, sheetName, batches[sheetName]);
      summary[sheetName] = missing.length ? repositoryCreateBatch_(spreadsheet, sheetName, missing, HEALTH_V5_AUDIT_ACTOR).created : 0;
    });
    var controlTests = runG2ControlTests_(spreadsheet);
    var audit = auditDataIntegrity_(spreadsheet);
    if (!audit.passed || !controlTests.passed) throw new Error('G2_AUDIT_FAILED');
    return createApiResult_(true, requestId, { compactedRows: compactedRows, normalizedCells: normalizedCells, seededRows: summary, controlTests: controlTests, audit: audit });
  } catch (error) {
    console.error('seedMockData failed', requestId, error);
    return createApiResult_(false, requestId, null, mapG2Error_(error));
  }
}

function buildMockDataBatches_() {
  var mockNote = 'ข้อมูลสมมติสำหรับ DEV เท่านั้น';
  return {
    StaffDB: [
      { StaffID: 'STF-DEV-ADMIN-01', Prefix: 'นางสาว', FirstName: 'ผู้ดูแล', LastName: 'ระบบจำลอง', DisplayName: 'ผู้ดูแลระบบจำลอง', Position: 'ผู้ดูแลระบบ', Department: 'DEV', Phone: '0000000001', Email: 'admin.health-v5@example.invalid', Username: 'dev.admin', RoleKey: 'ADMIN', LoginEnabled: false, FailedLoginCount: 0, Note: mockNote },
      { StaffID: 'STF-DEV-HEALTH-01', Prefix: 'นางสาว', FirstName: 'อนามัย', LastName: 'ทดสอบ', DisplayName: 'ครูอนามัยทดสอบ', Position: 'ครูงานอนามัย', Department: 'งานอนามัย', Phone: '0000000002', Email: 'health.health-v5@example.invalid', Username: 'dev.health', RoleKey: 'HEALTH', LoginEnabled: false, FailedLoginCount: 0, Note: mockNote },
      { StaffID: 'STF-DEV-TEACHER-01', Prefix: 'นาย', FirstName: 'สมชาย', LastName: 'ใจดี', DisplayName: 'ครูสมชาย ใจดี (ก)', Position: 'ครูประจำชั้น', Department: 'วิชาการ', Phone: '0000000101', Email: 'teacher01@example.invalid', RoleKey: 'TEACHER', LoginEnabled: true, FailedLoginCount: 0, Note: mockNote + ' • กรณีชื่อซ้ำคนที่ 1' },
      { StaffID: 'STF-DEV-TEACHER-02', Prefix: 'นาย', FirstName: 'สมชาย', LastName: 'ใจดี', DisplayName: 'ครูสมชาย ใจดี (ข)', Position: 'ครูหอนอน', Department: 'กิจการนักเรียน', Phone: '0000000102', Email: 'teacher02.changed@example.invalid', RoleKey: 'TEACHER', LoginEnabled: true, FailedLoginCount: 0, Note: mockNote + ' • กรณีชื่อซ้ำคนที่ 2/ข้อมูลติดต่อเปลี่ยน' },
      { StaffID: 'STF-DEV-TEACHER-03', Prefix: 'นางสาว', FirstName: 'สายใจ', LastName: 'ดูแลดี', DisplayName: 'ครูสายใจ ดูแลดี', Position: 'ครูเวร', Department: 'กิจการนักเรียน', Phone: '0000000103', Email: 'teacher03@example.invalid', RoleKey: 'TEACHER', LoginEnabled: true, FailedLoginCount: 0, Note: mockNote },
      { StaffID: 'STF-DEV-EXEC-01', Prefix: 'นาง', FirstName: 'บริหาร', LastName: 'ภาพรวม', DisplayName: 'ผู้บริหารภาพรวม', Position: 'ผู้บริหาร', Department: 'บริหาร', Phone: '0000000201', Email: 'executive@example.invalid', RoleKey: 'EXECUTIVE', LoginEnabled: true, FailedLoginCount: 0, Note: mockNote },
    ],
    ClassroomDB: [
      { ClassroomID: 'CLS-DEV-01', DisabilityType: 'การเรียนรู้', GradeLevel: 'ป.1', ClassroomName: 'ห้องเรียนจำลอง 1', AcademicYear: 2569, SortOrder: 1, HomeroomStaffID: 'STF-DEV-TEACHER-01', Note: mockNote },
      { ClassroomID: 'CLS-DEV-02', DisabilityType: 'ออทิสติก', GradeLevel: 'ป.2', ClassroomName: 'ห้องเรียนจำลอง 2', AcademicYear: 2569, SortOrder: 2, HomeroomStaffID: 'STF-DEV-TEACHER-02', Note: mockNote },
    ],
    DormDB: [
      { DormID: 'DORM-DEV-01', DormCode: 'DEV-D01', DormName: 'หอนอนจำลองชาย', GenderGroup: 'MALE', DisabilityGroup: 'ผสม', Capacity: 20, Note: mockNote },
      { DormID: 'DORM-DEV-02', DormCode: 'DEV-D02', DormName: 'หอนอนจำลองหญิง', GenderGroup: 'FEMALE', DisabilityGroup: 'ผสม', Capacity: 20, Note: mockNote },
    ],
    StudentDB: [
      { StudentID: 'STD-DEV-001', StudentCode: 'DEV-S001', Prefix: 'เด็กชาย', FirstName: 'ทดลอง', LastName: 'หนึ่ง', DisplayName: 'เด็กชายทดลอง หนึ่ง', ClassroomID: 'CLS-DEV-01', DisabilityType: 'การเรียนรู้', Gender: 'MALE', BirthDate: new Date('2018-01-15T00:00:00+07:00'), NationalID: 'DEV-NID-0001', GuardianName: 'ผู้ปกครองจำลอง หนึ่ง', GuardianPhone: '0000010001', MedicalConditionSummary: 'ไม่มีโรคประจำตัว (ข้อมูลสมมติ)', DrugAllergy: 'ไม่ทราบ', CriticalAlert: '', StudentStatus: 'ACTIVE_STUDENT', Note: mockNote },
      { StudentID: 'STD-DEV-002', StudentCode: 'DEV-S002', Prefix: 'เด็กหญิง', FirstName: 'ทดลอง', LastName: 'สอง', DisplayName: 'เด็กหญิงทดลอง สอง', ClassroomID: 'CLS-DEV-01', DisabilityType: 'การเรียนรู้', Gender: 'FEMALE', BirthDate: new Date('2018-05-20T00:00:00+07:00'), NationalID: 'DEV-NID-0002', GuardianName: 'ผู้ปกครองจำลอง สอง', GuardianPhone: '0000010002', MedicalConditionSummary: 'โรคหอบหืด (ข้อมูลสมมติ)', DrugAllergy: 'แพ้ยาจำลอง A', CriticalAlert: 'พกยาพ่นจำลอง', StudentStatus: 'ACTIVE_STUDENT', Note: mockNote },
      { StudentID: 'STD-DEV-003', StudentCode: 'DEV-S003', Prefix: 'เด็กชาย', FirstName: 'ตัวอย่าง', LastName: 'สาม', DisplayName: 'เด็กชายตัวอย่าง สาม', ClassroomID: 'CLS-DEV-02', DisabilityType: 'ออทิสติก', Gender: 'MALE', BirthDate: new Date('2017-09-10T00:00:00+07:00'), NationalID: 'DEV-NID-0003', GuardianName: 'ผู้ปกครองจำลอง สาม', GuardianPhone: '0000010003', MedicalConditionSummary: 'สมาธิสั้น (ข้อมูลสมมติ)', DrugAllergy: 'ไม่มีข้อมูล', CriticalAlert: '', StudentStatus: 'ACTIVE_STUDENT', Note: mockNote },
      { StudentID: 'STD-DEV-004', StudentCode: 'DEV-S004', Prefix: 'เด็กหญิง', FirstName: 'ตัวอย่าง', LastName: 'สี่', DisplayName: 'เด็กหญิงตัวอย่าง สี่', ClassroomID: 'CLS-DEV-02', DisabilityType: 'ออทิสติก', Gender: 'FEMALE', BirthDate: new Date('2017-11-03T00:00:00+07:00'), NationalID: 'DEV-NID-0004', GuardianName: 'ผู้ปกครองจำลอง สี่', GuardianPhone: '0000010004', MedicalConditionSummary: 'ลมชัก (ข้อมูลสมมติ)', DrugAllergy: 'ไม่ทราบ', CriticalAlert: 'มีแผนยาประจำตัวจำลอง', StudentStatus: 'ACTIVE_STUDENT', Note: mockNote },
    ],
    StudentDormHistoryDB: [
      { StudentDormHistoryID: 'SDH-DEV-001', StudentID: 'STD-DEV-001', DormID: 'DORM-DEV-01', StartsOn: new Date('2026-05-01T00:00:00+07:00'), ChangeType: 'NEW', IsCurrent: true, Reason: 'เข้าหอนอนภาคเรียนจำลอง', RecordedByStaffID: 'STF-DEV-HEALTH-01', Note: mockNote },
      { StudentDormHistoryID: 'SDH-DEV-002', StudentID: 'STD-DEV-002', DormID: 'DORM-DEV-02', StartsOn: new Date('2026-05-01T00:00:00+07:00'), ChangeType: 'NEW', IsCurrent: true, Reason: 'เข้าหอนอนภาคเรียนจำลอง', RecordedByStaffID: 'STF-DEV-HEALTH-01', Note: mockNote },
    ],
    DutyDB: [
      { DutyID: 'DUTY-DEV-001', DutyDate: '2026-08-01', Shift: 'ALL_DAY', StaffID: 'STF-DEV-TEACHER-03', DutyType: 'ครูเวรประจำวัน', ScopeType: 'SCHOOL', ScopeID: 'SCHOOL-DEV', Description: 'เวรจำลอง', Note: mockNote },
    ],
    AssignmentDB: [
      { AssignmentID: 'ASN-DEV-001', StaffID: 'STF-DEV-TEACHER-01', AssignmentType: 'CLASSROOM', ScopeType: 'CLASSROOM', ScopeID: 'CLS-DEV-01', RoleKey: 'TEACHER', StartsAt: new Date('2026-05-01T08:00:00+07:00'), EndsAt: new Date('2026-10-31T16:30:00+07:00'), ApprovedByStaffID: 'STF-DEV-ADMIN-01', Reason: 'ครูประจำชั้นจำลอง', Note: mockNote },
      { AssignmentID: 'ASN-DEV-002', StaffID: 'STF-DEV-TEACHER-02', AssignmentType: 'DORM', ScopeType: 'DORM', ScopeID: 'DORM-DEV-01', RoleKey: 'TEACHER', StartsAt: new Date('2026-05-01T08:00:00+07:00'), EndsAt: new Date('2026-10-31T16:30:00+07:00'), ApprovedByStaffID: 'STF-DEV-ADMIN-01', Reason: 'ครูหอนอนจำลอง', Note: mockNote },
      { AssignmentID: 'ASN-DEV-003', StaffID: 'STF-DEV-TEACHER-03', AssignmentType: 'DUTY', ScopeType: 'SCHOOL', ScopeID: 'SCHOOL-DEV', RoleKey: 'TEACHER', StartsAt: new Date('2026-08-01T06:00:00+07:00'), EndsAt: new Date('2026-08-01T18:00:00+07:00'), ApprovedByStaffID: 'STF-DEV-ADMIN-01', Reason: 'ครูเวรจำลอง', Note: mockNote },
    ],
    DrugDB: [
      { DrugPlanID: 'DRUG-DEV-001', RecordedAt: new Date('2026-08-01T09:00:00+07:00'), AcademicYear: 2569, Term: 1, StudentID: 'STD-DEV-004', MedicineName: 'ยาจำลอง A', Strength: '100 mg', Dose: '1 เม็ด', Route: 'รับประทาน', MorningAfterMeal: true, Precaution: 'สังเกตอาการง่วง (ข้อมูลสมมติ)', PlanStatus: 'ACTIVE', DocumentStatus: 'COMPLETE', VerifiedByStaffID: 'STF-DEV-HEALTH-01', RecordedByStaffID: 'STF-DEV-HEALTH-01', Note: mockNote },
      { DrugPlanID: 'DRUG-DEV-002', RecordedAt: new Date('2026-08-01T09:05:00+07:00'), AcademicYear: 2569, Term: 1, StudentID: 'STD-DEV-002', MedicineName: 'ยาพ่นจำลอง B', Strength: '50 mcg', Dose: '1 ครั้ง', Route: 'สูดพ่น', PRNInstruction: 'เมื่อมีอาการตามแผนจำลอง', Precaution: 'ตรวจฉลากก่อนใช้ (ข้อมูลสมมติ)', PlanStatus: 'ACTIVE', DocumentStatus: 'COMPLETE', VerifiedByStaffID: 'STF-DEV-HEALTH-01', RecordedByStaffID: 'STF-DEV-HEALTH-01', Note: mockNote },
    ],
  };
}

function filterMissingMockRecords_(spreadsheet, sheetName, records) {
  var schema = getCanonicalSchema_(sheetName);
  var primaryKey = schema.fields[0].name;
  var sheet = spreadsheet.getSheetByName(sheetName);
  return records.filter(function (record) { return !findRecordRow_(sheet, primaryKey, record[primaryKey]); });
}

function mapG2Error_(error) {
  var message = String(error && error.message ? error.message : error);
  if (message.indexOf('VALIDATION_FAILED:') === 0) return 'DATA_VALIDATION_FAILED';
  if (message.indexOf('ROW_VERSION_CONFLICT') !== -1) return 'ROW_VERSION_CONFLICT';
  if (message.indexOf('G2_AUDIT_FAILED') !== -1) return 'G2_AUDIT_FAILED';
  return 'G2_SETUP_FAILED';
}
