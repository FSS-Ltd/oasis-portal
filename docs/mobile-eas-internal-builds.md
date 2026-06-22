# Oasis Mobile EAS Internal Builds

Phase 6 uses Expo EAS for native internal distribution and release-candidate
builds. The temporary PWA path does not replace this app-store path.

## Required Setup

Run all commands from the repo root unless stated otherwise.

Required public runtime values must be configured in the selected EAS
environment before building. Internal profiles use the `preview` EAS
environment. Release-candidate profiles use the `production` EAS environment:

- `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `EXPO_PUBLIC_TRPC_URL`

Do not commit secrets, private Clerk keys, passwords, one-time codes, signing
credentials, provisioning profiles, or test-account credentials. Use EAS
project settings and secrets for build-time values.

Validate the local config first:

```bash
pnpm --filter @oasis/mobile eas:check
```

The package exposes `pnpm --filter @oasis/mobile eas ...`, which runs the
configured `eas-cli@^13.0.0` through `pnpm dlx`. The EAS config uses the remote
app version source so release-candidate build numbers and version codes are
persisted by EAS instead of relying on local file mutations.

## Build Commands

Internal installable builds:

```bash
pnpm --filter @oasis/mobile eas build --platform ios --profile internal-ios
pnpm --filter @oasis/mobile eas build --platform android --profile internal-android
```

Release-candidate artifacts:

```bash
pnpm --filter @oasis/mobile eas build --platform ios --profile release-candidate-ios
pnpm --filter @oasis/mobile eas build --platform android --profile release-candidate-android
```

Human approval is required before any store submission. This PR only configures
build profiles; it does not add `submit` profiles or automate App Store or Play
Console submission.

## Device Install Checklist

- Confirm the build used the expected profile and channel.
- Confirm iOS installs on registered internal test devices.
- Confirm Android installs from the generated APK for `internal-android`.
- Confirm the app opens to the Oasis sign-in screen.
- Confirm Google SSO and email/password auth reach the correct mobile shell for
  the synthetic account used.
- Confirm the build points at the intended `EXPO_PUBLIC_TRPC_URL`.
- Record any blocked device, account, or permission issue before signing off.

## UAT Script

Use synthetic accounts with resettable fixture data.

- Parent: sign in, open Home, Child, Messages, Clubs, Incidents, Permission
  Slips, Fees/Invoices, Calendar, and Shop.
- Student: sign in, confirm the access gate result, Wallet, Learning,
  Attendance, Updates, Activity, Clubs, and Messages.
- Supervisor: sign in, open Staff communications, rota, attendance, behaviour,
  incident, and PACE actions.
- shopkeeper: sign in with shop counter permissions, open Shop pickups, and
  verify pickup queues without collecting a live reservation unless a resettable
  fixture is assigned.
- ClubsAdmin: sign in, open Club manager, roster, attendance, rota, and notices
  without changing live clubs unless a resettable fixture is assigned.

Sign off each path as passed or explicitly blocked with the build URL, device,
platform, account role, and blocker.

## Known Limitations

- EAS build execution requires Expo account access and project linkage that is
  not stored in the repository.
- iOS internal distribution requires registered devices or the approved Apple
  team setup.
- Release-candidate profiles create store-format artifacts but do not submit
  them.
- Mutating UAT steps should only run against synthetic fixtures that can be
  reset after testing.
