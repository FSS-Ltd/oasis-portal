# Mobile versioning

**Status:** In force from the first store release, 1.0.1.

## Problem

The stores need a version for every upload, and parents see it in the App Store and Play listings. Without
a rule, versions drift, a bug fix gets labelled a feature, and nobody can say which build a family is
running.

## Decision

The mobile app uses [semantic versioning](https://semver.org): `MAJOR.MINOR.PATCH`.

- **Source of truth:** `expo.version` in `apps/mobile/app.json`. Nothing else holds the version.
  `apps/mobile/package.json` stays at `0.0.0` because it is private and never published.
- **Build number:** iOS `buildNumber` and Android `versionCode` are separate from the version. EAS
  increments them on every release-candidate build (`appVersionSource: remote`, `autoIncrement: true`).
  Never edit them by hand. One version can have many builds, for example 1.0.1 build 3 after two
  rejected uploads.
- **Guard:** `pnpm --filter @oasis/mobile eas:check` fails if the version is not `X.Y.Z` or is below
  1.0.1. CI runs it.

## Where we start

| Version   | What it was                                      |
| --------- | ------------------------------------------------ |
| 1.0.0     | The PWA, the original release. Never in a store. |
| **1.0.1** | **First App Store and Google Play release.**     |

## Which number to raise

Raise the highest-ranked number the release qualifies for, and reset the numbers after it to zero.

### Patch: 1.0.1 to 1.0.2

Fixes only. A parent sees the same app, working properly.

- Bug fixes, crashes, wrong totals, broken layouts.
- Copy and typo changes.
- Performance work that changes no behaviour.
- Dependency patch updates and security fixes.

It must not add a screen, a permission, a native module or a new kind of data.

### Minor: 1.0.2 to 1.1.0

New capability, and nothing existing stops working.

- A new screen, flow or role capability, for example a new feature in the parent or staff portal.
- A visible redesign of one area.
- A new optional permission, such as notifications. Recheck the privacy answers first (below).
- A new Expo SDK minor update, or a new native module that needs no new data collection.

### Major: 1.1.0 to 2.0.0

A change families have to notice, or one the old app cannot survive.

- Navigation or design overhaul across the whole app.
- Expo SDK major upgrade that raises the minimum iOS or Android version.
- A breaking API change, where old installed apps stop working. This also needs a minimum-version
  gate, see "API compatibility".
- A change to the account model, such as a new sign-in method replacing the old one.
- New categories of data collected, which change the App Privacy and Data safety answers.

When in doubt between two levels, take the higher.

## Release steps

1. Branch `chore/release-mobile-X.Y.Z` from `main`.
2. Change `expo.version` in `apps/mobile/app.json`. Change nothing else for the version.
3. Add one row to the history table below.
4. Open a PR. CI runs `eas:check`, lint, typecheck and tests. Merge when green.
5. Run the **Mobile release** workflow from `main` (Actions, then Run workflow) and approve it in the
   `mobile-release` environment. It refuses a version that already has a `mobile-vX.Y.Z` tag, builds
   with the `release-candidate` profiles and uploads through EAS Submit: iOS to App Store Connect,
   Android as a draft production release.
6. Test the build on TestFlight, and check the draft release in Play Console.
7. Submit for review by hand in App Store Connect and Play Console. When a store accepts it, tag the
   merge commit `mobile-vX.Y.Z` and push the tag.

Do not reuse a version the App Store has accepted. If a release is rejected before approval, the same
version can be uploaded again with a new build number.

## Store paperwork per level

| Level | Store listing "What's new" | Recheck privacy answers        | Screenshots        |
| ----- | -------------------------- | ------------------------------ | ------------------ |
| Patch | Yes, one line              | No                             | No                 |
| Minor | Yes                        | If data or permissions changed | If screens changed |
| Major | Yes                        | Yes                            | Yes                |

## API compatibility

Store users update slowly, so several app versions talk to the API at once.

- Ship API changes before the app that needs them, and keep them additive.
- Remove or change a field only in a Major release, after the old versions have aged out.
- There is no minimum-app-version gate yet. Add one before the first release that breaks the API.

## No over-the-air updates

`expo-updates` is not installed, so every change, including JavaScript-only fixes, goes out as a store
release with a new version. If over-the-air patches are added later, they ship under the same version
and never change what the app does in a Minor or Major way.

## History

| Version | Date | Notes                                   |
| ------- | ---- | --------------------------------------- |
| 1.0.1   |      | First store release (date on approval). |
