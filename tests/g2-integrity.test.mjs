import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = path.resolve(import.meta.dirname, '..');
const source = fs.readdirSync(path.join(root, 'src'))
  .filter((name) => name.endsWith('.gs'))
  .sort()
  .map((name) => fs.readFileSync(path.join(root, 'src', name), 'utf8'))
  .join('\n');

const context = { console };
vm.createContext(context);
vm.runInContext(source, context, { filename: 'HealthV5.gs' });

vm.runInContext(`
  var testCache = emptyIntegrityCache_();
  testCache.RoleDB = ['ADMIN', 'HEALTH', 'TEACHER', 'EXECUTIVE'].map(function (roleKey) {
    return { RoleKey: roleKey, RecordStatus: 'ACTIVE' };
  });
  var batches = buildMockDataBatches_();
  var seedOrder = ['StaffDB', 'ClassroomDB', 'DormDB', 'StudentDB', 'StudentDormHistoryDB', 'DutyDB', 'AssignmentDB', 'DrugDB'];
  var testResults = [];
  seedOrder.forEach(function (sheetName) {
    var schema = getCanonicalSchema_(sheetName);
    var prepared = batches[sheetName].map(function (record) {
      return prepareRecordForCreate_(schema, record, 'SYSTEM_G2');
    });
    var validation = validateRecordBatch_(sheetName, prepared, testCache, null);
    testResults.push({ sheetName: sheetName, validation: validation });
    testCache[sheetName] = testCache[sheetName].concat(prepared);
  });
`, context);

assert.equal(context.HEALTH_V5_SCHEMA.length, 20);
assert.equal(context.HEALTH_V5_SCHEMA.reduce((sum, schema) => sum + schema.fieldCount, 0), 402);
for (const result of context.testResults) {
  assert.equal(result.validation.passed, true, `${result.sheetName}: ${JSON.stringify(result.validation.errors)}`);
}

vm.runInContext(`
  var invalidStudent = prepareRecordForCreate_(getCanonicalSchema_('StudentDB'), {
    StudentID: 'STD-INVALID-FK', StudentCode: 'INVALID-FK', DisplayName: 'Invalid FK',
    ClassroomID: 'CLS-DOES-NOT-EXIST', StudentStatus: 'ACTIVE_STUDENT'
  }, 'SYSTEM_G2');
  var invalidFkResult = validateRecordBatch_('StudentDB', [invalidStudent], testCache, null);
  var duplicateStudent = prepareRecordForCreate_(getCanonicalSchema_('StudentDB'), {
    StudentID: 'STD-DEV-001', StudentCode: 'DEV-S001', DisplayName: 'Duplicate',
    ClassroomID: 'CLS-DEV-01', StudentStatus: 'ACTIVE_STUDENT'
  }, 'SYSTEM_G2');
  var duplicateResult = validateRecordBatch_('StudentDB', [duplicateStudent], testCache, null);
`, context);

assert.equal(context.invalidFkResult.passed, false);
assert.ok(context.invalidFkResult.errors.some((error) => error.code === 'FOREIGN_KEY_NOT_FOUND'));
assert.equal(context.duplicateResult.passed, false);
assert.ok(context.duplicateResult.errors.some((error) => error.code === 'DUPLICATE_UNIQUE_KEY'));
assert.equal(context.runStructureRoundTripTest_(), true);

console.log('G2 integrity tests passed.');
