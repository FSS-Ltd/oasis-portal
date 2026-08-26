import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const webRoot = path.resolve(import.meta.dirname, '..');

function readWeb(relativePath) {
  return readFileSync(path.join(webRoot, relativePath), 'utf8');
}

test('signed-in users are logged out after five minutes without browser activity', () => {
  const component = readWeb('src/components/auth/inactivity-logout.tsx');
  const rootLayout = readWeb('src/app/layout.tsx');

  assert.match(component, /const INACTIVITY_TIMEOUT_MS = 5 \* 60 \* 1000/);
  assert.match(component, /useAuth\(\)/);
  assert.match(component, /signOut\(\{ redirectUrl: '\/sign-in' \}\)/);
  assert.match(component, /'pointerdown', 'keydown', 'touchstart', 'wheel', 'scroll'/);
  assert.match(component, /document\.addEventListener\('visibilitychange'/);
  assert.match(rootLayout, /<InactivityLogout \/>/);
});
