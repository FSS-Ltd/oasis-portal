import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const mobileRoot = path.resolve(import.meta.dirname, '../..');
const repoRoot = path.resolve(mobileRoot, '../..');

function readMobile(relativePath) {
  return readFileSync(path.join(mobileRoot, relativePath), 'utf8');
}

function readRepo(relativePath) {
  return readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

test('mobile package exposes an EAS build config validation command', () => {
  const pkg = JSON.parse(readMobile('package.json'));

  assert.equal(pkg.scripts.eas, 'pnpm dlx eas-cli@^13.0.0');
  assert.equal(pkg.scripts['eas:check'], 'node scripts/check-eas-build-config.mjs');
  assert.ok(existsSync(path.join(mobileRoot, 'scripts/check-eas-build-config.mjs')));

  const result = spawnSync(process.execPath, ['scripts/check-eas-build-config.mjs'], {
    cwd: mobileRoot,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /EAS build config check passed/);
});

test('mobile EAS config defines internal and release-candidate build profiles', () => {
  const easConfig = JSON.parse(readMobile('eas.json'));
  const profiles = easConfig.build;

  assert.equal(easConfig.cli.appVersionSource, 'remote');

  for (const profile of [
    'internal-ios',
    'internal-android',
    'release-candidate-ios',
    'release-candidate-android',
  ]) {
    assert.ok(profiles[profile], `${profile} profile should exist`);
  }

  assert.equal(profiles['internal-ios'].distribution, 'internal');
  assert.equal(profiles['internal-ios'].channel, 'internal');
  assert.equal(profiles['internal-ios'].environment, 'preview');
  assert.equal(profiles['internal-android'].distribution, 'internal');
  assert.equal(profiles['internal-android'].channel, 'internal');
  assert.equal(profiles['internal-android'].environment, 'preview');
  assert.equal(profiles['internal-android'].android.buildType, 'apk');

  assert.equal(profiles['release-candidate-ios'].distribution, 'store');
  assert.equal(profiles['release-candidate-ios'].channel, 'release-candidate');
  assert.equal(profiles['release-candidate-ios'].environment, 'production');
  assert.equal(profiles['release-candidate-ios'].autoIncrement, true);
  assert.equal(profiles['release-candidate-android'].distribution, 'store');
  assert.equal(profiles['release-candidate-android'].channel, 'release-candidate');
  assert.equal(profiles['release-candidate-android'].environment, 'production');
  assert.equal(profiles['release-candidate-android'].autoIncrement, true);
  assert.equal(profiles['release-candidate-android'].android.buildType, 'app-bundle');
});

test('mobile EAS runbook documents env, commands, UAT paths, and approval gates', () => {
  const docs = readRepo('docs/mobile-eas-internal-builds.md');

  for (const text of [
    'EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY',
    'EXPO_PUBLIC_TRPC_URL',
    'pnpm --filter @oasis/mobile eas:check',
    'pnpm --filter @oasis/mobile eas build --platform ios --profile internal-ios',
    'pnpm --filter @oasis/mobile eas build --platform android --profile internal-android',
    'pnpm --filter @oasis/mobile eas build --platform ios --profile release-candidate-ios',
    'pnpm --filter @oasis/mobile eas build --platform android --profile release-candidate-android',
    'preview',
    'production',
    'Parent',
    'Student',
    'Supervisor',
    'shopkeeper',
    'ClubsAdmin',
    'Human approval is required before any store submission',
  ]) {
    assert.match(docs, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }

  assert.match(docs, /remote\s+app version source/);
});
