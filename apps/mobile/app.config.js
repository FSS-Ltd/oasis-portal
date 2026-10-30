// Extends app.json. Android push needs Firebase's google-services.json, which stays out of git:
// upload it to EAS as a secret file variable named GOOGLE_SERVICES_JSON.

/** Build number from the version: 1.1.0 -> 1100, 1.2.3 -> 1203. See docs/mobile-versioning.md. */
function buildNumberFor(version) {
  const [major, minor, patch] = version.split('.').map(Number);
  if (minor > 9 || patch > 99) {
    throw new Error(
      `Version ${version} does not fit the build number scheme (minor <= 9, patch <= 99).`,
    );
  }
  return major * 1000 + minor * 100 + patch;
}

module.exports = ({ config }) => {
  const buildNumber = buildNumberFor(config.version);
  return {
    ...config,
    ios: { ...config.ios, buildNumber: String(buildNumber) },
    android: {
      ...config.android,
      versionCode: buildNumber,
      ...(process.env.GOOGLE_SERVICES_JSON
        ? { googleServicesFile: process.env.GOOGLE_SERVICES_JSON }
        : {}),
    },
  };
};

module.exports.buildNumberFor = buildNumberFor;
