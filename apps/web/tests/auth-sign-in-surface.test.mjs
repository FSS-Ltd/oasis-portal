import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const webRoot = path.resolve(import.meta.dirname, '..');

function readWeb(relativePath) {
  return readFileSync(path.join(webRoot, relativePath), 'utf8');
}

test('web sign-in page exposes the Clerk password reset route', () => {
  const page = readWeb('src/app/(auth)/sign-in/[[...sign-in]]/page.tsx');

  assert.match(page, /const passwordResetHref = '\/sign-in\/forgot-password'/);
  assert.match(page, /href=\{passwordResetHref\}/);
  assert.match(page, /Forgot password\?/);
});
