function repairG3LockedContracts_() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var repaired = { config: 0, permissions: 0 };
  var expectedConfig = {
    OTP_EXPIRY_MINUTES: '10', OTP_RESEND_SECONDS: '60', OTP_MAX_SENDS: '3', OTP_WINDOW_MINUTES: '15',
    SESSION_MINUTES: '30', IDLE_MINUTES: '15', FAILED_ATTEMPT_LIMIT: '5', LOCKOUT_MINUTES: '15',
  };
  var sortOrder = {
    SESSION_MINUTES: 70, IDLE_MINUTES: 80, OTP_EXPIRY_MINUTES: 90, OTP_RESEND_SECONDS: 100,
    OTP_MAX_SENDS: 110, OTP_WINDOW_MINUTES: 120, FAILED_ATTEMPT_LIMIT: 130, LOCKOUT_MINUTES: 140,
  };
  Object.keys(expectedConfig).forEach(function (key) {
    var configRecords = buildIntegrityCache_(spreadsheet).ConfigDB;
    var record = configRecords.find(function (candidate) {
      return candidate.ConfigKey === key && candidate.RecordStatus === 'ACTIVE';
    });
    if (!record) {
      record = configRecords.find(function (candidate) { return candidate.ConfigID === 'CFG-' + key; });
    }
    if (!record) {
      repositoryCreateBatch_(spreadsheet, 'ConfigDB', [{
        ConfigID: 'CFG-' + key, ConfigGroup: 'SECURITY', ConfigKey: key,
        ConfigValue: expectedConfig[key], ValueType: 'NUMBER', SortOrder: sortOrder[key],
        IsSystem: true, IsEditableByHealth: false,
        Description: 'Locked Blueprint v1.3.3 security policy',
        Note: 'Recreated by G3 contract repair',
      }], 'SYSTEM_G3_REPAIR');
      repaired.config += 1;
      return;
    }
    if (record.ConfigKey !== key || String(record.ConfigValue) !== expectedConfig[key] || record.ValueType !== 'NUMBER' || record.RecordStatus !== 'ACTIVE') {
      repositoryUpdate_(spreadsheet, 'ConfigDB', record.ConfigID, {
        ConfigGroup: 'SECURITY', ConfigKey: key, ConfigValue: expectedConfig[key], ValueType: 'NUMBER',
        SortOrder: sortOrder[key], IsSystem: true, IsEditableByHealth: false, RecordStatus: 'ACTIVE',
        Note: 'Repaired to locked Blueprint v1.3.3 contract',
      }, record.RowVersion, 'SYSTEM_G3_REPAIR');
      repaired.config += 1;
    }
  });
  buildIntegrityCache_(spreadsheet).PermissionDB.filter(function (permission) {
    return permission.RoleKey === 'EXECUTIVE' && permission.CanExport === true && permission.RecordStatus === 'ACTIVE';
  }).forEach(function (permission) {
    repositoryUpdate_(spreadsheet, 'PermissionDB', permission.PermissionID, {
      CanExport: false, Note: 'EXECUTIVE may view decision reports but cannot export raw data',
    }, permission.RowVersion, 'SYSTEM_G3_REPAIR');
    repaired.permissions += 1;
  });
  return repaired;
}
