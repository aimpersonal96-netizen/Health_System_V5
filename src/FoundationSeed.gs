function seedFoundationData_(spreadsheet) {
  var now = new Date();
  var actor = HEALTH_V5_FOUNDATION.setupActor;
  var cfg = HEALTH_V5_FOUNDATION.config;
  var configSpecs = [
    ['SYSTEM', 'SCHEMA_VERSION', HEALTH_V5_SCHEMA_VERSION, 'STRING', 10, 'Canonical Blueprint version'],
    ['SYSTEM', 'TIMEZONE', HEALTH_V5_FOUNDATION.timezone, 'STRING', 20, 'Spreadsheet timezone'],
    ['TERM', 'ACADEMIC_YEAR', cfg.academicYear, 'STRING', 30, 'Development academic year'],
    ['TERM', 'TERM', cfg.term, 'STRING', 40, 'Development term'],
    ['TERM', 'TERM_START_DATE', cfg.termStartDate, 'DATE', 50, 'Trusted-device term start'],
    ['TERM', 'TERM_END_DATE', cfg.termEndDate, 'DATE', 60, 'Trusted-device term expiry'],
    ['SECURITY', 'SESSION_MINUTES', cfg.sessionMinutes, 'NUMBER', 70, 'Maximum session age'],
    ['SECURITY', 'IDLE_MINUTES', cfg.idleMinutes, 'NUMBER', 80, 'Idle session timeout'],
    ['SECURITY', 'OTP_EXPIRY_MINUTES', cfg.otpExpiryMinutes, 'NUMBER', 90, 'Email OTP lifetime'],
    ['SECURITY', 'OTP_RESEND_SECONDS', cfg.otpResendSeconds, 'NUMBER', 100, 'Minimum OTP resend delay'],
    ['SECURITY', 'OTP_MAX_SENDS', cfg.otpMaxSends, 'NUMBER', 110, 'Maximum sends in OTP window'],
    ['SECURITY', 'OTP_WINDOW_MINUTES', cfg.otpWindowMinutes, 'NUMBER', 120, 'OTP rate-limit window'],
    ['SECURITY', 'FAILED_ATTEMPT_LIMIT', cfg.failedAttemptLimit, 'NUMBER', 130, 'Failed login limit'],
    ['SECURITY', 'LOCKOUT_MINUTES', cfg.lockoutMinutes, 'NUMBER', 140, 'Login lockout duration'],
    ['SECURITY', 'EMERGENCY_SESSION_MINUTES', cfg.emergencySessionMinutes, 'NUMBER', 150, 'Break-glass session lifetime'],
  ];
  var configs = configSpecs.map(function (spec) {
    return makeBaseRecord_({
      ConfigID: 'CFG-' + spec[1], ConfigGroup: spec[0], ConfigKey: spec[1],
      ConfigValue: spec[2], ValueType: spec[3], SortOrder: spec[4],
      IsSystem: true, IsEditableByHealth: false, Description: spec[5],
    }, now, actor);
  });

  var roleSpecs = [
    ['ADMIN', 'ผู้ดูแลระบบ', 'LOGIN', 'ALL_DATA', 'จัดการระบบและสิทธิ์'],
    ['HEALTH', 'ครูงานอนามัย', 'LOGIN', 'ALL_DATA', 'จัดการข้อมูลสุขภาพและงานบริการ'],
    ['TEACHER', 'ครู', 'STAFF_VERIFICATION_TRUSTED_DEVICE', 'DECLARED_CONTEXT', 'อ่านข้อมูลตามบริบทที่เลือก'],
    ['EXECUTIVE', 'ผู้บริหาร', 'STAFF_VERIFICATION_TRUSTED_DEVICE', 'ALL_STUDENTS_REPORT', 'ดูรายงานภาพรวม'],
  ];
  var roles = roleSpecs.map(function (spec) {
    return makeBaseRecord_({
      RoleKey: spec[0], RoleName: spec[1], LoginRequired: true, PublicAccess: false,
      AccessGate: spec[2], DataScope: spec[3], Description: spec[4],
    }, now, actor);
  });

  var resources = ['SETTINGS', 'USER_MANAGEMENT', 'CLASSROOM', 'STUDENT', 'MEDICATION_PLAN', 'NURSE_VISIT', 'REFER', 'HEALTH', 'FITNESS', 'STOCK', 'DORM', 'DISEASE', 'REPORT', 'AUDIT'];
  var permissions = [];
  roleSpecs.forEach(function (role) {
    resources.forEach(function (resource) {
      permissions.push(makePermissionRecord_(role[0], resource, now, actor));
    });
  });

  return {
    ConfigDB: appendMissingRecords_(spreadsheet, 'ConfigDB', 'ConfigID', configs),
    RoleDB: appendMissingRecords_(spreadsheet, 'RoleDB', 'RoleKey', roles),
    PermissionDB: appendMissingRecords_(spreadsheet, 'PermissionDB', 'PermissionID', permissions),
  };
}

