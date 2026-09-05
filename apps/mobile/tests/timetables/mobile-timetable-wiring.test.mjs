import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const mobileRoot = path.resolve(import.meta.dirname, '..', '..');

function readMobile(relativePath) {
  return readFileSync(path.join(mobileRoot, relativePath), 'utf8');
}

test('the Head-only staff timetable builder is reachable from staff home', () => {
  const portal = readMobile('src/components/staff/staff-portal-screen.tsx');
  const home = readMobile('src/components/staff/staff-home-screen.tsx');
  const screen = readMobile('src/components/timetable/mobile-head-timetable-screen.tsx');

  assert.match(portal, /route === 'timetables'/);
  assert.match(home, /user\?\.role === 'Head'[\s\S]*Timetables/);
  assert.match(screen, /saveSchedule/);
  assert.match(screen, /saveDraft/);
  assert.match(screen, /acknowledgeUnassigned/);
  assert.match(screen, /downloadPdf/);
});

test('parent and student mobile portals expose published timetables as view only', () => {
  const parent = readMobile('src/components/parent/parent-portal-screen.tsx');
  const student = readMobile('src/components/student/student-portal-screen.tsx');
  const viewer = readMobile('src/components/timetable/mobile-published-timetable-screen.tsx');

  assert.match(parent, /id: 'timetable'/);
  assert.match(parent, /publishedForParent/);
  assert.match(student, /id: 'timetable'/);
  assert.match(student, /publishedForStudent/);
  assert.match(viewer, /View only/);
  assert.doesNotMatch(viewer, /saveDraft|saveSchedule|publish\.useMutation/);
});

test('the mobile timetable uses subject colours and a vertical B.R.E.A.K. marker', () => {
  const grid = readMobile('src/components/timetable/mobile-timetable-grid.tsx');

  assert.match(grid, /B\.R\.E\.A\.K\./);
  assert.match(grid, /transform: \[\{ rotate: '-90deg' \}\]/);
  assert.match(grid, /Yellow[\s\S]*Red[\s\S]*PaleRed[\s\S]*Purple/);
  assert.match(grid, /DarkBlue[\s\S]*LightBlue[\s\S]*Green[\s\S]*Brown[\s\S]*Grey/);
});
