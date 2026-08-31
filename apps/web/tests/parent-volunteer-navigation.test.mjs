import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const webRoot = path.resolve(import.meta.dirname, '..');

function readWeb(relativePath) {
  return readFileSync(path.join(webRoot, relativePath), 'utf8');
}

test('linked staff accounts do not see the blocked parent-volunteer route', () => {
  const parentNav = readWeb('src/components/parent/parent-nav.tsx');
  const parentLayout = readWeb('src/app/(parent)/parent/layout.tsx');

  assert.match(parentNav, /function visibleParentNavItems\(canUseParentVolunteer: boolean\)/);
  assert.match(parentNav, /item\.href !== '\/parent\/volunteer'/);
  assert.match(parentNav, /visibleParentNavItems\(canUseParentVolunteer\)/);
  assert.match(parentLayout, /canUseParentVolunteer: user\.role === 'Parent'/);
});
