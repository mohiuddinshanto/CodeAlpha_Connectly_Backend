import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeApiPath } from './api-handler.js';

test('normalizeApiPath prefixes Vercel function paths with /api', () => {
  assert.equal(normalizeApiPath('/health'), '/api/health');
  assert.equal(normalizeApiPath('/posts?limit=10'), '/api/posts?limit=10');
});

test('normalizeApiPath leaves already-prefixed API paths unchanged', () => {
  assert.equal(normalizeApiPath('/api/health'), '/api/health');
  assert.equal(normalizeApiPath('/api?check=1'), '/api?check=1');
});

test('normalizeApiPath restores rewritten nested paths', () => {
  assert.equal(
    normalizeApiPath(
      '/api/index?__connectly_path=auth%2Fregister&next=1'
    ),
    '/api/auth/register?next=1'
  );
});
