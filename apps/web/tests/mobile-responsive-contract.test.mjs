import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const dataTableSource = readFileSync('apps/web/src/components/ui/data-table.tsx', 'utf8');
const adminCss = readFileSync('apps/web/src/app/(admin)/admin/admin.css', 'utf8');
const nextConfig = readFileSync('apps/web/next.config.mjs', 'utf8');
const studentCommunityContacts = readFileSync(
  'apps/web/src/components/community/student-community-contacts.tsx',
  'utf8',
);
const studentNavSource = readFileSync('apps/web/src/components/student/student-nav.tsx', 'utf8');
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

test('staff volunteer access surfaces retain their responsive layout contracts', () => {
  const parentCss = readFileSync('apps/web/src/app/(parent)/parent/parent.css', 'utf8');

  assert.match(
    adminCss,
    /@media \(max-width: 1100px\) \{\s*\.admin-rota-tabs \{\s*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/,
  );
  assert.match(adminCss, /\.rota-volunteer-access-row[\s\S]*min-height: 56px/);
  assert.match(parentCss, /\.parent-volunteer-panel--staff[\s\S]*grid-template-columns: 1fr/);
});

test('web modal panels use bounded dynamic viewport scrolling', () => {
  assert.match(adminCss, /\.modal-scroll-region[\s\S]*overflow-y: auto/);
  assert.match(adminCss, /\.modal-scroll-region[\s\S]*overscroll-behavior: contain/);
  assert.match(adminCss, /100dvh/);
  assert.match(investCss, /100dvh/);
  assert.match(investCss, /overscroll-behavior: contain/);
});

test('student mobile web bottom nav is fixed to five approved destinations', () => {
  assert.match(
    studentNavSource,
    /const studentBottomNavHrefs = \[[\s\S]*'\/student'[\s\S]*'\/student\/community'[\s\S]*'\/student\/faith'[\s\S]*'\/student\/wallet'[\s\S]*'\/student\/shop'[\s\S]*\] as const/,
  );
  assert.doesNotMatch(studentNavSource, /bottomNav: true/);
  assert.doesNotMatch(studentNavSource, /studentBottomNavHrefs[\s\S]*\/student\/messages/);
  assert.doesNotMatch(studentNavSource, /studentBottomNavHrefs[\s\S]*\/student\/homework/);
});

test('student messages route redirects to Community and contacts open direct messages', () => {
  assert.match(nextConfig, /source: '\/student\/messages'/);
  assert.match(nextConfig, /destination: '\/student\/community'/);
  assert.match(studentCommunityContacts, /api\.message\.openConversation\.useMutation/);
  assert.match(studentCommunityContacts, /kind: 'StudentDirect'/);
  assert.match(studentCommunityContacts, /api\.message\.sendInConversation\.useMutation/);
  assert.match(studentCommunityContacts, /Individual message/);
});
