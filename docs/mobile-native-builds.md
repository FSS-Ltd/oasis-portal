# Mobile native builds (Xcode and Gradle on GitHub Actions)

CI builds the app with Xcode and Gradle, the same projects you open in Xcode and Android Studio,
instead of queueing builds on EAS. `ios/` and `android/` are not committed: each run generates them
with `expo prebuild` from `app.json` and `app.config.js`, so plugins, versions and build numbers stay
in one place.

Push notifications are unchanged. The app still gets an Expo push token (using
`extra.eas.projectId` in `app.json`) and the API still sends through Expo's push service. Expo
delivers to APNs and FCM with the APNs key and FCM credentials already stored on the Expo project, so
keep the Expo project and those credentials. Only the build service changes.

## Workflows

| Workflow                  | When                         | What it does                                                                                                                                                      |
| ------------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mobile-native-build.yml` | Mobile code merges to `main` | Android release APK (debug-signed, kept 14 days as an artifact to sideload). iOS simulator build that proves the app compiles.                                    |
| `mobile-release.yml`      | Version bump in `app.json`   | iOS: Xcode archive, uploaded to App Store Connect (TestFlight). Android: signed app bundle, uploaded to Play as a draft production release. Tags `mobile-vX.Y.Z`. |

Sending for review stays manual in App Store Connect and Play Console. Internal iOS builds are
TestFlight builds now: there is no ad-hoc install link as there was with EAS internal distribution.

## GitHub setup

Create two GitHub environments: `mobile-preview` and `mobile-release`.

Variables (both environments, same names as the old EAS environment variables):

- `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `EXPO_PUBLIC_TRPC_URL`
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `APPLE_TEAM_ID` (`mobile-release` only), from developer.apple.com > Membership.

Secrets:

| Secret                                                                                        | Environment      | Where it comes from                                                                                                                                                                                              |
| --------------------------------------------------------------------------------------------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GOOGLE_SERVICES_JSON`                                                                        | both             | Contents of the Firebase `google-services.json` (Android push). The same file that was the EAS `GOOGLE_SERVICES_JSON` variable.                                                                                  |
| `ASC_KEY_ID`, `ASC_ISSUER_ID`                                                                 | `mobile-release` | App Store Connect > Users and Access > Integrations > App Store Connect API. The key needs the Admin role so Xcode can create the cloud-managed distribution certificate and profile.                            |
| `ASC_KEY_P8`                                                                                  | `mobile-release` | The full text of the downloaded `AuthKey_XXXX.p8`.                                                                                                                                                               |
| `ANDROID_UPLOAD_KEYSTORE_BASE64`                                                              | `mobile-release` | The upload keystore EAS has been using: `pnpm --filter @oasis/mobile eas credentials` > Android > production > Download keystore. Then `base64 -i keystore.jks`. Use this exact key, or Play rejects the bundle. |
| `ANDROID_UPLOAD_KEYSTORE_PASSWORD`, `ANDROID_UPLOAD_KEY_ALIAS`, `ANDROID_UPLOAD_KEY_PASSWORD` | `mobile-release` | Printed by the same `eas credentials` download.                                                                                                                                                                  |
| `PLAY_SERVICE_ACCOUNT_JSON`                                                                   | `mobile-release` | The Google Play service account JSON used by EAS Submit (Play Console > Users and permissions). It needs release permission for the app.                                                                         |

`EXPO_ACCESS_TOKEN` is no longer used by CI. Keep it until a release has gone through the new
path, then remove it.

## Building on your Mac

```bash
pnpm --filter @oasis/mobile exec expo prebuild --clean
```

Then open `apps/mobile/ios/Oasis.xcworkspace` in Xcode (Product > Archive to upload by hand) or
`apps/mobile/android` in Android Studio. The `EXPO_PUBLIC_*` values must be in your shell or
`.env` when the JS bundle is built. Rerun prebuild after changing `app.json` or a native dependency;
do not edit the generated folders, they are overwritten.

## Fallback

`eas.json` and the manual EAS commands in `docs/mobile-eas-internal-builds.md` still work if a
native CI build is blocked.
