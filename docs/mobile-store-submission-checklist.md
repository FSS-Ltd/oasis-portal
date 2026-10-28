# Oasis mobile: App Store and Google Play submission checklist

**Status:** The app is build-ready. Submission is blocked on the items in section 1, none of which can be
done from the repository.
**Applies to:** `apps/mobile`, Expo SDK 54, bundle ID and package `uk.oasis.portal`, version `1.0.0`.
**Design and rationale:** `docs/mobile-store-readiness-and-liquid-glass.md`.

Human approval is required before any store submission. There is deliberately no `submit` profile in
`eas.json`.

## 1. Blockers that need a decision or an account

Work these first. Each one can cause a rejection on its own.

| #   | Item                                                                    | Why it blocks                                                                                                                                                                 | What to do                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Privacy policy URL**                                                  | Required by App Store Connect and Play Console. `apps/web` has no privacy page. The app holds children's records, so this is not optional.                                    | The school and FSS publish a policy covering student data, retention and contact for requests. Put the live URL in both store listings.                                                                                                                                                                                                                                                                                                           |
| 2   | **Support URL and contact**                                             | Required by both stores.                                                                                                                                                      | A page or mailbox that a parent can reach.                                                                                                                                                                                                                                                                                                                                                                                                        |
| 3   | **Review demo account**                                                 | Sign-in is mandatory and invite-only. A reviewer with no login rejects the build under Guideline 2.1.                                                                         | Built: a `review` tenant in the production database (`docs/app-review-tenant.md`). After the API deploy, run `pnpm --filter @oasis/db review:schema`, then `pnpm --filter @oasis/api seed:app-review`. Check that Clerk does not challenge a new device (see section 8). Enter the usernames `oasis-review-staff` and `oasis-review-parent` with their passwords in App Store Connect (App Review Information) and the Play Console (App access). |
| 4   | **Account deletion** (Guideline 5.1.1(v), Play account deletion policy) | Accounts are created by school invitation, which may fall outside the rule, but reviewers often ask. A school must also keep some records, so full deletion is a policy call. | Decide: (a) in-app "Request account deletion" that notifies the school and explains retention, or (b) a written explanation in the review notes that accounts are provisioned by the school and not self-created. Option (a) needs an API procedure and an admin queue. Not built.                                                                                                                                                                |
| 5   | **Production Clerk key**                                                | A local run logged "Clerk has been loaded with development keys". A development key in a store build hits usage limits and is wrong for production.                           | Set `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` to the `pk_live_` key in the EAS `production` environment.                                                                                                                                                                                                                                                                                                                                                |
| 6   | **Production API URL**                                                  | The store build must call the production API over HTTPS.                                                                                                                      | Set `EXPO_PUBLIC_TRPC_URL` in the EAS `production` environment.                                                                                                                                                                                                                                                                                                                                                                                   |
| 7   | **Expo account and project link**                                       | `eas whoami` returned "Not logged in" in the Phase 6 closeout. Project ID is not in the repo.                                                                                 | `pnpm --filter @oasis/mobile eas login`, then `eas init`, and commit the resulting `extra.eas.projectId` and `owner`.                                                                                                                                                                                                                                                                                                                             |

## 2. Apple

- [ ] Apple Developer Program membership for the organisation (individual accounts show a personal seller name).
- [ ] App Store Connect app record: bundle ID `uk.oasis.portal`, name, primary language, SKU.
- [ ] Signing: let EAS manage credentials (`eas credentials`) or supply your own.
- [ ] Build: `pnpm --filter @oasis/mobile eas build --platform ios --profile release-candidate-ios`.
      SDK 54 uses the Xcode 26 image by default, which satisfies Apple's SDK requirement.
- [ ] Upload to TestFlight (`eas submit` by hand, or Transporter) and run the UAT matrix in
      `docs/mobile-phase-6-closeout.md`.
- [ ] **Export compliance.** `ITSAppUsesNonExemptEncryption` is set to `false`. Confirm the app uses only
      HTTPS and operating-system cryptography. If anything else is added, this must change.
- [ ] **Privacy manifest.** Four required-reason categories are declared in `app.json`. After the first
      upload, read any ITMS-91053 emails; Apple lists missing categories there.
- [ ] **App Privacy ("nutrition label").** Draft below, confirm against the legal policy.
- [ ] Age rating questionnaire. The app is a school portal for staff, parents and students. It is not in
      the Kids Category.
