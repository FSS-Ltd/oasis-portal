import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const webRoot = path.resolve(import.meta.dirname, '..');

function readWeb(relativePath) {
  return readFileSync(path.join(webRoot, relativePath), 'utf8');
}

test('tRPC route allows the PWA origin to send Clerk bearer-token requests', () => {
  const route = readWeb('src/app/api/trpc/[trpc]/route.ts');

  assert.match(route, /PWA_ALLOWED_ORIGINS/);
  assert.match(route, /https:\/\/app\.oasisportal\.space/);
  assert.match(route, /Access-Control-Allow-Origin/);
  assert.match(route, /Access-Control-Allow-Headers/);
  assert.match(route, /Authorization/);
  assert.match(route, /export \{[^}]*OPTIONS[^}]*\}/s);
});
