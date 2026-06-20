import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const repoRoot = path.resolve(import.meta.dirname, '../../../..');

function readRepo(relativePath) {
  return readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

test('mobile PWA deployment docs cover repeatable HTTPS deployment requirements', () => {
  const docs = readRepo('docs/mobile-pwa-readiness.md');

  for (const text of [
    'Build command: `pnpm --filter @oasis/mobile build:web`',
    'Output directory: `apps/mobile/dist`',
    'Runtime API target: existing `apps/web` `/api/trpc`',
    'EXPO_PUBLIC_TRPC_URL=https://<web-domain>/api/trpc',
    'HTTPS only',
    'Clerk allowed origins',
    'Clerk redirect URLs',
    'Google OAuth redirect URIs',
    'PWA deployment must not replace the `apps/web` Vercel project',
    'Native EAS release remains the app-store path',
    'Rollback path',
    'Redeploy the previous static artifact',
  ]) {
    assert.match(docs, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});