- [ ] Screenshots. iPhone 6.9 inch (1320 x 2868) is required. **iPad 13 inch (2064 x 2752) is also
      required** because `supportsTablet` is `true`. To drop the iPad requirement, set
      `ios.supportsTablet` to `false` and rebuild.
- [ ] Review notes: explain that accounts are created by the school, give the demo credentials, and
      state that there is no tracking and no in-app purchase.

### Draft App Privacy answers

Derived from what the code does. Confirm with whoever owns the policy.

- **Tracking:** none. No advertising SDK, no analytics SDK, no cross-app identifiers.
- **Data linked to the user, used for app functionality only:**
  - Contact info: name, email address (Clerk sign-in, family and staff profiles).
  - User content: messages between parents and staff.
  - Identifiers: user ID.
  - Other data: student records shown to the linked parent or staff member (attendance, behaviour,
    academic progress, fees, school calendar).
- **Not collected:** location, health, contacts, browsing history, precise device identifiers.

## 3. Google Play

- [ ] Play Console developer account and app record for `uk.oasis.portal`.
- [ ] Build: `pnpm --filter @oasis/mobile eas build --platform android --profile release-candidate-android`
      (an `.aab`). SDK 54 targets API 36, which meets the 31 August 2026 requirement.
- [ ] The first upload must go through the Play Console by hand; API-driven submission works only after
      that.
- [ ] Play App Signing: accept the default.
- [ ] Data safety form: use the same answers as the App Privacy draft above. No data is shared with third
      parties for advertising. Data is encrypted in transit.
- [ ] Target audience and content: the audience includes under-13s as students, so review Google's
      Families policy requirements before answering.
- [ ] Content rating questionnaire.
- [ ] Store assets: 512 x 512 icon (resize `assets/icon.png`), 1024 x 500 feature graphic, at least two
      phone screenshots.
- [ ] Large screens: Android 16 ignores the `portrait` lock on devices 600 dp and wider for apps
      targeting API 36. The root layout caps content at 680 pt, but test a tablet or a foldable.
- [ ] App access: give the demo credentials.

## 4. Suggested store copy (edit freely)

- **Name:** Oasis
- **Subtitle (30 characters):** Your school, in your pocket
- **Short description (Play, 80 characters):** Messages, attendance, fees and progress for Oasis families and staff.
- **Description:** Oasis is the portal for Oasis Learning Centre. Parents see their child's attendance,
  behaviour, progress and fees in one place, and message staff directly. Students check their wallet,
  learning and timetable. Staff take attendance, record behaviour and manage rotas. Accounts are created
  by the school, so you sign in with the details you were invited with.

## 5. What was and was not verified

Verified on this branch:

- `pnpm lint`, `pnpm typecheck`, `pnpm test` pass from the repo root.
- `expo export` succeeds for iOS, Android and web. `pwa:check` and `eas:check` pass.
- `expo-doctor` 17 of 18. The remaining flag is React 18 under `apps/api`; mobile only imports API
  types, so it is not bundled.
- A native iOS Debug build with Xcode 26.3 runs on an iPhone 17 Pro simulator (iOS 26.3). Native Liquid
  Glass, the sliding selection indicator, the More sheet, sign-in and a large Dynamic Type setting were
  inspected on screen, and the Staff portal (Head) loads real data from the local API.

**Not verified, and why:**

- **Android on a device or emulator.** This machine has no Android SDK. The JS bundle exports, but edge-to-edge
  rendering, the opaque tab bar and back navigation need a real check.
- **iOS below 26 (blur fallback) and Reduce Transparency (opaque fallback).** The decision logic is unit
  tested; the rendering was not inspected because only an iOS 26 runtime is installed.
- **EAS cloud builds and store upload.** No Expo login on this machine.
- **Parent and Student portals against real data.** The simulator held a valid Head session, so the Staff
  portal was checked against the local dev database. No Parent or Student session was available, so the
  floating tab bar and More sheet were checked with sample content in a temporary harness (removed).

## 6. Known follow-ups

- **Expo SDK 54 is behind the latest (58).** Plan an upgrade before Apple's next toolchain cutoff.
- **Dark mode.** The UI is light only and `userInterfaceStyle` is `light`. A dark pass needs the colour
  tokens in `mobile-theme.ts` to become dynamic.
- **Native tab bar.** Expo Router `NativeTabs` would give system glass for free but needs route-based tabs,
  a restructure of every portal.
