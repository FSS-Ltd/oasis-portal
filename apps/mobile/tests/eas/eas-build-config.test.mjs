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

  assert.equal(easConfig.cli.appVersionSource, 'local');

  for (const profile of [
    'internal-ios',
    'internal-android',
    'release-candidate-ios',
    'release-candidate-android',
  ]) {
    assert.ok(profiles[profile], `${profile} profile should exist`);
  }

  assert.equal(profiles['internal-ios'].distribution, 'internal');
  assert.equal(profiles['internal-ios'].environment, 'preview');
  assert.equal(profiles['internal-android'].distribution, 'internal');
  assert.equal(profiles['internal-android'].environment, 'preview');
  assert.equal(profiles['internal-android'].android.buildType, 'apk');

  assert.equal(profiles['release-candidate-ios'].distribution, 'store');
  assert.equal(profiles['release-candidate-ios'].environment, 'production');
  assert.equal(profiles['release-candidate-android'].distribution, 'store');
  assert.equal(profiles['release-candidate-android'].environment, 'production');
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

  assert.match(docs, /local\s+app version source/);
});

test('mobile app version is MAJOR.MINOR.PATCH, starts at 1.0.1, and has documented rules', () => {
  const { version } = JSON.parse(readMobile('app.json')).expo;
  const [major, minor, patch] = version.split('.').map(Number);

  assert.match(version, /^\d+\.\d+\.\d+$/);
  assert.ok(major > 1 || (major === 1 && (minor > 0 || patch >= 1)), `${version} is below 1.0.1`);

  const docs = readRepo('docs/mobile-versioning.md');
  for (const heading of ['Patch', 'Minor', 'Major', 'Build number', 'Release steps']) {
    assert.match(docs, new RegExp(heading));
  }
});

test('release-candidate profiles upload to the stores but never send for review', () => {
  const { submit } = JSON.parse(readMobile('eas.json'));

  assert.deepEqual(Object.keys(submit).sort(), [
    'release-candidate-android',
    'release-candidate-ios',
  ]);
  assert.equal(submit['release-candidate-ios'].ios.ascAppId, '6828101515');
  assert.equal(submit['release-candidate-android'].android.track, 'production');
  assert.equal(submit['release-candidate-android'].android.releaseStatus, 'draft');
});

test('the release workflow runs on a version bump, main-only, builds natively, uploads and tags', () => {
  const workflow = readRepo('.github/workflows/mobile-release.yml');

  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /paths: \['apps\/mobile\/app\.json'\]/);
  assert.match(workflow, /git push origin "refs\/tags\/\$\{tag\}"/);
  assert.match(workflow, /environment: mobile-release/);
  assert.match(workflow, /if: github\.ref == 'refs\/heads\/main'/);
  assert.doesNotMatch(workflow, /eas build/);
  assert.match(workflow, /npx expo prebuild --platform ios --clean/);
  assert.match(workflow, /xcodebuild -exportArchive/);
  assert.match(workflow, /<key>destination<\/key><string>upload<\/string>/);
  assert.match(workflow, /\.\/gradlew :app:bundleRelease/);
  assert.match(workflow, /android\.injected\.signing\.store\.file/);
  assert.match(workflow, /track: production\n\s+status: draft/);
  assert.match(workflow, /refs\/tags\/mobile-v\$\{version\}/);
});

test('build numbers follow the version', async () => {
  const { buildNumberFor } = (await import('../../app.config.js')).default;
  assert.equal(buildNumberFor('1.1.0'), 1100);
  assert.equal(buildNumberFor('1.2.3'), 1203);
  assert.equal(buildNumberFor('2.0.0'), 2000);
  assert.throws(() => buildNumberFor('1.10.0'), /does not fit/);
  assert.throws(() => buildNumberFor('1.0.100'), /does not fit/);
});
