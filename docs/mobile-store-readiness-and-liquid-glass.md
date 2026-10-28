# Mobile store readiness and Liquid Glass redesign

**Status:** Draft for implementation
**Branch:** `feat/mobile-store-readiness-liquid-glass`
**Scope:** `apps/mobile` only. No API, database or web changes.

## 1. Problem

Two separate problems, one shipped app.

1. **The mobile app cannot be submitted to either store today.**
   - Apple has rejected uploads not built with Xcode 26 (iOS 26 SDK) since 28 April 2026.
   - Google Play has required new apps and updates to target API 36 since 31 August 2026.
   - `apps/mobile` is on Expo SDK 52 (React Native 0.76, React 18). Expo's own guidance for the Xcode 26
     requirement is "upgrade to at least SDK 54". SDK 52 targets API 34/35.
   - `app.json` also lacks an app icon, splash, adaptive icon, a real version, export-compliance
     declaration, permission hygiene and privacy manifest data. There is no privacy policy URL, support URL
     or review demo account anywhere in the repo.
2. **The UI reads as a web dashboard in a phone frame, not a premium iOS app.** Full-bleed crimson/navy
   header bars, 11 to 13 pt text, 8 pt radii with 1.5 pt borders, a custom bottom bar with a bouncing 600 ms
   drawer. The user asked for a premium iOS feel with subtle, purposeful Liquid Glass.

## 2. Findings that shape the design

- The design system is already centralised: 151 files import `C` from `mobile-theme.ts`, 145 import the
  primitives in `mobile-ui.tsx`, and there are zero stray hex literals. Restyling the theme, primitives
  and shell restyles the whole app without touching 200 screen files.
- Navigation is local state, not router routes. `PortalMobileBottomNav` takes `items`, `activeId`,
  `onSelect`. Four portals (parent, student, supervisor smoke, technical support) share it. Roughly 20 staff
  screens use only `PortalMobileHeader`.
- That rules out Expo Router `NativeTabs` for this release. It needs route-based tabs, which means
  restructuring every portal. A glass tab bar built on the existing props keeps all callers unchanged.
- Baseline before changes: `tsc --noEmit` clean, 59 node tests pass.
- Tooling on this machine: Xcode 26.3, iPhone 17 simulators. No Android SDK, so Android is verified by
  JS bundle export and config checks, not by running an emulator.

## 3. Decisions

### D1. Upgrade Expo SDK 52 to 54

SDK 54 is the lowest SDK Expo documents as covered by the Xcode 26 default EAS image, it targets API 36,
and it ships `expo-glass-effect`. It is also the last SDK that still allows the legacy architecture, and this
app already runs the new one.

Rejected: staying on 52 with `image: latest` (Xcode 26 compatibility unconfirmed by Expo, API 36 needs
manual `compileSdkVersion` overrides on an old Gradle toolchain). Rejected for now: SDK 55 to 58. Each adds
breaking changes unrelated to this goal. **Known cost:** SDK 54 is behind latest (58), so a further upgrade
will be needed before the next annual store toolchain cutoff. Tracked as follow-up, not done here.

React 19 applies to `apps/mobile` only. Web, API and UI packages stay on React 18; pnpm keeps per-package
`node_modules`, so they are isolated. `@oasis/api` is consumed by mobile for types only.

### D2. One glass layer, one fallback ladder

New `src/components/core/glass.tsx` is the only place that knows about glass. Everything else uses
`GlassSurface` and `GlassGroup`.

| Condition | Renders |
| --- | --- |
| iOS 26+, reduce transparency off | native `GlassView` (`expo-glass-effect`) |
| iOS below 26, reduce transparency off | `BlurView` (`expo-blur`) with a surface tint |
| Android, web, or reduce transparency on | opaque `C.surface` with a hairline border |

Android gets the opaque path on purpose. `expo-blur` on Android is experimental and the platform has no
glass idiom. Faking one would look worse than flat.

### D3. Where glass goes, and where it does not

Glass is the navigation and control layer that floats above content (HIG). It is never the content.

Used on:
1. Floating tab bar (a `GlassGroup` capsule; the selected item gets a tinted, interactive glass pill that
   slides between items).
2. Header account control and the "More" sheet panel.

Not used on: cards, lists, forms, stat tiles, or any text-heavy surface. No glass on glass; grouped controls
share one container instead.

### D4. Floating tab bar overlays content

The bar is absolutely positioned at the bottom with a safe-area-aware offset, so content scrolls beneath
it and the glass has something to refract. To keep the last item reachable, a new `PortalScrollView`
adds bottom clearance. About 15 `ScrollView` call sites in the four bottom-nav portals switch import to it.
No other behaviour changes.

### D5. Premium iOS visual language, brand preserved

- Canvas `C.bg` stays. Brand crimson stays the primary action colour. Navy stays the ink colour.
- Header: full-bleed colour bar becomes a light header on the canvas (logo, eyebrow, large title, glass
  account control). Portal identity moves to the eyebrow and accent colour (crimson for parent, navy for
  student and staff) instead of the bar fill.
