import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = path.resolve(import.meta.dirname, '..');
const source = fs.readdirSync(path.join(root, 'src'))
  .filter((name) => name.endsWith('.gs'))
  .sort()
  .map((name) => fs.readFileSync(path.join(root, 'src', name), 'utf8'))
  .join('\n');

let uuidCounter = 0;
const Utilities = {
  DigestAlgorithm: { SHA_256: 'sha256' },
  Charset: { UTF_8: 'utf8' },
  computeDigest(_algorithm, input) {
    return [...crypto.createHash('sha256').update(String(input), 'utf8').digest()].map((byte) => byte > 127 ? byte - 256 : byte);
  },
  getUuid() { uuidCounter += 1; return `00000000-0000-4000-8000-${String(uuidCounter).padStart(12, '0')}`; },
};

const context = { console, Utilities };
vm.createContext(context);
vm.runInContext(source, context, { filename: 'HealthV5.gs' });

const hash = context.secureHash_('12345678', 'test-salt');
assert.equal(hash.length, 64);
assert.equal(hash, context.secureHash_('12345678', 'test-salt'));
assert.notEqual(hash, context.secureHash_('12345679', 'test-salt'));
assert.equal(context.constantTimeEqual_(hash, hash), true);
assert.equal(context.constantTimeEqual_(hash, `${hash.slice(0, -1)}0`), false);

assert.deepEqual([...context.HEALTH_V5_SECURITY.validContexts], ['CLASSROOM', 'DUTY', 'DORM']);
assert.equal(context.maskNationalId_('1234567890123'), '*********0123');
assert.equal(context.maskContact_('teacher@example.invalid'), 'te***@example.invalid');

const maskedMedication = context.maskFields_('TEACHER', 'MEDICATION_PLAN', {
  MedicineName: 'Mock medicine', Strength: '100 mg', Dose: '1', Route: 'oral', Precaution: 'mock',
  NationalID: '1234567890123', PINHash: 'must-not-leak', MedicalConditionSummary: 'must-not-leak',
});
assert.deepEqual(Object.keys(maskedMedication).sort(), ['Dose', 'MedicineName', 'Precaution', 'Route', 'Strength'].sort());
assert.equal(JSON.stringify(maskedMedication).includes('must-not-leak'), false);

assert.equal(context.genericAuthFailure_('REQ-TEST', 'INTERNAL_DETAIL').errorCode, 'AUTHENTICATION_FAILED');
assert.equal(context.HEALTH_V5_SECURITY.devEmailMode, 'LOG_ONLY');

console.log('G3 security tests passed.');
