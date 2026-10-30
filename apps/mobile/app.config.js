// Extends app.json. Android push needs Firebase's google-services.json, which stays out of git:
// upload it to EAS as a secret file variable named GOOGLE_SERVICES_JSON.
module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    ...(process.env.GOOGLE_SERVICES_JSON
      ? { googleServicesFile: process.env.GOOGLE_SERVICES_JSON }
      : {}),
  },
});
