import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const mobileRoot = path.resolve(import.meta.dirname, '../..');

function readMobile(relativePath) {
  return readFileSync(path.join(mobileRoot, relativePath), 'utf8');
}

test('mobile sign-in panel links users to the Clerk password reset flow', () => {
  const panel = readMobile('src/components/core/sign-in-panel.tsx');

  assert.match(panel, /PASSWORD_RESET_URL = 'https:\/\/www\.oasisportal\.space\/sign-in\/forgot-password'/);
  assert.match(panel, /accessibilityRole="link"/);
  assert.match(panel, /Forgot password\?/);
  assert.match(panel, /Linking\.openURL\(PASSWORD_RESET_URL\)/);
});
