import assert from 'node:assert/strict';
import test from 'node:test';
import { canSkipSchoolYearSync } from '../src/lib/school-year-sync-policy';

for (const path of [
  'health.ping',
  'health.db',
  'health.me',
  'audit.list',
  'student.update',
  'compliance.update',
]) {
  test(`${path} stays available for health checks or authorized repair`, () => {
    assert.equal(canSkipSchoolYearSync([{ path }]), true);
  });
}

test('a mixed batch cannot bypass reconciliation for cohort reads', () => {
  assert.equal(
    canSkipSchoolYearSync([{ path: 'health.me' }, { path: 'scoreKeyReport.current' }]),
    false,
  );
  assert.equal(
    canSkipSchoolYearSync([{ path: 'student.update' }, { path: 'student.list' }]),
    false,
  );
  assert.equal(canSkipSchoolYearSync([{ path: 'health.me' }, { path: 'student.update' }]), true);
});

test('unknown, empty, or similarly named routes fail closed', () => {
  for (const path of [
    'health.newQuery',
    'audit.newQuery',
    'student.updateAnything',
    'student%2Eupdate',
    ' student.update',
  ]) {
    assert.equal(canSkipSchoolYearSync([{ path }]), false);
  }
  assert.equal(canSkipSchoolYearSync([]), false);
});
