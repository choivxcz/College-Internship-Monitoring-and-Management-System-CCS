import test from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword, tokenHash } from '../src/security.js';
import { hourSchema, studentSchema } from '../src/validation.js';
import { scope, csvCell } from '../src/services.js';

test('passwords use unique salts and reject wrong passwords', async () => {
  const first = await hashPassword('test-password-123');
  const second = await hashPassword('test-password-123');
  assert.notEqual(first, second);
  assert.equal(await verifyPassword('test-password-123', first), true);
  assert.equal(await verifyPassword('wrong-password', first), false);
  assert.equal(await verifyPassword('anything', 'malformed'), false);
});
test('session tokens are hashed deterministically', () => {
  assert.equal(tokenHash('token'), tokenHash('token'));
  assert.notEqual(tokenHash('token'), 'token');
  assert.equal(tokenHash('token').length, 64);
});
test('students can only select their own records', () => {
  assert.deepEqual(scope('student','2026-01'), { studentId: '2026-01' });
  assert.throws(() => scope('student','2026-01','2026-02'));
  assert.throws(() => scope('student',null));
  assert.deepEqual(scope('admin',null), {});
});
test('hours reject impossible dates, future dates, fractions and excessive hours', () => {
  const valid = { studentId: '2026-01', date: '2026-01-01', hours: 8, description: 'Developed the internship project' };
  assert.equal(hourSchema.safeParse(valid).success,true);
  for (const override of [{hours:25},{hours:-1},{hours:0.1},{date:'2026-02-30'},{date:'2099-01-01'}]) assert.equal(hourSchema.safeParse({...valid,...override}).success,false);
});
test('student profile requires valid account and academic fields', () => {
  const valid = { id:'2026-01', name:'Test Student', email:'STUDENT@example.edu', program:'BSIT',section:'4A',term:'Test term',requiredHours:480 };
  assert.equal(studentSchema.parse(valid).email,'student@example.edu');
  assert.equal(studentSchema.safeParse({...valid,requiredHours:0}).success,false);
  assert.equal(studentSchema.safeParse({...valid,startDate:'2026-10-20',expectedCompletion:'2026-10-01'}).success,false);
});
test('CSV cells escape delimiters, quotes and spreadsheet formulas', () => {
  assert.equal(csvCell('A,"B"'), '"A,""B"""');
  for(const value of ['=SUM(A1)','+1','-1','@SUM(A1)',' \t=1']) assert.equal(csvCell(value)[1], "'");
});
