import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

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

  requireValue(easConfig.cli?.appVersionSource, 'remote', 'cli.appVersionSource');
  if (typeof easConfig.cli?.version !== 'string' || !easConfig.cli.version.startsWith('>=')) {
    fail('cli.version must pin a minimum EAS CLI version.');
  }

  const internalIos = checkProfile(easConfig.build, 'internal-ios');
  const internalAndroid = checkProfile(easConfig.build, 'internal-android');
  const releaseCandidateIos = checkProfile(easConfig.build, 'release-candidate-ios');
  const releaseCandidateAndroid = checkProfile(easConfig.build, 'release-candidate-android');

  if (internalIos) {
    requireValue(internalIos.distribution, 'internal', 'build.internal-ios.distribution');
    requireValue(internalIos.channel, 'internal', 'build.internal-ios.channel');
    requireValue(internalIos.environment, 'preview', 'build.internal-ios.environment');
    requireValue(internalIos.ios?.simulator, false, 'build.internal-ios.ios.simulator');
  }

  if (internalAndroid) {
    requireValue(internalAndroid.distribution, 'internal', 'build.internal-android.distribution');
    requireValue(internalAndroid.channel, 'internal', 'build.internal-android.channel');
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
      releaseCandidateIos.channel,
      'release-candidate',
      'build.release-candidate-ios.channel',
    );
    requireValue(
      releaseCandidateIos.environment,
      'production',
      'build.release-candidate-ios.environment',
    );
    requireValue(
      releaseCandidateIos.autoIncrement,
      true,
      'build.release-candidate-ios.autoIncrement',
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
      releaseCandidateAndroid.channel,
      'release-candidate',
      'build.release-candidate-android.channel',
    );
    requireValue(
      releaseCandidateAndroid.environment,
      'production',
      'build.release-candidate-android.environment',
    );
    requireValue(
      releaseCandidateAndroid.autoIncrement,
      true,
      'build.release-candidate-android.autoIncrement',
    );
    requireValue(
      releaseCandidateAndroid.android?.buildType,
      'app-bundle',
      'build.release-candidate-android.android.buildType',
    );
  }

  if (easConfig.submit) {
    fail('Store submit profiles must not be added before human approval.');
  }
}

function checkNativeIds() {
  const appConfig = readJson(appConfigPath);
  if (!appConfig) return;

  requireValue(appConfig.expo?.ios?.bundleIdentifier, 'uk.oasis.portal', 'ios.bundleIdentifier');
  requireValue(appConfig.expo?.android?.package, 'uk.oasis.portal', 'android.package');
}

checkEasConfig();
checkNativeIds();

if (failures.length > 0) {
  console.error('EAS build config check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('EAS build config check passed.');
