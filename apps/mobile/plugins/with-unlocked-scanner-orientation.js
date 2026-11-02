// expo-camera pulls in ML Kit's code scanner, whose activity is locked to portrait. Android 16 ignores
// that lock on tablets and foldables and Play flags it, so strip it at manifest merge time.
const { withAndroidManifest } = require('expo/config-plugins');

const SCANNER_ACTIVITY =
  'com.google.mlkit.vision.codescanner.internal.GmsBarcodeScanningDelegateActivity';

module.exports = function withUnlockedScannerOrientation(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    const application = manifest.application[0];
    application.activity = (application.activity ?? []).filter(
      (activity) => activity.$['android:name'] !== SCANNER_ACTIVITY,
    );
    application.activity.push({
      $: { 'android:name': SCANNER_ACTIVITY, 'tools:remove': 'android:screenOrientation' },
    });
    return config;
  });
};
