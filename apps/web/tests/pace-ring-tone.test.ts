import assert from 'node:assert/strict';
import test from 'node:test';
import { ringTone } from '../src/components/child-log/snapshot-utils.ts';

test('pace ring colour bands', () => {
  assert.equal(ringTone(100), 'gold');
  assert.equal(ringTone(99), 'green');
  assert.equal(ringTone(90), 'green');
  assert.equal(ringTone(89), 'yellow');
  assert.equal(ringTone(80), 'yellow');
  assert.equal(ringTone(79), 'red');
  assert.equal(ringTone(0), 'red');
});
