import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const webRoot = path.resolve(import.meta.dirname, '..');

function readWeb(relativePath) {
  return readFileSync(path.join(webRoot, relativePath), 'utf8');
}

test('the Head has a dedicated timetable workspace and navigation entry', () => {
  const nav = readWeb('src/components/admin/admin-nav.tsx');
  const page = readWeb('src/app/(admin)/admin/timetables/page.tsx');

  assert.match(nav, /href: '\/admin\/timetables', label: 'Timetables'/);
  assert.match(nav, /item\.label === 'Timetables'[\s\S]*access\.isHead/);
  assert.match(page, /getHeadUser/);
  assert.match(page, /HeadTimetableClient/);
});

test('the Head workflow supports flexible times, child subjects, publishing, and PDF download', () => {
  const client = readWeb('src/components/timetable/head-timetable-client.tsx');
  const schedule = readWeb('src/components/timetable/age-group-schedule-editor.tsx');
  const editor = readWeb('src/components/timetable/student-timetable-editor.tsx');

  assert.match(schedule, /Add lesson/);
  assert.match(schedule, /Add break/);
  assert.match(schedule, /Move up/);
  assert.match(schedule, /Move down/);
  assert.match(schedule, /type="time"/);
  assert.match(editor, /Add another subject/);
  assert.match(editor, /Missing lessons are suggestions only/);
  assert.match(client, /acknowledgeUnassigned/);
  assert.match(editor, /\/api\/timetables\/\$\{publicationId\}\/pdf/);
});

test('parents and students get timetable pages backed only by published readers', () => {
  const parentPage = readWeb('src/app/(parent)/parent/timetable/page.tsx');
  const studentPage = readWeb('src/app/(student)/student/timetable/page.tsx');
  const readOnly = readWeb('src/components/timetable/published-timetable-client.tsx');

  assert.match(parentPage, /mode="parent"/);
  assert.match(studentPage, /mode="student"/);
  assert.match(readOnly, /publishedForParent/);
  assert.match(readOnly, /publishedForStudent/);
  assert.doesNotMatch(readOnly, /saveSchedule|saveDraft|publish\.useMutation/);
});

test('the timetable grid renders Tuesday to Friday and a vertical B.R.E.A.K. marker', () => {
  const grid = readWeb('src/components/timetable/timetable-grid.tsx');

  assert.match(grid, /TIMETABLE_DAYS/);
  assert.match(grid, /B\.R\.E\.A\.K\./);
  assert.match(grid, /writingMode: 'vertical-rl'/);
  assert.match(grid, /rowSpan=\{TIMETABLE_DAYS\.length\}/);
  assert.equal(
    existsSync(path.join(webRoot, 'src/components/timetable/timetable.module.css')),
    true,
  );
});

test('the term selector keeps every option legible before hover', () => {
  const styles = readWeb('src/components/timetable/timetable.module.css');

  assert.match(
    styles,
    /\.heroControls select option\s*\{[\s\S]*background:\s*#fff;[\s\S]*color:\s*var\(--oasis-navy\);[\s\S]*\}/,
  );
});
