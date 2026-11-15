import test from 'node:test';
import assert from 'node:assert/strict';
import { buildChatSocketUrl } from './chatController.js';

test('buildChatSocketUrl uses a secure URL for hosted deployments', () => {
  assert.equal(
    buildChatSocketUrl('https://connectlycackend.vercel.app/path'),
    'wss://connectlycackend.vercel.app/api/ws'
  );
});

test('buildChatSocketUrl uses an insecure URL for local development', () => {
  assert.equal(
    buildChatSocketUrl('127.0.0.1:5000'),
    'ws://127.0.0.1:5000/api/ws'
  );
});

test('buildChatSocketUrl rejects a malformed host', () => {
  assert.throws(
    () => buildChatSocketUrl('https://example.com:bad'),
    { code: 'CHAT_UNAVAILABLE' }
  );
});