- Type: add an iOS ramp (`type.*`) with Dynamic Type left on. Primitives move from 11 to 13 pt up to
  15 to 17 pt. Titles are not forced bold-800 everywhere.
- Shape: continuous corner curves, 16 to 20 pt card radius, hairline borders, soft `boxShadow`.
- Motion: spring-based, short. The 600 ms multi-bounce drawer is replaced. Reduce Motion disables the
  indicator slide.
- Feedback: pressed states on every tappable primitive, selection haptic on tab change (not on web).
- Layout: a max content width (about 680 pt) centred at the root so iPad, foldables and the PWA do not
  stretch a phone layout.

### D6. Dark mode is out of scope for this release

`C` is a static object of string literals used in `StyleSheet.create` across 151 files. Dynamic colours
would change its type from `string` and ripple through all of them. `userInterfaceStyle` is currently
`automatic` while the UI is light only, which gives a half-dark app (dark keyboard and alerts over a light
canvas). Set it to `light` explicitly until a dedicated dark-mode pass. Apple does not require dark mode.

## 4. Store readiness work (in repo)

- `app.json`: version `1.0.0`; icon, adaptive icon (foreground, background, monochrome), splash;
  `ITSAppUsesNonExemptEncryption: false`; permission strings for camera and photo library; microphone
  and other unused Android permissions blocked; `supportsTablet` kept `true` with the width cap;
  Android edge-to-edge on.
- iOS privacy manifest: declare the required-reason API categories used by the app's dependencies.
- `eas.json` and `scripts/check-eas-build-config.mjs`: keep existing profiles, update the validator and
  its test for the new SDK. No `submit` profile (existing policy: human approval before any submission;
  it also needs Apple and Google identifiers that are not in the repo).
- `docs/mobile-store-submission-checklist.md`: everything that cannot be done from the repo (section 6).

## 5. Failure modes and resilience

| Risk | Mitigation |
| --- | --- |
| SDK upgrade breaks a screen | Typecheck, 59 node tests, vitest, `expo export` for ios, android and web, and a real iOS simulator build and run |
| `expo-glass-effect` crashes on an iOS 26 beta without the API | Guard with `isGlassEffectAPIAvailable()` and `isLiquidGlassAvailable()` before rendering |
| Native module missing in a test or web run | `glass.tsx` imports behind platform checks; unit tests cover the fallback ladder as a pure function |
| Glass hurts legibility over busy content | Tab labels use text colours that pass 4.5:1 on canvas and on glass; reduce transparency gives opaque |
| PWA regresses | `build:web` and `pwa:check` stay in the verification list |
| Tab bar hides the last list item | `PortalScrollView` clearance; checked on simulator |

## 6. Security and privacy

- No new data collected, no new network calls, no analytics, no tracking SDKs. App Privacy answers
  therefore stay: no tracking. Data linked to the user: name, email, user content (messages, homework
  uploads), identifiers, and student records, all for app functionality.
- The app serves children. Privacy policy and children's data handling are legal content owned by the
  school and FSS. This work does not draft legal text.
- No secrets added. `EXPO_PUBLIC_*` values stay in EAS environments.

## 7. Items that need a human (not solvable in the repo)

Detailed in `docs/mobile-store-submission-checklist.md`. Summary of the ones that can block review:

1. **Privacy policy URL and support URL.** Required by both stores. None exists on `apps/web`.
2. **App Review demo account.** Sign-in is mandatory and invite-only. Apple needs working credentials
   and a note explaining that.
3. **Account deletion (Guideline 5.1.1(v)).** Accounts are created by school invitation, which may place
   the app outside the rule, but reviewers often ask. A school must also retain records, so true deletion
   is a policy decision. Needs a business decision, then an in-app request path.
4. **Expo/EAS and store account steps:** `eas init` (project ID), Apple Developer team, App Store Connect
   app record, Play Console app record, signing credentials.
5. **Store listing assets:** screenshots (iPhone 6.9 inch, iPad 13 inch because tablets are supported,
   Android phone), descriptions, age rating and Data safety questionnaires.

## 8. Rollout and rollback

- Land as a single branch behind normal PR review. Nothing ships to a store from CI; submission stays a
  human action.
- First native verification is an EAS `internal-ios` / `internal-android` build on the new SDK, then
  TestFlight and Play internal testing, then the existing UAT matrix in `mobile-phase-6-closeout.md`.
- Rollback: revert the branch. No server or schema change is involved, so server and old builds are
  unaffected.

## 9. Success criteria

1. `pnpm lint`, `pnpm typecheck`, `pnpm test` pass from the repo root.
2. `expo export` succeeds for ios, android and web; `pnpm --filter @oasis/mobile eas:check` and `pwa:check` pass.
3. `expo-doctor` reports no blocking issues.
4. The app builds and runs on an iOS 26 simulator; sign-in, a bottom-nav portal and the More sheet are
   inspected on screen, with glass visible on iOS 26 and the fallback verified.
5. The checklist doc lists every remaining human action with an owner-agnostic, copy-ready instruction.
