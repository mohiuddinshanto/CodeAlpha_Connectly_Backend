import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isValidObjectIdHex,
  validateBio,
  validateChatMessageContent,
  validateCommentContent,
  validateEmail,
  validateFullName,
  validateImageFile,
  validatePassword,
  validatePostContent,
  validateUsername,
} from './validators/index.js';

test('validateEmail normalizes and rejects invalid addresses', () => {
  const ok = validateEmail('  Elena.Vance@Connectly.io ');
  assert.equal(ok.valid, true);
  assert.equal(ok.value, 'elena.vance@connectly.io');

  assert.equal(validateEmail('').valid, false);
  assert.equal(validateEmail('not-an-email').valid, false);
  assert.equal(validateEmail('a@b').valid, false);
});

test('validateUsername strips @, enforces lowercase alphanumeric/underscore 3-24 chars', () => {
  const ok = validateUsername('@Marcus_Chen99');
  assert.equal(ok.valid, true);
  assert.equal(ok.value, 'marcus_chen99');

  assert.equal(validateUsername('ab').valid, false);
  assert.equal(validateUsername('bad-handle!').valid, false);
  assert.equal(validateUsername('a'.repeat(25)).valid, false);
});

test('validatePassword enforces minimum length', () => {
  assert.equal(validatePassword('12345').valid, false);
  assert.equal(validatePassword('123456').valid, true);
});

test('validateFullName collapses extra whitespace and rejects short names', () => {
  const ok = validateFullName('  Amara   Okafor ');
  assert.equal(ok.valid, true);
  assert.equal(ok.value, 'Amara Okafor');
  assert.equal(validateFullName('A').valid, false);
});

test('validateBio caps length at 240 chars', () => {
  assert.equal(validateBio(undefined).valid, true);
  assert.equal(validateBio('Building design systems.').valid, true);
  assert.equal(validateBio('x'.repeat(241)).valid, false);
});

test('validatePostContent requires text or image and enforces 1000 char cap', () => {
  assert.equal(validatePostContent('   ', '').valid, false);
  assert.equal(validatePostContent('', 'https://img.example/a.jpg').valid, true);
  assert.equal(validatePostContent('Hello world').valid, true);
  assert.equal(validatePostContent('a'.repeat(1001)).valid, false);
});

test('validateCommentContent rejects blank comments', () => {
  assert.equal(validateCommentContent('   ').valid, false);
  assert.equal(validateCommentContent('Great insights!').valid, true);
  assert.equal(validateCommentContent('a'.repeat(501)).valid, false);
});

test('validateChatMessageContent trims messages and enforces a 2,000 character limit', () => {
  assert.deepEqual(validateChatMessageContent('  hello  '), {
    valid: true,
    value: 'hello',
  });
  assert.equal(validateChatMessageContent('   ').valid, false);
  assert.equal(validateChatMessageContent('x'.repeat(2001)).valid, false);
});

test('validateImageFile checks mime type and 5MB size limit', () => {
  assert.equal(validateImageFile('image/png', 1024).valid, true);
  assert.equal(validateImageFile('application/pdf', 1024).valid, false);
  assert.equal(validateImageFile('image/jpeg', 6 * 1024 * 1024).valid, false);
  assert.equal(validateImageFile('image/webp', 0).valid, false);
});

test('isValidObjectIdHex validates 24-hex ObjectId strings', () => {
  assert.equal(isValidObjectIdHex('507f1f77bcf86cd799439011'), true);
  assert.equal(isValidObjectIdHex('not-an-id'), false);
});
