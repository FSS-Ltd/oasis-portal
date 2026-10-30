import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const mobileRoot = process.cwd();
const easPath = path.join(mobileRoot, 'eas.json');
const appConfigPath = path.join(mobileRoot, 'app.json');

const failures = [];

function fail(message) {
  failures.push(message);
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    fail(`${path.relative(mobileRoot, filePath)} must be valid JSON: ${error.message}`);
    return null;
  }
}

function requireValue(actual, expected, label) {
  if (actual !== expected) fail(`${label} must be ${JSON.stringify(expected)}.`);
}

function checkProfile(profiles, name) {
  const profile = profiles?.[name];
  if (!profile) fail(`build.${name} profile is required.`);
  return profile;
}

function checkEasConfig() {
  if (!fs.existsSync(easPath)) {
    fail('eas.json is required in apps/mobile.');
    return;
  }

  const easConfig = readJson(easPath);
  if (!easConfig) return;

  // Build numbers come from the version in app.config.js (1.1.0 -> 1100), not an EAS counter.
  requireValue(easConfig.cli?.appVersionSource, 'local', 'cli.appVersionSource');
  for (const [name, profile] of Object.entries(easConfig.build ?? {})) {
    if (profile?.autoIncrement !== undefined) {
      fail(`build.${name}.autoIncrement is not allowed; app.config.js sets the build number.`);
    }
  }
  if (typeof easConfig.cli?.version !== 'string' || !easConfig.cli.version.startsWith('>=')) {
    fail('cli.version must pin a minimum EAS CLI version.');
  }

  const internalIos = checkProfile(easConfig.build, 'internal-ios');
  const internalAndroid = checkProfile(easConfig.build, 'internal-android');
  const releaseCandidateIos = checkProfile(easConfig.build, 'release-candidate-ios');
  const releaseCandidateAndroid = checkProfile(easConfig.build, 'release-candidate-android');

  if (internalIos) {
    requireValue(internalIos.distribution, 'internal', 'build.internal-ios.distribution');
    requireValue(internalIos.environment, 'preview', 'build.internal-ios.environment');
    requireValue(internalIos.ios?.simulator, false, 'build.internal-ios.ios.simulator');
  }

  if (internalAndroid) {
    requireValue(internalAndroid.distribution, 'internal', 'build.internal-android.distribution');
    requireValue(internalAndroid.environment, 'preview', 'build.internal-android.environment');
    requireValue(
      internalAndroid.android?.buildType,
      'apk',
      'build.internal-android.android.buildType',
    );
  }

  if (releaseCandidateIos) {
    requireValue(
      releaseCandidateIos.distribution,
      'store',
      'build.release-candidate-ios.distribution',
    );
    requireValue(
      releaseCandidateIos.environment,
      'production',
      'build.release-candidate-ios.environment',
    );
    requireValue(
      releaseCandidateIos.ios?.simulator,
      false,
      'build.release-candidate-ios.ios.simulator',
    );
  }

  if (releaseCandidateAndroid) {
    requireValue(
      releaseCandidateAndroid.distribution,
      'store',
      'build.release-candidate-android.distribution',
    );
    requireValue(
      releaseCandidateAndroid.environment,
      'production',
      'build.release-candidate-android.environment',
    );
    requireValue(
      releaseCandidateAndroid.android?.buildType,
      'app-bundle',
      'build.release-candidate-android.android.buildType',
    );
  }

  // Submission only uploads: iOS lands in App Store Connect (TestFlight), Android as a draft
  // production release. Sending either for review stays a manual step in the store consoles.
  const submitIos = easConfig.submit?.['release-candidate-ios']?.ios;
  const submitAndroid = easConfig.submit?.['release-candidate-android']?.android;
  requireValue(submitIos?.ascAppId, '6828101515', 'submit.release-candidate-ios.ios.ascAppId');
  requireValue(
    submitAndroid?.releaseStatus,
    'draft',
    'submit.release-candidate-android.android.releaseStatus',
  );
  requireValue(
    submitAndroid?.track,
    'production',
    'submit.release-candidate-android.android.track',
  );
  for (const name of Object.keys(easConfig.submit ?? {})) {
    if (!name.startsWith('release-candidate-')) {
      fail(`submit.${name} is not allowed; only release-candidate profiles submit.`);
    }
  }
}

function checkNativeIds() {
  const appConfig = readJson(appConfigPath);
  if (!appConfig) return;

  requireValue(appConfig.expo?.ios?.bundleIdentifier, 'uk.oasis.portal', 'ios.bundleIdentifier');
  requireValue(appConfig.expo?.android?.package, 'uk.oasis.portal', 'android.package');

  // 1.0.0 was the PWA. The first store release is 1.0.1. See docs/mobile-versioning.md.
  const version = appConfig.expo?.version;
  if (typeof version !== 'string' || !/^\d+\.\d+\.\d+$/.test(version)) {
    fail('expo.version must be MAJOR.MINOR.PATCH, for example "1.0.1".');
  } else if (compareVersions(version, '1.0.1') < 0) {
    fail('expo.version must be 1.0.1 or higher. 1.0.0 was the PWA.');
  } else {
    try {
      require(path.join(mobileRoot, 'app.config.js')).buildNumberFor(version);
    } catch (error) {
      fail(error.message);
    }
  }
}

function compareVersions(a, b) {
  const [left, right] = [a, b].map((value) => value.split('.').map(Number));
  for (let i = 0; i < 3; i += 1) if (left[i] !== right[i]) return left[i] - right[i];
  return 0;
}

checkEasConfig();
checkNativeIds();

if (failures.length > 0) {
  console.error('EAS build config check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('EAS build config check passed.');
