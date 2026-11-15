import test from 'node:test';
import assert from 'node:assert/strict';
import { createFriendshipPairKey } from './friendService.js';

test('createFriendshipPairKey is stable regardless of request direction', () => {
  const firstUserId = '507f1f77bcf86cd799439011';
  const secondUserId = '507f191e810c19729de860ea';

  assert.equal(
    createFriendshipPairKey(firstUserId, secondUserId),
    createFriendshipPairKey(secondUserId, firstUserId)
  );
});
