import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const dataTableSource = readFileSync('apps/web/src/components/ui/data-table.tsx', 'utf8');
const adminCss = readFileSync('apps/web/src/app/(admin)/admin/admin.css', 'utf8');
const investCss = readFileSync(
  'apps/web/src/components/student/invest/student-invest.module.css',
  'utf8',
);

test('shared data tables render inside the responsive scroll wrapper', () => {
  assert.match(dataTableSource, /table-responsive/);
  assert.match(dataTableSource, /cn\('table-responsive', className\)/);
});

test('global table containers keep horizontal scroll contained on touch devices', () => {
  assert.match(adminCss, /\.table-responsive[\s\S]*overflow-x: auto/);
  assert.match(adminCss, /\.table-responsive[\s\S]*-webkit-overflow-scrolling: touch/);
  assert.match(adminCss, /\.table-responsive[\s\S]*overscroll-behavior-inline: contain/);
});

test('web modal panels use bounded dynamic viewport scrolling', () => {
  assert.match(adminCss, /\.modal-scroll-region[\s\S]*overflow-y: auto/);
  assert.match(adminCss, /\.modal-scroll-region[\s\S]*overscroll-behavior: contain/);
  assert.match(adminCss, /100dvh/);
  assert.match(investCss, /100dvh/);
  assert.match(investCss, /overscroll-behavior: contain/);
});
