import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const webRoot = path.resolve(import.meta.dirname, '..');

function readWeb(relativePath) {
  return readFileSync(path.join(webRoot, relativePath), 'utf8');
}

function readWebIfExists(relativePath) {
  const absolutePath = path.join(webRoot, relativePath);
  return existsSync(absolutePath) ? readFileSync(absolutePath, 'utf8') : '';
}

const adminNavSource = readWeb('src/components/admin/admin-nav.tsx');
const rotaPageSource = readWeb('src/app/(admin)/admin/rota/page.tsx');
const supervisorNavSource = readWeb('src/components/supervisor/supervisor-nav.tsx');
const sidebarGroupSource = readWebIfExists('src/components/navigation/sidebar-nav-group.tsx');

test('admin sidebar groups the large menu into meaningful accordion categories', () => {
  assert.match(adminNavSource, /const navGroups: NavGroup\[\] = \[/);
  assert.match(adminNavSource, /label: 'Daily Ops'[\s\S]*label: 'Attendance'/);
  assert.match(adminNavSource, /label: 'Daily Ops'[\s\S]*label: 'Rota'/);
  assert.match(adminNavSource, /label: 'Learning & Progress'[\s\S]*label: 'PACE'/);
  assert.match(adminNavSource, /label: 'Communication & Consent'[\s\S]*label: 'Messages'/);
  assert.match(adminNavSource, /label: 'People & Access'[\s\S]*label: 'User Access'/);
  assert.match(adminNavSource, /label: 'Finance & Shop'[\s\S]*label: 'Invoices'/);
  assert.match(adminNavSource, /label: 'Governance'[\s\S]*label: 'Audit'/);
});

test('sidebar accordion opens and closes on click only, not hover', () => {
  assert.doesNotMatch(sidebarGroupSource, /onPointerEnter/);
  assert.doesNotMatch(sidebarGroupSource, /onPointerLeave/);
  assert.doesNotMatch(sidebarGroupSource, /onHoverStart/);
  assert.doesNotMatch(sidebarGroupSource, /onHoverEnd/);
  assert.match(sidebarGroupSource, /aria-expanded=\{open\}/);
  assert.match(sidebarGroupSource, /onClick=\{\(\) => \{\s*onOpenChange\(!open\);/);
});

test('admin and supervisor sidebars share the same accordion behaviour', () => {
  assert.match(adminNavSource, /SidebarNavGroup/);
  assert.match(supervisorNavSource, /SidebarNavGroup/);
});

test('the Rota page accepts every role that the admin navigation can send there', () => {
  assert.match(adminNavSource, /href: '\/admin\/rota', label: 'Rota'/);
  assert.match(rotaPageSource, /getAdminOperationsUser/);
  assert.match(rotaPageSource, /await getAdminOperationsUser\(\);/);
  assert.doesNotMatch(rotaPageSource, /assertFullAdmin/);
});
