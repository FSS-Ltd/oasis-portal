import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const rosterSource = readFileSync(
  'apps/web/src/app/(admin)/admin/attendance/staff-attendance-roster.tsx',
  'utf8',
);
const attendanceCentreSource = readFileSync(
  'apps/web/src/app/(admin)/admin/attendance/attendance-export-centre.tsx',
  'utf8',
);
const tabsSource = readFileSync(
  'apps/web/src/app/(admin)/admin/attendance/attendance-tabs.tsx',
  'utf8',
);

test('staff attendance presents parent volunteers, volunteer placements, and grouped walk-ins', () => {
  assert.match(rosterSource, /Staff &amp; volunteer attendance/u);
  assert.match(rosterSource, /row\.volunteerPlacements\.map\(\(placement\) => placement\.label\)/u);
  assert.match(rosterSource, /<Badge tone="green">Parent volunteer<\/Badge>/u);
  assert.match(rosterSource, /<optgroup label="Staff">/u);
  assert.match(rosterSource, /<optgroup label="Parent volunteers">/u);
  assert.match(rosterSource, /Add unscheduled person/u);
  assert.match(rosterSource, /Add present/u);
});

test('attendance reporting uses staff and volunteer labels and supports CSV download', () => {
  assert.match(tabsSource, /staff: 'Staff & volunteers'/u);
  assert.match(attendanceCentreSource, /label: 'Staff & volunteers'/u);
  assert.match(attendanceCentreSource, /downloadCsv\(result\.data\.filename/u);
  assert.match(attendanceCentreSource, /Export CSV/u);
});