function makeBaseRecord_(values, now, actor) {
  values.RecordStatus = HEALTH_V5_FOUNDATION.activeStatus;
  values.CreatedAt = now;
  values.CreatedBy = actor;
  values.UpdatedAt = now;
  values.UpdatedBy = actor;
  values.RowVersion = 1;
  values.Note = 'DEV foundation seed';
  return values;
}

function makePermissionRecord_(role, resource, now, actor) {
  var admin = role === 'ADMIN';
  var health = role === 'HEALTH';
  var teacherView = role === 'TEACHER' && ['CLASSROOM', 'STUDENT', 'MEDICATION_PLAN', 'REFER'].indexOf(resource) !== -1;
  var executiveView = role === 'EXECUTIVE' && resource === 'REPORT';
  var canView = admin || health || teacherView || executiveView;
  return makeBaseRecord_({
    PermissionID: 'PERM-' + role + '-' + resource,
    RoleKey: role,
    ResourceKey: resource,
    CanView: canView,
    CanCreate: admin || health,
    CanUpdate: admin || health,
    CanCancel: admin || health,
    CanExport: admin || health || executiveView,
    CanViewNationalID: admin || health || (role === 'TEACHER' && ['STUDENT', 'REFER'].indexOf(resource) !== -1),
    CanViewReports: admin || health || executiveView,
    CanManageUsers: admin && resource === 'USER_MANAGEMENT',
    CanModifySchema: admin && resource === 'SETTINGS',
    DataScope: role === 'TEACHER' ? 'DECLARED_CONTEXT' : (role === 'EXECUTIVE' ? 'ALL_STUDENTS_REPORT' : 'ALL_DATA'),
    AccessGate: role === 'TEACHER' || role === 'EXECUTIVE' ? 'STAFF_VERIFICATION_TRUSTED_DEVICE' : 'LOGIN',
  }, now, actor);
}

function appendMissingRecords_(spreadsheet, sheetName, keyName, records) {
  var sheet = spreadsheet.getSheetByName(sheetName);
  var schema = getCanonicalSchema_(sheetName);
  var headers = getCanonicalHeaders_(schema);
  var keyColumn = headers.indexOf(keyName) + 1;
  var existing = {};
  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, keyColumn, sheet.getLastRow() - 1, 1).getDisplayValues().forEach(function (row) {
      if (row[0]) existing[row[0]] = true;
    });
  }
  var missing = records.filter(function (record) { return !existing[String(record[keyName])]; });
  if (missing.length) {
    var values = missing.map(function (record) {
      return headers.map(function (header) { return normalizeCellValue_(record[header]); });
    });
    sheet.getRange(sheet.getLastRow() + 1, 1, values.length, headers.length).setValues(values);
  }
  return missing.length;
}
