import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isPendingVolunteerRow,
  updatePendingVolunteerRow,
} from '../src/app/(admin)/admin/rota/_components/rota-volunteer-access-pending.ts';

test('keeps each row pending until its overlapping mutation settles', () => {
  let pending = updatePendingVolunteerRow(new Map(), 'staff-a', 1);
  pending = updatePendingVolunteerRow(pending, 'staff-b', 1);
  pending = updatePendingVolunteerRow(pending, 'staff-a', -1);

  assert.equal(isPendingVolunteerRow(pending, 'staff-a'), false);
  assert.equal(isPendingVolunteerRow(pending, 'staff-b'), true);

  pending = updatePendingVolunteerRow(pending, 'staff-b', -1);
  assert.equal(isPendingVolunteerRow(pending, 'staff-b'), false);
});

test('does not re-enable a row when an earlier same-row success settles first', () => {
  let pending = updatePendingVolunteerRow(new Map(), 'staff-a', 1);
  pending = updatePendingVolunteerRow(pending, 'staff-a', 1);
  pending = updatePendingVolunteerRow(pending, 'staff-a', -1);

  assert.equal(isPendingVolunteerRow(pending, 'staff-a'), true);

  pending = updatePendingVolunteerRow(pending, 'staff-a', -1);
  assert.equal(isPendingVolunteerRow(pending, 'staff-a'), false);
});

test('error settlement also cleans up only the matching outstanding row', () => {
  let pending = updatePendingVolunteerRow(new Map(), 'staff-a', 1);
  pending = updatePendingVolunteerRow(pending, 'staff-b', 1);
  pending = updatePendingVolunteerRow(pending, 'staff-b', -1);

  assert.equal(isPendingVolunteerRow(pending, 'staff-a'), true);
  assert.equal(isPendingVolunteerRow(pending, 'staff-b'), false);

  pending = updatePendingVolunteerRow(pending, 'staff-a', -1);
  assert.equal(isPendingVolunteerRow(pending, 'staff-a'), false);
});