- **Liquid Glass app icon.** An Icon Composer `.icon` file can replace the flat PNG for the iOS 26 icon
  treatment. Optional.
- **`eas-cli` is pinned to `^13.0.0`** in `package.json` and a test. If EAS rejects the config, bump it and
  the test together.
- **Global `expo-cli` on this machine.** An old `expo-cli` at `/usr/local/bin/expo` shadows the project
  CLI when invoked outside a package script and corrupts `.gitignore`. Always use `pnpm ios`, `pnpm start`
  or `pnpm exec expo`.
- **Screens not individually redesigned.** The theme, primitives, header, tab bar, More sheet and sign-in
  carry the new look to every screen that uses them. Screens with local `fontSize` values (about 11 to 14
  pt) still read denser than the primitives and are the next candidates for a pass.

## 7. Running the app locally (what was found on this machine)

The app calls `http://localhost:3000/api/trpc` unless `EXPO_PUBLIC_TRPC_URL` is set. For a signed-in
portal you need Docker Postgres and the web/API server running.

1. Docker Desktop, then `docker compose up -d postgres` from the **main checkout** (so the existing
   `oasis-portal_oasis-postgres-data` volume is reused). Database `oasis_dev`, roles `oasis` and `oasis_app`.
2. The web/API server on port 3000 using the main checkout's `.env.local` (same Clerk instance and the
   keys the data was encrypted with): `pnpm --filter @oasis/web exec next dev -p 3000`.
3. Metro: `pnpm --filter @oasis/mobile start`, then open the installed app. Use `pnpm`, not a bare `expo`
   (see the global `expo-cli` note in section 6).

**The local database is behind this branch.** Nine migrations are pending (safeguarding, user agreements,
account deletion, the realtime delivery set, diagnostic PACE chart), and Prisma reports the history has
diverged: `20260526120000_student_portal` is recorded as applied but no longer exists in
`packages/db/prisma/migrations`. The migrations table also holds six unfinished rows. A plain
`pnpm db:migrate` will refuse. Resolving this means either marking the missing migration with
`prisma migrate resolve` or resetting the volume (`pnpm db:dev:reset`, which deletes the 19 local users).
Screens that depend on the newer tables may error until this is decided.

## 8. Review accounts runbook

Design: `docs/app-review-tenant.md`. Reviewer data lives in the `review` schema of the production
database. Live users never see it, and reviewers never see `public`.

1. **One-time GitHub setup.** Under Settings > Environments, create an environment called `App Review`.
   Add yourself as a required reviewer, and add the secrets `OASIS_APP_REVIEW_STAFF_PASSWORD` and
   `OASIS_APP_REVIEW_PARENT_PASSWORD` (values from `app-review-credentials.env`).
2. Merge to `main`. The production deploy ships the API change, then refreshes the `review` tables with
   "Refresh app review schema". That step never reseeds, and a failure in it does not fail the deploy.
3. Seed: in Actions, open **App Review Seed**, choose Run workflow on `main` and type
   `reset-review-schema`. Approve the run when GitHub asks. It rebuilds the `review` schema, recreates
   the synthetic data and sets both logins and passwords. The Clerk and encryption keys come from the
   production Vercel environment, as in the deploy job.
   **Do not run it while a review is in progress:** it wipes sandbox data, resets the passwords and
   signs the reviewers out.
   Manual equivalent: `pnpm --filter @oasis/db review:schema --recreate`, then
   `pnpm --filter @oasis/api seed:app-review`, with the production env and
   `OASIS_APP_REVIEW_SEED_CONFIRMATION=reset-review-schema`.
4. Clerk dashboard, production instance. These cannot be set from code:
   - **Multi-factor:** leave "Require MFA" off. The seeder strips any factor from the two review users.
   - **New-device verification (Client Trust):** the review accounts have no email, so Clerk has
     nowhere to send a new-device code. Confirm that a password sign-in on a fresh simulator goes
     straight in. If it does not, turn Client Trust off.
   - **Username:** the review accounts are username-only, like student logins, so Clerk usernames
     must stay enabled. The sign-in field is labelled "Email or username".
5. Sign in with both accounts on a TestFlight build before submitting.
6. If a deploy's "Refresh app review schema" step fails (a change it cannot apply in place), run
   **App Review Seed** again between reviews.

Rollback: delete the two Clerk users, then run `DROP SCHEMA review CASCADE`.
