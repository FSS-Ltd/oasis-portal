import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

const mobileRoot = path.resolve(import.meta.dirname, '../..');

function readJson(relativePath) {
  return JSON.parse(readFileSync(path.join(mobileRoot, relativePath), 'utf8'));
}

describe('mobile PWA package configuration', () => {
  it('declares the web build and PWA verification scripts', () => {
    const pkg = readJson('package.json');

    assert.equal(
      pkg.scripts['build:web'],
      'node ../../scripts/with-env.mjs expo export --platform web --output-dir dist && node scripts/prepare-pwa-export.mjs',
    );
    assert.equal(pkg.scripts['pwa:check'], 'node scripts/check-pwa-export.mjs dist');
    assert.equal(pkg.scripts['test:pwa'], 'node --test tests/pwa/*.test.mjs');
  });

  it('keeps the native app ids while enabling Expo web output', () => {
    const app = readJson('app.json').expo;

    assert.equal(app.ios.bundleIdentifier, 'uk.oasis.portal');
    assert.equal(app.android.package, 'uk.oasis.portal');
    assert.deepEqual(app.web, {
      bundler: 'metro',
      output: 'static',
      favicon: './assets/oasis-logo.png',
      name: 'Oasis Portal',
      shortName: 'Oasis',
      themeColor: '#1B2B5E',
      backgroundColor: '#EEF2F9',
    });
  });

  it('ships the public manifest and offline fallback inputs', () => {
    for (const file of [
      'public/manifest.webmanifest',
      'public/offline.html',
      'public/icons/oasis-icon-192.png',
      'public/icons/oasis-icon-512.png',
    ]) {
      assert.equal(existsSync(path.join(mobileRoot, file)), true, `${file} should exist`);
    }

    const manifest = readJson('public/manifest.webmanifest');
    assert.equal(manifest.name, 'Oasis Portal');
    assert.equal(manifest.short_name, 'Oasis');
    assert.equal(manifest.display, 'standalone');
    assert.equal(manifest.start_url, '/');
    assert.equal(manifest.scope, '/');
    assert.equal(manifest.theme_color, '#1B2B5E');
    assert.equal(manifest.background_color, '#EEF2F9');
    assert.ok(
      manifest.icons.some(
        (icon) => icon.src === '/icons/oasis-icon-192.png' && icon.sizes === '192x192',
      ),
      'manifest should include a stable 192px install icon',
    );
    assert.ok(
      manifest.icons.some(
        (icon) => icon.src === '/icons/oasis-icon-512.png' && icon.sizes === '512x512',
      ),
      'manifest should include a stable 512px install icon',
    );
  });

  it('adds only the required Expo web runtime dependency', () => {
    const pkg = readJson('package.json');

    assert.equal(pkg.dependencies['react-native-web'], '~0.19.13');
    assert.equal(pkg.dependencies.workbox, undefined);
    assert.equal(pkg.dependencies['@capacitor/core'], undefined);
  });
});
