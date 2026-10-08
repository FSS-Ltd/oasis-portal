import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const webRoot = path.resolve(import.meta.dirname, '..');

function readWeb(relativePath) {
  return readFileSync(path.join(webRoot, relativePath), 'utf8');
}

test('linked staff accounts receive scoped parent-volunteer navigation', () => {
  const parentNav = readWeb('src/components/parent/parent-nav.tsx');
  const parentLayout = readWeb('src/app/(parent)/parent/layout.tsx');
  const parentVolunteerClient = readWeb('src/components/parent/parent-volunteer-client.tsx');

  assert.match(parentNav, /function parentNavigationItems\(\n?\s*canUseParentVolunteer: boolean/);
  assert.match(parentNav, /item\.href !== '\/parent\/volunteer'/);
  assert.match(parentNav, /parentNavigationItems\(canUseParentVolunteer\)/);
  assert.match(parentLayout, /canUseParentVolunteerNavigation\(parentVolunteerAccess\)/);
  assert.match(parentLayout, /<ParentSidebarNav \{\.\.\.parentNavProps\} \/>/);
  assert.match(parentVolunteerClient, /slots\.scope === 'parent'/);
  assert.match(parentVolunteerClient, /Lunch volunteering access/);
  assert.match(parentVolunteerClient, /role="status"/);
  assert.match(parentVolunteerClient, /role="alert"/);
});
