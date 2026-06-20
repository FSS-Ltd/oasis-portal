import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const mobileRoot = path.resolve(import.meta.dirname, '../..');

function writeMinimalExport(outputDir, overrides = {}) {
  writeFileSync(
    path.join(outputDir, 'index.html'),
    overrides.indexHtml ??
      [
        '<!doctype html>',
        '<html><head>',
        '<link rel="manifest" href="/manifest.json" />',
        '<meta name="apple-mobile-web-app-capable" content="yes" />',
        '<meta name="theme-color" content="#1B2B5E" />',
        '</head><body>Oasis</body></html>',
      ].join(''),
  );
  writeFileSync(path.join(outputDir, 'manifest.json'), overrides.manifestJson ?? '{}');
  writeFileSync(
    path.join(outputDir, 'offline.html'),
    overrides.offlineHtml ?? '<!doctype html><h1>Oasis needs an internet connection</h1>',
  );
  writeFileSync(
    path.join(outputDir, 'service-worker.js'),
    overrides.serviceWorker ?? 'self.__WB_MANIFEST=[]; // static assets only',
  );
}

function runReadinessCheck(outputDir) {
  return spawnSync(process.execPath, ['scripts/check-pwa-readiness.mjs', outputDir], {
    cwd: mobileRoot,
    encoding: 'utf8',
  });
}

test('PWA readiness rejects generated service workers that cache API or tRPC routes', () => {
  const outputDir = mkdtempSync(path.join(os.tmpdir(), 'oasis-pwa-export-'));

  try {
    writeMinimalExport(outputDir, {
      serviceWorker:
        "registerRoute(({url}) => url.pathname.startsWith('/api/trpc'), new NetworkFirst());",
    });

    const result = runReadinessCheck(outputDir);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /Generated service worker must not cache API or tRPC routes/);
  } finally {
    rmSync(outputDir, { force: true, recursive: true });
  }
});

test('PWA readiness rejects offline shells with private or role-specific portal data', () => {
  const outputDir = mkdtempSync(path.join(os.tmpdir(), 'oasis-pwa-export-'));

  try {
    writeMinimalExport(outputDir, {
      offlineHtml:
        '<!doctype html><h1>Oasis needs an internet connection</h1><p>Parent Joshua Merit Wallet</p>',
    });

    const result = runReadinessCheck(outputDir);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /Offline fallback must not include private or role-specific data/);
  } finally {
    rmSync(outputDir, { force: true, recursive: true });
  }
});
