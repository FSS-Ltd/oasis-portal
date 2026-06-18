import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';

const mobileRoot = path.resolve(import.meta.dirname, '../..');
const prepareModule = await import('../../scripts/prepare-pwa-export.mjs');
const checkModule = await import('../../scripts/check-pwa-export.mjs');

let tempRoot;

beforeEach(async () => {
  tempRoot = await mkdtemp(path.join(os.tmpdir(), 'oasis-pwa-test-'));
});

afterEach(async () => {
  if (tempRoot) await rm(tempRoot, { recursive: true, force: true });
});

async function writeFixtureExport() {
  const distDir = path.join(tempRoot, 'dist');
  await mkdir(path.join(distDir, 'assets'), { recursive: true });
  await writeFile(
    path.join(distDir, 'index.html'),
    '<!doctype html><html><head><title>Oasis</title></head><body><div id="root"></div><script src="/assets/app.js"></script></body></html>',
  );
  await writeFile(path.join(distDir, 'assets', 'app.js'), 'console.log("oasis");');
  await writeFile(path.join(distDir, 'assets', 'app.css'), 'body{background:#EEF2F9}');
  return distDir;
}

describe('PWA export preparation', () => {
  it('copies public PWA files, injects head metadata, and registers the service worker', async () => {
    const distDir = await writeFixtureExport();

    await prepareModule.preparePwaExport({
      distDir,
      publicDir: path.join(mobileRoot, 'public'),
    });

    const html = await readFile(path.join(distDir, 'index.html'), 'utf8');
    assert.match(html, /<link rel="manifest" href="\/manifest\.webmanifest">/);
    assert.match(html, /<meta name="theme-color" content="#1B2B5E">/);
    assert.match(html, /apple-mobile-web-app-capable/);
    assert.match(html, /<link rel="apple-touch-icon" href="\/icons\/oasis-icon-192\.png">/);
    assert.match(html, /navigator\.serviceWorker\.register\('\/service-worker\.js'\)/);
    await stat(path.join(distDir, 'icons', 'oasis-icon-192.png'));
    await stat(path.join(distDir, 'icons', 'oasis-icon-512.png'));

    const serviceWorker = await readFile(path.join(distDir, 'service-worker.js'), 'utf8');
    assert.match(serviceWorker, /\/offline\.html/);
    assert.match(serviceWorker, /\/assets\/app\.js/);
    assert.match(serviceWorker, /pathname\.startsWith\('\/api\/'\)/);
    assert.doesNotMatch(serviceWorker, /"\/api\//);
    assert.doesNotMatch(serviceWorker, /trpc/i);
  });

  it('validates a prepared export and rejects missing offline fallback', async () => {
    const distDir = await writeFixtureExport();
    await prepareModule.preparePwaExport({
      distDir,
      publicDir: path.join(mobileRoot, 'public'),
    });

    const result = await checkModule.checkPwaExport(distDir);
    assert.equal(result.manifest.name, 'Oasis Portal');
    assert.equal(result.hasServiceWorker, true);
    assert.equal(result.hasOfflineFallback, true);

    await rm(path.join(distDir, 'icons', 'oasis-icon-512.png'));
    await assert.rejects(() => checkModule.checkPwaExport(distDir), /icons\/oasis-icon-512\.png/);

    await prepareModule.preparePwaExport({
      distDir,
      publicDir: path.join(mobileRoot, 'public'),
    });
    await rm(path.join(distDir, 'offline.html'));
    await assert.rejects(() => checkModule.checkPwaExport(distDir), /offline\.html/);
  });
});
