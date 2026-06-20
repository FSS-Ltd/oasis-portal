# Oasis Mobile Phase 6 Closeout

**Status:** Repo-ready; external device, EAS, and UAT signoff still required.  
**Recorded:** 2026-06-20  
**Source commit:** `d0fcb71894105203a9de6a92bedf592bd5319e3d`

Phase 6 has completed the planned repository work for the production mobile
screens, PWA distribution path, native export readiness, EAS build profiles,
and automated harnesses. The remaining closeout items require external access
that is not stored in the repository: Expo/EAS project access, registered
devices, deployed PWA origin, Clerk and Google OAuth configuration, and
synthetic UAT accounts with resettable fixture data.

Do not mark Phase 6 operationally signed off until the external signoff matrix
below is complete.

## Repository-Verified Gates

| Gate | Command or evidence | Result |
| --- | --- | --- |
| Mobile type safety | `pnpm --filter @oasis/mobile typecheck` | Pass |
| Mobile lint | `pnpm --filter @oasis/mobile lint` | Pass |
| Mobile unit, wiring, architecture, e2e harness, EAS, and PWA doc tests | `pnpm --filter @oasis/mobile test` | Pass |
| Production boundary guard | `node --test apps/mobile/tests/architecture/mobile-production-boundaries.test.mjs` | Pass |
| EAS config validation | `pnpm --filter @oasis/mobile eas:check` | Pass |
| PWA static export | `pnpm --filter @oasis/mobile build:web` | Pass |
| PWA readiness validation | `pnpm --filter @oasis/mobile pwa:check` | Pass |
| PWA browser install and offline shell tests | `pnpm --filter @oasis/mobile test:pwa` | Pass |
| iOS Expo export | `pnpm --filter @oasis/mobile exec expo export --platform ios --output-dir /tmp/oasis-mobile-phase6-closeout-doc-ios-export` | Pass |
| Android Expo export | `pnpm --filter @oasis/mobile exec expo export --platform android --output-dir /tmp/oasis-mobile-phase6-closeout-doc-android-export` | Pass |
| Component ownership map | `graphify update .` and `pnpm docs:component-map` | Pass |
| GitHub CI for PR #340 | Lint / Typecheck / Test, Vercel preview deploy, GitGuardian | Pass |

## Local Blocker Probes

| Probe | Command | Result |
| --- | --- | --- |
| Native e2e executable environment | `EXPO_PUBLIC_TRPC_URL=http://127.0.0.1:3000/api/trpc pnpm --filter @oasis/mobile test:e2e` | Blocked: Maestro CLI was not found, and a simulator or emulator with the app installed is required. |
| EAS account state | `pnpm --filter @oasis/mobile eas whoami` | Blocked: EAS CLI returned `Not logged in`. |

## External Signoff Matrix

| Item | Status | Build URL or artifact | Device or browser | Synthetic account role | Tester/date | Blocker |
| --- | --- | --- | --- | --- | --- | --- |
| iOS native mobile e2e | Blocked | Pending EAS/internal build | Registered iOS device or simulator with app installed | Parent, Student, Staff | Pending | Requires Maestro CLI, installed app, runtime env, and synthetic credentials. |
| Android native mobile e2e | Blocked | Pending EAS/internal build | Android device or emulator with app installed | Parent, Student, Staff | Pending | Requires Maestro CLI, installed app, runtime env, and synthetic credentials. |
| iOS EAS internal install | Blocked | Pending EAS internal iOS build | Registered internal iOS device | Any synthetic role | Pending | Requires Expo/EAS login, project access, and Apple device/team setup. |
| Android EAS internal install | Blocked | Pending EAS internal Android APK | Android internal test device | Any synthetic role | Pending | Requires Expo/EAS login and project access. |
| PWA Chromium/Android install | Blocked | Pending HTTPS PWA deployment | Chromium or Android browser | Parent, Student, Staff | Pending | Requires deployed PWA origin and configured runtime API target. |
| PWA iOS Safari install | Blocked | Pending HTTPS PWA deployment | iOS Safari | Parent, Student, Staff | Pending | Requires deployed PWA origin and configured runtime API target. |
| Parent UAT | Blocked | Pending EAS build or PWA URL | iOS, Android, or PWA | Parent | Pending | Requires resettable parent fixture and Clerk/OAuth access. |
| Student UAT | Blocked | Pending EAS build or PWA URL | iOS, Android, or PWA | Student | Pending | Requires resettable student fixture and policy-safe data. |
| Supervisor UAT | Blocked | Pending EAS build or PWA URL | iOS, Android, or PWA | Supervisor | Pending | Requires resettable staff fixture and operational permissions. |
| shopkeeper UAT | Blocked | Pending EAS build or PWA URL | iOS, Android, or PWA | shopkeeper | Pending | Requires shop counter permissions and resettable pickup data. |
| ClubsAdmin UAT | Blocked | Pending EAS build or PWA URL | iOS, Android, or PWA | ClubsAdmin | Pending | Requires club manager permissions and resettable club data. |
| club lead UAT | Blocked | Pending EAS build or PWA URL | iOS, Android, or PWA | Club lead | Pending | Requires assigned-club fixture with attendance, rota, behaviour, and notice data. |
| PWA auth and offline UAT | Blocked | Pending HTTPS PWA deployment | Chromium/Android and iOS Safari | Parent, Student, Staff | Pending | Requires Clerk allowed origin, Clerk redirect URLs, Google OAuth redirect URI, and deployed PWA URL. |

## Access Prerequisites

- Expo/EAS account access for the Oasis mobile project.
- EAS `preview` environment values for `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` and
  `EXPO_PUBLIC_TRPC_URL`.
- Registered iOS internal test devices or approved Apple team setup.
- Android device or emulator capable of installing the internal APK.
- Maestro CLI installed on the machine running native mobile e2e.
- Dedicated synthetic Parent, Student, Supervisor, shopkeeper, ClubsAdmin, and
  club lead credentials.
- Resettable fixture data for messages, fees, permission slips, incidents, shop
  reservations, wallet state, attendance, behaviour, PACE, rota, clubs, and
  notices.
- HTTPS PWA deployment URL for `apps/mobile/dist`.
- PWA origin added to Clerk allowed origins.
- PWA sign-in and callback routes added to Clerk redirect URLs.
- PWA callback route added to Google OAuth redirect URIs.

## Closeout Decision

The repository is ready for external Phase 6 signoff. Operational signoff is
blocked until the matrix above has real build artifacts, devices, testers,
dates, and pass or blocker evidence.
