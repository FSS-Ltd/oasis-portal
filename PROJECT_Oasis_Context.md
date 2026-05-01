# PROJECT: Oasis Learning Centre Portal — Context

**Last updated:** 2026-05-01
**Agent:** Technical Agent (Codex)
**Phase:** Production Prisma runtime fix.

---

## Problem statement

Oasis Learning Centre is commissioning a bespoke centre-management platform
— not an LMS, not an off-the-shelf SIS. The platform must support
attendance, behaviour (merits & demerits), a three-account merit economy
(Spend / Saving / Investment), weekly tithe, an in-app shop, clubs
tracking, leaderboards, parent↔staff messaging, and termly reports. It
ships as a single Next.js 15 web app plus an Expo iOS/Android mobile app,
with role-aware shells for staff, parents, and students. All hosting is
UK/EU; all personal data is envelope-encrypted at the column level so a
raw DB dump cannot re-identify anyone.

## Current status - Production Prisma runtime packaging fix

Working branch: `fix/prisma-query-engine-vercel`.

**PR scope:** Fix production Prisma Client runtime packaging for Vercel so the
Clerk `/post-sign-in` handoff can resolve the local user without crashing.

Changed scope:

- Added Prisma's `@prisma/nextjs-monorepo-workaround-plugin` to `@oasis/web`
  and wired `PrismaPlugin` into server-side Next webpack builds.
- Added a root `postinstall` script that runs `pnpm --filter @oasis/db generate`
  so Vercel regenerates the Prisma client during dependency install.
- Confirmed the existing Prisma schema already includes
  `binaryTargets = ["native", "rhel-openssl-3.0.x"]`; this branch fixes the
  missing Vercel bundle asset, not the target list.

Verification:

- `pnpm --filter @oasis/web lint` - pass.
- `pnpm --filter @oasis/web typecheck` - pass.
- `pnpm --filter @oasis/db generate` - pass.
- `pnpm --filter @oasis/web build` - pass.
- Checked `.next` output and route trace files; `/post-sign-in`,
  `/api/clerk/webhook`, and `/api/trpc/[trpc]` now include
  `libquery_engine-rhel-openssl-3.0.x.so.node` and `schema.prisma`.
- `pnpm run postinstall` - pass.
- `graphify update .` - completed; graphify rebuilt the code graph without
  tracked graph output changes.

Notes:

- The production error digest `748418499` was caused by Prisma failing before
  `createContext` could resolve the Clerk user. User creation may still require
  the Clerk webhook to replay or the user to sign up again after redeploy.
- A secret-like value was visible in `.env.production` editor context during the
  session; rotate the affected production secret if it is active.

## Previous status - Supabase SSR + Vercel CI/CD

Working branch: `chore/supabase-vercel-cicd`.

**PR scope:** Add Supabase SSR client utilities for web data features and move
production deployment behind GitHub Actions CI/CD with Vercel prebuilt deploys.

Changed scope:

- Added `@supabase/ssr` to `@oasis/web`.
- Added browser and server Supabase client helpers under
  `apps/web/src/lib/supabase`, with shared validation for the browser-safe
  Supabase URL and publishable key.
- Kept Clerk as the only auth authority and left `apps/web/src/middleware.ts`
  unchanged.
- Extended `.github/workflows/ci.yml` so same-repo pull requests create Vercel
  preview deployments after checks pass, while forked pull requests skip deploy
  secrets.
- Added gated production deployment on `main`: run CI, apply production
  migrations using GitHub secrets, then build and deploy Vercel prebuilt output
  from the repository root, allowing the Vercel project root-directory setting
  (`apps/web`) to resolve once.
- Added explicit Vercel deploy secret preflight checks so missing GitHub Actions
  secrets fail with named missing keys before the Vercel CLI attempts auth.
- Let Vercel CLI commands read `VERCEL_TOKEN` from the CI environment instead
  of passing the token as a command-line flag.
- Added the Vercel build-time environment allowlist to `turbo.json` so
  Turborepo strict env mode does not strip required variables during
  `@oasis/web#build`.
- Added `apps/web/vercel.json` with `git.deploymentEnabled: false` so native
  Vercel Git deployments do not race the GitHub Actions prebuilt deployment
  checks on pull requests or `main`.
- Added `pnpm.onlyBuiltDependencies` in `package.json` for the build-script
  packages pnpm 10 reported during CI installs.
- Upgraded `@oasis/web` from `next`/`eslint-config-next` 15.0.3 to 15.5.15
  after Vercel blocked deployments for a vulnerable Next.js version.
- Updated Next config for 15.5: moved `typedRoutes` out of `experimental` and
  set an explicit repository `outputFileTracingRoot` so local/global lockfiles
  do not confuse workspace-root detection.
- Normalised internal unauthenticated redirects/forms to `/sign-in/` because
  Next 15.5 typed routes model the Clerk optional catch-all sign-in route as a
  slash-suffixed dynamic route.
- Investigated preview deployment
  `oasis-portal-dega3aszu-jean-fidele-ntagengwas-projects.vercel.app`; Vercel
  runtime logs showed `@clerk/nextjs: Missing publishableKey` for `GET /`,
  confirming the deployed middleware could not read a Clerk publishable key.
  `vercel env ls preview` showed `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` exists,
  but `vercel env pull --environment=preview` pulled it as an empty string.
- Added a reusable env-file validator and wired it after `vercel pull` for
  preview and production deploy jobs so missing or empty Vercel build-time
  public env vars fail before `vercel build`/`vercel deploy`. The public
  build-time values now come from GitHub Actions secrets because Sensitive
  Vercel variables are intentionally pulled as empty strings by the CLI. Runtime
  secrets stay in Vercel.
- Updated `docs/runbook.md` with required GitHub secrets, Vercel root-directory
  setting, migration order, rollback guidance, Turbo env allowlisting, and the
  `vercel pull` missing credentials failure mode.

Verification:

- `ruby -e "require 'yaml'; YAML.load_file('.github/workflows/ci.yml')"` -
  pass.
- `CI=true pnpm install --frozen-lockfile` - pass after rerunning with network
  access to restore `node_modules`.
- `pnpm --filter @oasis/db generate` - pass.
- `pnpm --filter @oasis/web lint` - pass after replacing unsafe generic
  return types with explicit Supabase client aliases.
- `pnpm --filter @oasis/web typecheck` - pass.
- `pnpm lint` - pass.
- `pnpm typecheck` - pass.
- `pnpm test` - pass.
- `pnpm --filter @oasis/web build` - pass.
- `gh api repos/jntagengwa/oasis-portal/actions/secrets --jq '.secrets[].name'`
  - returned no repository-level Actions secrets; `VERCEL_TOKEN` is not
    currently configured in GitHub.
- `ruby -e "require 'yaml'; YAML.load_file('.github/workflows/ci.yml')"` -
  pass after adding Vercel secret preflight checks.
- `git diff --check` - pass after the Vercel deploy workflow update.
- `pnpm exec turbo run build --filter=@oasis/web --dry=json` - pass after the
  `turbo.json` env allowlist update.
- `pnpm --filter @oasis/web build` - pass after the `turbo.json` env allowlist
  update.
- `pnpm exec turbo run build --filter=@oasis/web` - pass after the
  `turbo.json` env allowlist update.
- `ruby -e "require 'yaml'; YAML.load_file('.github/workflows/ci.yml')"` -
  pass after running Vercel CLI steps from the repo root.
- `pnpm exec prettier --check package.json apps/web/vercel.json .github/workflows/ci.yml` -
  pass.
- `CI=true pnpm install --frozen-lockfile` - pass with the pnpm
  `onlyBuiltDependencies` allowlist.
- `pnpm rebuild` - pass.
- `pnpm --filter @oasis/web build` - pass after the Vercel CI root-directory
  correction.
- `git diff --check` - pass after the Vercel CI root-directory correction.
- `pnpm view next@15.5.15 peerDependencies` - pass with network approval;
  confirmed React 18 remains supported.
- `pnpm --store-dir .pnpm-store --filter @oasis/web add next@15.5.15 eslint-config-next@15.5.15` -
  pass with network approval.
- `CI=true pnpm --store-dir .pnpm-store install --frozen-lockfile` - pass after
  updating the lockfile.
- `pnpm --filter @oasis/web build` - pass after the Next 15.5.15 upgrade and
  typed-route/config fixes.
- `pnpm --filter @oasis/web typecheck` - pass after rerunning once build had
  regenerated `.next/types`.
- `pnpm --filter @oasis/web lint` - pass.
- `pnpm exec prettier --check apps/web/package.json apps/web/next.config.mjs apps/web/src/app/not-ready/page.tsx apps/web/src/app/post-sign-in/page.tsx PROJECT_Oasis_Context.md` -
  pass.
- `git diff --check` - pass after the Next 15.5.15 upgrade.
- `npx --yes vercel@53.0.1 logs dpl_6sTvuHKuoEWZz4iaKTWs5LW2EF6Z --project oasis-portal-web --scope jean-fidele-ntagengwas-projects --no-follow --status-code 500 --limit 20 --expand` -
  pass; logs showed missing Clerk publishable key for `GET /`.
- `ruby -e "require 'yaml'; YAML.load_file('.github/workflows/ci.yml')"` -
  pass after adding Vercel runtime env validation.
- `node scripts/require-env-file-keys.mjs /private/tmp/oasis-env-test A B` -
  pass.
- `pnpm exec prettier --check .github/workflows/ci.yml docs/runbook.md PROJECT_Oasis_Context.md scripts/require-env-file-keys.mjs` -
  pass.
- `git diff --check` - pass after adding Vercel runtime env validation.
- `graphify update .` - completed; graphify rebuilt the code graph without
  tracked graph output changes.

Notes:

- Required GitHub secrets: `VERCEL_TOKEN`, `VERCEL_ORG_ID`,
  `VERCEL_PROJECT_ID`, `PROD_DATABASE_URL`, and `PROD_DIRECT_URL`.
- As of this session, the repo has no GitHub Actions secrets or environment
  secrets configured for Vercel deploys. Add the required secrets in GitHub
  before expecting preview or production deployment jobs to pass.
- Vercel connector lookup found team `team_qvufVWPpOoZtQcAtRv8KQenE` and project
  `prj_Olv8bn7wGSG7NfeOBP4mRIyNQpzC` (`oasis-portal-web`).
- Vercel project root is expected to be `apps/web`.
- Supabase Auth middleware remains deferred until there is a specific
  Supabase-backed login/session flow.

## Previous status - PACE workflow access

Working branch: `feat/pace-workflow-access`.

**PR scope:** Replace the old Supervisor PACE page with the new design-source
PACE workflow, add scoped PACE access, and expose an Admin PACE route for
full-access users.

Changed scope:

- Added `pace-full-access` and `canUseFullPaceAccess`.
- Added display-only school year labels for Nursery, ABC Reception, and
  Level 1 through Level 13.
- Added ACE/CEE PACE number-to-level and Behind/On Track/Ahead status helpers.
- Added `pace.roster`, extended `pace.forStudent` with date-aware access
  checks and grouped subject record loading, and added write-time access checks
  to `pace.record`.
- Scoped normal Supervisors to today's assigned `StaffShift` year-group bands;
  full-admin and `pace-full-access` users can view and record against all active
  children.
- Replaced `/supervisor/pace` with a shared PACE workflow component and added
  `/admin/pace` with Admin nav visibility for full PACE access.
- Updated PACE UI to match the design-source flow: PACE Progress heading,
  student selector, subject progress table, and score update modal.

Verification:

- `pnpm --filter @oasis/domain test -- rbac.test.ts schoolYears.test.ts subjects.test.ts` - pass; current Vitest argument handling executed the full 112-test domain suite.
- `pnpm --filter @oasis/api test -- pace.router.test.ts` - pass; current Vitest argument handling executed the full 150-test API suite.
- `pnpm --filter @oasis/web typecheck` - pass.
- `pnpm lint` - pass after fixing typed test assertions.
- `pnpm --filter @oasis/web build` - pass; route table includes `/admin/pace`
  and `/supervisor/pace`.
- `pnpm --filter @oasis/web test:e2e -- supervisor-dashboard.spec.ts` - pass
  when rerun with elevated sandbox permissions for the local dev server; one
  unauthenticated supervisor protection smoke passed and five credential-gated
  tests skipped because local E2E credentials are not set.
- `git diff --check` - pass.
- `graphify update .` - completed; graphify rebuilt the code graph.

Notes:

- `design/Oasis Learning Center.zip` was already modified before this branch
  work and remains intentionally unrelated to this implementation.
- PACE records remain append-only; only `StudentSubject.currentPaceNumber`
  advances on passing final tests as before.
- Follow-up: legacy year-group abbreviations such as `Y5` are now
  canonicalised to `Year 5` for PACE status, display labels, and Supervisor
  roster scope matching. This keeps old local data working without changing
  stored values.
- Follow-up: staff-facing year labels now use the short Oasis labels (`ABC`,
  `Level 1`, `Level 5`) without parenthetical stored-year explanations, and
  the Admin student/academic selectors render those labels while preserving
  canonical stored values.
- Follow-up: the shared PACE workflow screen was tightened to match the design
  reference more closely: title, student selector, and record action sit on one
  row; the separate roster/scope card was removed; the student summary is an
  inline avatar row; and the progress table spacing/actions now follow the
  design-source card/table treatment.

## Previous status - MVP student drill-through and parent access

Working branch: `feat/mvp-student-drillthrough`.

**PR scope:** Add the MVP student drill-through experience and parent linked-child
viewing while keeping the change focused on student access, child overview UI,
and the requested active-sidebar nav polish.

Changed scope:

- Added `student-drillthrough-viewer` as a permission tag for staff read-only
  drill-through access.
- Added Head-only control over granting/removing that tag, including invite
  metadata and user tag updates.
- Added child-log drill-through APIs for accessible-student lists, current
  academic-year attendance, behaviour, PACE results, and merit balances.
- Restricted sensitive behaviour in the drill-through to `Head`; non-Head
  full-admin users, tagged staff, and linked parents receive general behaviour
  only.
- Replaced `/admin/students/[id]` with the drill-through layout and moved the
  existing edit/subject/guardian tools behind Head-only `Edit Profile`.
- Added `/parent` and `/parent/children/[id]` for linked-parent viewing.
- Updated admin sidebar styling so only the active nav item gets the blue left
  border.
- Follow-up: replaced the drill-through Attendance list with the design-source
  calendar card and added a Notes tab backed by existing child notes. Sensitive
  notes use the existing `sensitive-note-viewer` policy; sensitive behaviour
  remains Head-only on this surface.
- Follow-up: adjusted the Attendance calendar to default to the current month,
  support month back/forward navigation, disable forward navigation past the
  current month, and grey Monday/Saturday/Sunday as centre-closed days.

Verification:

- `pnpm --filter @oasis/domain test -- rbac.test.ts` - pass; package test
  runner executed 105 domain tests.
- `pnpm --filter @oasis/api test -- childNotes.router.test.ts behaviour.router.test.ts student.router.test.ts` - pass; current Vitest argument handling executed 137 API tests.
- `pnpm --filter @oasis/api typecheck` - pass.
- `pnpm --filter @oasis/web typecheck` - pass.
- `pnpm lint` - pass.
- `pnpm --filter @oasis/web build` - pass; route table includes `/parent` and
  `/parent/children/[id]`.
- `git diff --check` - pass.
- `graphify update .` - completed; graphify rebuilt the code graph.
- Follow-up checks on the attendance calendar and Notes tab:
  `pnpm --filter @oasis/api test -- childNotes.router.test.ts`,
  `pnpm --filter @oasis/api typecheck`,
  `pnpm --filter @oasis/web typecheck`, `pnpm lint`,
  `pnpm --filter @oasis/web build`, `git diff --check`, and
  `graphify update .` all passed.
- Calendar navigation follow-up checks: `pnpm --filter @oasis/web typecheck`,
  `pnpm lint`, `pnpm --filter @oasis/web build`, `git diff --check`, and
  `graphify update .` all passed. The first typecheck attempt was run in
  parallel with `next build` and failed because `.next/types` was being
  regenerated; rerunning after build completed passed.

Notes:

- `design/Oasis Learning Center.zip` was already modified before this branch
  work and remains intentionally unrelated to this implementation.

## Previous status - Web UI component refactor

Working branch: `chore/refactor-web-ui-components`.

**PR scope:** Refactor Oasis web UI code into reusable typed primitives and
smaller feature components without changing tRPC contracts, RBAC, routes,
database schema, or product behaviour.

Changed scope:

- Added shared web UI primitives for typed data tables, badges, avatars, empty
  states, panels, stat cards, motion wrappers, and display helpers.
- Replaced hand-written table markup in students, attendance, audit, and staff
  permission-tag screens with the typed `DataTable<T>` component.
- Split Supervisor dashboard overview utilities and presentation into
  feature-local components.
- Split child snapshot controls, utilities, and visual widgets out of the main
  snapshot client.
- Split academic settings PACE policy and standard-year panels into
  feature-local components.
- Split Head rota date/shift utilities and week schedule presentation into
  feature-local components.
- Moved shared table, badge, avatar, empty-state, and row styles from
  `admin.css` into `styles/primitives.css`.
- Kept the existing `components/admin/motion.tsx` import path as a compatibility
  re-export over the new shared motion primitives.

Verification:

- `pnpm --filter @oasis/web typecheck` - pass.
- `pnpm lint` - pass.
- `pnpm --filter @oasis/web build` - pass.
- `pnpm --filter @oasis/web test:e2e -- supervisor-dashboard.spec.ts` - first
  sandboxed run failed because Next could not bind `0.0.0.0:3000` (`EPERM`);
  escalated run passed the one runnable unauthenticated supervisor protection
  test, with five credential-gated tests skipped.
- `git diff --check` - pass.
- `graphify update .` - completed; graphify rebuilt the code graph.

## Previous status - PR-2.11 follow-up child log and behaviour reporting

Working branch: `fix/phase-2-pr2.11a-attendance-supervisor-rbac`.

**PR scope:** Implement the requested follow-up work between PR-2.11 and
PR-2.12: attendance recorder RBAC/tag changes, child notes/snapshot, and Head
behaviour reporting. The local branch contains the stacked PR-2.11a/2.11b/2.11c
scope until it is split or reviewed.

Changed scope:

- Added permission tags `attendance-recorder`, `sensitive-note-viewer`, and
  `behaviour-viewer`.
- Restricted student attendance marking to Head or `attendance-recorder`, while
  preserving existing attendance reads and `attendance-exporter` CSV access.
- Renamed the visible Supervisor daily-workflow shell copy from Staff Portal to
  Supervisor Portal.
- Added encrypted `ChildNote` storage, `childNotes.create`,
  `childNotes.listForStudent`, and `childLog.snapshot`.
- Added `/admin/snapshot` and `/supervisor/snapshot` with child dropdown,
  previous-day default range, previous-week/custom range options, child note
  creation, and snapshot sections for passed tests, behaviour, tardiness, and
  notes.
- Added `behaviour.dailyMerits`, `behaviour.trends`, and `/admin/behaviour`
  with daily merit activity plus daily/weekly/monthly trend chart.
- Gated behaviour reporting to Head, HeadOfDiscipline, or `behaviour-viewer`.
- Kept Sensitive behaviour note text out of reporting responses, and filtered
  Sensitive child notes to Head or `sensitive-note-viewer`.

Verification so far:

- `pnpm db:generate` - pass.
- `pnpm --filter @oasis/api typecheck` - pass.
- `pnpm --filter @oasis/web typecheck` - pass.
- `pnpm --filter @oasis/domain test -- rbac.test.ts` - pass, 103 tests because
  the package suite runs.
- `pnpm --filter @oasis/api test -- attendance.router.test.ts` - pass, 128
  tests because the API suite runs.
- `pnpm --filter @oasis/api test -- childNotes.router.test.ts` - pass, 130
  tests because the API suite runs.

## Previous status - PR-2.11 Behaviour and PACE entry UI

Working branch: `feat/phase-2-pr2.11-behaviour-pace-entry-ui`.

**PR scope:** Add focused Supervisor daily-workflow pages while keeping
`/supervisor` as a quick overview/action launcher. No API RBAC changes, role
changes, or Prisma migrations are planned for this branch.

Changed scope:

- Marked PR-2.10 and PR-2.10a merged in the Phase 2 build plan.
- Replaced deferred Behaviour and PACE quick actions with links to focused
  `/supervisor/behaviour` and `/supervisor/pace` pages.
- Added focused `/supervisor/attendance`, `/supervisor/behaviour`,
  `/supervisor/pace`, and `/supervisor/rota` routes.
- Kept `/supervisor` as a quick overview surface with action cards and summary
  stats instead of embedding all workflow forms in the dashboard.
- Replaced the repeated dashboard summary cards with a weekly schedule panel,
  pending messages/swap requests, and staff notices. The week panel highlights
  today, greys past days, and shows shift time plus year-group band.
- Added staff-visible `rota.mySwapRequests` so Supervisors can see pending swap
  requests involving them. Message and notice dashboard adapters are shaped
  around the existing schema and currently render empty/not-connected states
  until those APIs are implemented.
- Reused the existing staff attendance roster as the shared selected-student
  workflow for Behaviour and PACE entry.
- Added Behaviour logging with General/Sensitive visibility, Merit/Demerit type,
  Merit amount, category, note, success/error states, and General-only
  Supervisor activity reads after save.
- Added PACE progress and recording with assigned subjects, independent current
  PACE numbers, recent records, daily-limit warnings, and hard-block error
  display.
- Extended Supervisor Playwright coverage for the new workflow where local E2E
  credentials and seeded state are available.

Verification:

- `pnpm --filter @oasis/api test -- rota.router.test.ts` - pass, 127 tests due
  the current Vitest argument handling running the full API suite.
- `pnpm --filter @oasis/web typecheck` - pass after separating dashboard and
  workflow routes.
- `pnpm --filter @oasis/api typecheck` - pass.
- `pnpm lint` - pass.
- `pnpm test` - pass.
- `pnpm --filter @oasis/web build` - pass; `/supervisor`,
  `/supervisor/attendance`, `/supervisor/behaviour`, `/supervisor/pace`, and
  `/supervisor/rota` appear in the route table.
- `pnpm --filter @oasis/web test:e2e -- supervisor-dashboard.spec.ts` - failed
  in the default sandbox because Playwright could not bind `0.0.0.0:3000`
  (`EPERM`). The escalated run started but timed out waiting 120 seconds for
  the configured web server to become ready after ports 3000 and 3001 were
  already occupied.
- Browser smoke against `http://127.0.0.1:3005/supervisor` reached the local
  dev server but returned `500 Internal Server Error`; server logs showed
  repeated same-port proxy `socket hang up` errors, and direct `curl` timed out.
  Production build remains green.
- `graphify update .` - completed after the dashboard overview redesign;
  graphify reported the existing node-count warning and rebuilt the code graph.

## Previous status - PR-2.10a role-aware auth redirects

Working branch: `fix/phase-2-pr2.10a-role-aware-auth-redirects`.

**PR scope:** Route Clerk post-auth traffic through a shared role-aware redirect
without changing API RBAC, role definitions, or the existing admin and
Supervisor guards.

Changed scope:

- `apps/web/src/app/post-sign-in/page.tsx` - adds a server-side post-auth route
  that resolves the Oasis session and sends full-admin users to `/admin`,
  Supervisors to `/supervisor`, and other valid Phase 2 roles to `/not-ready`.
- `apps/web/src/app/not-ready/page.tsx` - adds the authenticated fallback page
  for roles whose portal is not yet available.
- `apps/web/src/app/(auth)/sign-in/[[...sign-in]]/page.tsx` and
  `apps/web/src/app/(auth)/sign-up/[[...sign-up]]/page.tsx` - point Clerk
  redirects at `/post-sign-in` instead of hard-coding `/admin`.
- `apps/web/src/middleware.ts` - protects `/supervisor`, `/post-sign-in`, and
  `/not-ready` alongside the existing protected staff/auth routes.
- `apps/web/tests/e2e/supervisor-dashboard.spec.ts` - asserts role-aware landing
  behavior where credentials are available and adds an unauthenticated
  `/supervisor` protection smoke test.

Verification:

- `pnpm --filter @oasis/web typecheck` - pass.
- `pnpm lint` - pass.
- `pnpm typecheck` - pass.
- `pnpm --filter @oasis/web build` - pass; `/post-sign-in`, `/not-ready`, and
  `/supervisor` appear in the route table.
- `pnpm --filter @oasis/web test:e2e -- supervisor-dashboard.spec.ts` - pass
  after installing the missing Playwright Chromium browser; 1 runnable
  unauthenticated `/supervisor` protection test passed and 5 credential-gated
  tests skipped because local E2E Head, Supervisor, Exporter, and Parent
  credentials are not set.
- `graphify update .` - completed; graphify reported the existing graph
  node-count warning.

## Previous status - PR-2.10 attendance capture UI

Working branch: `feat/phase-2-pr2.10-attendance-capture-ui`.

**PR scope:** Supervisor attendance capture plus consistent logout affordance for
authenticated staff shells. Behaviour and PACE entry remain in PR-2.11.

Changed scope:

- `apps/api/src/routers/attendance.ts` - adds staff-readable
  `attendance.listYearGroupBands` for active configured bands so Supervisor
  attendance can filter/group the roster without Head-only admin procedures.
- `apps/web/src/components/attendance/attendance-capture.tsx` - extracts shared
  attendance date, mark, row-level save/error, band filter, and CSV export UI.
- `apps/web/src/app/(admin)/admin/attendance/attendance-roster.tsx` - keeps the
  Head attendance page on the shared capture component.
- `apps/web/src/app/(supervisor)/supervisor` - replaces the roster preview with
  real attendance capture, enables the Attendance quick action/nav target, and
  conditionally shows CSV export only for full-admin or `attendance-exporter`
  users.
- `apps/web/src/components/auth/logout-button.tsx` plus admin/supervisor
  layouts - adds Clerk logout controls in desktop sidebar footers and mobile
  headers, redirecting to `/sign-in`.
- `apps/web/tests/e2e/supervisor-dashboard.spec.ts` - expands credential-gated
  coverage for attendance controls, band filtering, hidden untagged export,
  tagged exporter visibility, and logout.

Verification:

- `pnpm --filter @oasis/api test -- attendance.router.test.ts` - pass, 126 tests
  due the current Vitest argument handling running the full API suite.
- `pnpm --filter @oasis/api typecheck` - pass.
- `pnpm --filter @oasis/web typecheck` - pass.
- `pnpm lint` - pass.
- `pnpm typecheck` - pass.
- `pnpm test` - pass.
- `pnpm --filter @oasis/web build` - pass; `/supervisor` remains in the route
  table.
- `pnpm --filter @oasis/web test:e2e -- supervisor-dashboard.spec.ts` - local
  Playwright web server bind required escalation; after approval the run hung
  without test output and was stopped. Direct Playwright exec also hung without
  output and was stopped.
- Local dev server started at `http://127.0.0.1:3004`; bounded `curl` checks
  against `/`, `/supervisor`, and `/admin/attendance` timed out in this sandbox
  after compiling middleware.

## Previous status - Admin invite UX fix

Working branch: `fix/admin-invite-status-format`.

**PR scope:** Improve the admin staff invitation success display without
changing Clerk invitation behavior.

Changed scope:

- `apps/web/src/app/(admin)/admin/staff/invite-user-form.tsx` - replaces the raw
  success sentence and long Clerk URL output with a structured success panel,
  status badge, truncated URL display, copy action, and open-link action.
- `apps/web/src/app/(admin)/admin/admin.css` - adds responsive styles for the
  invite result panel so long invitation URLs do not overflow the form.

Verification:

- `pnpm --filter @oasis/web typecheck` - pass.
- `pnpm --filter @oasis/web lint` - pass.
- `git diff --check` - pass.
- `graphify update .` - completed; graphify reported the existing graph
  node-count warning.
- Browser smoke at `http://localhost:3003/admin/staff` - page renders with no
  Next error overlay. Console reports the existing missing favicon 404 and Clerk
  development-key warning. The invite form was not submitted to avoid creating a
  real Clerk invitation during verification.

## Previous status - Phase 2 Head rota scheduler

Phase 0, all four Sprint 1 PRs (PR-1.1 → PR-1.4), Sprint 2 PR-1.5 →
PR-1.8, and PR-1.9 docs closeout are merged to `main`. PR-2.0 Phase 2
planning, PR-2.1 attendance workflow, PR-2.2 behaviour logging API, PR-2.3
UK school years and centre groups, and PR-2.4 staff rota and availability
workflow are merged. PR-2.5 subject management and PACE write rules is merged
via PR #27. PR-2.6 PACE progress read model is merged via PR #28. PR-2.7 Head
academic settings is merged via PR #29, with follow-up fix PR #30 also merged.
PR-2.8 Head rota scheduler is merged via PR #31. PR-2.9 Supervisor daily
dashboard shell is ready for review on
`feat/phase-2-pr2.9-supervisor-dashboard-shell`.

### PR-2.9 ready for review - `feat/phase-2-pr2.9-supervisor-dashboard-shell`

**PR scope:** Supervisor web dashboard shell and staff self-service rota
orientation. Attendance capture, behaviour entry, and PACE entry remain in
PR-2.10/PR-2.11.

Changed scope:

- `apps/api/src/routers/rota.ts` - adds `rota.swapCandidates`, a staff-readable
  candidate shift query for swap requests that excludes the caller's own shifts
  and returns minimal staff/band display data.
- `apps/api/src/__tests__/rota.router.test.ts` - covers staff RBAC, Parent and
  Student denial, own-shift exclusion, and candidate display metadata.
- `apps/web/src/components/admin/require-full-admin.tsx` - adds
  `getStaffUser`/`assertStaffUser` over the shared staff RBAC guard.
- `apps/web/src/app/(supervisor)/supervisor` - adds the Supervisor-labelled
  route shell and daily dashboard with active students, today's rota, weekly
  rota, availability editing, and shift-swap request controls.
- `apps/web/src/components/supervisor/supervisor-nav.tsx` and existing admin CSS
  - add the Supervisor navigation and focused layout styles.
- `apps/web/tests/e2e/supervisor-dashboard.spec.ts` - adds credential-gated
  Playwright smoke coverage for full-admin access, Supervisor workflow loading,
  availability submit, and non-staff denial.

Verification:

- `pnpm --filter @oasis/api test -- rota.router.test.ts` - pass, 125 tests due
  the current Vitest argument handling running the full API suite.
- `pnpm --filter @oasis/api typecheck` - pass.
- `pnpm --filter @oasis/web typecheck` - pass.
- `pnpm typecheck` - pass.
- `pnpm lint` - pass.
- `pnpm test` - pass.
- `pnpm --filter @oasis/web build` - pass; `/supervisor` appears in the route
  table.
- `pnpm --filter @oasis/web test:e2e -- supervisor-dashboard.spec.ts` - pass
  with 3 credential-gated tests skipped because local E2E Head, Supervisor, and
  Parent credentials are not set.

### PR-2.8 merged - `feat/phase-2-pr2.8-head-rota-scheduler`

Merged via PR #31 on 2026-04-29.

**PR scope:** Head-admin weekly rota scheduler over the PR-2.4 rota API.

Changed scope:

- `apps/api/src/routers/rota.ts` - adds full-admin read procedures for weekly
  schedule data, staff availability, and pending shift-swap requests.
- `apps/api/src/__tests__/rota.router.test.ts` - covers the new Head read
  procedures, full-admin RBAC, inactive/non-staff availability filtering, and
  pending-only swap queue reads.
- `apps/web/src/app/(admin)/admin/rota` - adds the weekly rota scheduler page,
  create/update shift form, availability panel, and swap review queue.
- `apps/web/src/components/admin/admin-nav.tsx` - enables the Rota admin nav
  item.
- `apps/web/src/app/(admin)/admin/admin.css` - adds focused rota layout,
  availability, band swatch, and shift-swap queue styles.

Verification:

- `pnpm --filter @oasis/api test -- rota.router.test.ts` - pass, 124 tests due
  the current Vitest argument handling running the full API suite.
- `pnpm --filter @oasis/api typecheck` - pass.
- `pnpm --filter @oasis/web typecheck` - pass.
- `pnpm typecheck` - pass.
- `pnpm lint` - pass.
- `pnpm test` - pass.
- `pnpm --filter @oasis/web build` - pass after clearing stale `.next` output.
- Browser smoke at `http://localhost:3003/admin/rota` - page renders with no
  Next error overlay; Start/End time fields render side by side without overlap.

### PR-2.7 merged - `feat/phase-2-pr2.7-head-academic-settings`

Merged via PR #29 on 2026-04-29.
Follow-up fix PR #30 merged on 2026-04-29.

**PR scope:** Web-only Head-admin academic settings workflow over existing API
procedures. No Prisma migration is expected.

Changed scope:

- `apps/web/src/app/(admin)/admin/academic` - adds a Head academic settings
  route with standard school years, year-group band management, subject
  management, and PACE policy controls.
- `apps/web/src/components/admin/admin-nav.tsx` - links the admin navigation to
  the new academic settings route.
- `apps/web/src/app/(admin)/admin/students/new/new-student-form.tsx` and
  `apps/web/src/app/(admin)/admin/students/[id]/student-detail.tsx` - default
  year group from date of birth while preserving manual override.
- `apps/web/src/app/(admin)/admin/students/[id]/student-detail.tsx` - adds
  current PACE update controls for existing student subject assignments.
- `apps/api/src/routers/student.ts` - relaxes student and subject ID inputs from
  strict `cuid()` validation to non-empty strings so existing database IDs such
  as `ckstudent...` can open in the detail workflow.
- `apps/web/tests/e2e/head-admin-onboarding.spec.ts` - expands the credentialed
  Head smoke flow for academic settings and current PACE updates.

Verification:

- `pnpm --filter @oasis/web typecheck` - pass.
- `pnpm --filter @oasis/api typecheck` - pass.
- `pnpm --filter @oasis/api test -- student.router.test.ts` - pass, 121 tests
  due the current Vitest argument handling running the full API suite.
- `pnpm lint` - pass.
- `pnpm --filter @oasis/web build` - pass.
- `graphify update .` - completed; graphify reported the existing graph
  node-count warning.
- Browser smoke at `http://localhost:3002/admin/academic` - page renders with
  no Next error overlay. Console still reports the existing missing favicon 404.
- `E2E_BASE_URL=http://localhost:3002 pnpm --filter @oasis/web test:e2e` - 2
  tests skipped because `E2E_HEAD_EMAIL` and `E2E_HEAD_PASSWORD` are not set.

### PR-2.6 merged - `feat/phase-2-pr2.6-pace-progress-read-model`

Merged via PR #28 on 2026-04-29.

**PR scope:** Backend/API PACE progress read model for the supervisor workflow.
No Prisma migration, web UI, or mobile workflow is included.

Changed scope:

- `apps/api/src/routers/pace.ts` — replaces the `pace.forStudent` placeholder
  with a full-admin/Supervisor read model returning assigned subjects, current
  PACE numbers, recent records, today's UTC test count, effective policy, and
  UI warning metadata.
- `apps/api/src/__tests__/pace.router.test.ts` — adds read-model RBAC,
  missing/inactive student, record grouping, policy default, and warning-state
  coverage.
- `docs/phase-2-build-plan.md` and this context file - mark PR-2.6 merged and
  PR-2.7 in progress.

Verification:

- `pnpm --filter @oasis/api test` → pass, 121 tests.
- `pnpm --filter @oasis/api typecheck` → pass.
- `pnpm lint` → pass.
- `pnpm typecheck` → pass.
- `pnpm test` → pass.
- `graphify update .` → completed; graphify reported an existing graph node-count
  warning but left no tracked graph files changed.

### PR-2.5 merged — `feat/phase-2-pr2.5-subjects-pace-rules`

Merged via PR #27 on 2026-04-29.

**PR scope:** Backend/API subject management (create/update/deactivate), centre-level
PACE policy configuration singleton, and `pace.record` write procedure with full
policy enforcement (daily limit, same-day self/final block, pass threshold). No web
UI, mobile workflow, or PACE read model is included (PR-2.6).

Changed scope:

- `packages/db/prisma/schema.prisma` and migration — add `PacePolicy` singleton model.
- `packages/domain/src/subjects.ts` — subject create/update/deactivate schemas and
  PACE policy/record input schemas.
- `apps/api/src/routers/admin.ts` — adds `listSubjects`, `createSubject`,
  `updateSubject`, `deactivateSubject`, `getPacePolicy`, and `updatePacePolicy`
  procedures with audit rows.
- `apps/api/src/routers/pace.ts` — implements `pace.record` for full-admin and
  Supervisor with policy enforcement, transaction-safe advancement, and audit rows.
- `apps/api/src/__tests__/admin.router.test.ts` — covers subject CRUD RBAC,
  code normalisation, duplicate rejection, policy defaults/update, and audit rows.
- `apps/api/src/__tests__/pace.router.test.ts` — covers RBAC, policy blocks,
  backdated `completedAt` policy windows, passing final advancement, and audit rows.

Verification:

- `pnpm db:migrate` → pass outside sandbox; applied pending local migrations
  through `20260429020000_pace_policy` and reapplied 12 RLS statements.
- `pnpm db:generate` → pass.
- `node scripts/with-env.mjs pnpm --filter @oasis/db exec prisma validate` → pass.
- `pnpm --filter @oasis/api test` → pass, 111 tests.
- `pnpm --filter @oasis/api typecheck` → pass.
- `pnpm lint` → pass.
- `pnpm typecheck` → pass.
- `pnpm test` → pass.
- `pnpm --filter @oasis/web build` → pass.

### PR-2.4 merged — `feat/phase-2-pr2.4-staff-rota-availability`

Merged via PR #26 on 2026-04-29.

**PR scope:** Backend/API staff rota, staff weekly availability, scheduled
shifts, shift swap approval workflow, staff attendance marking, and staff
attendance CSV export. No web scheduler, supervisor dashboard, or mobile
workflow is included.

Changed scope:

- `packages/db/prisma/schema.prisma` and migration
  `20260429010000_staff_rota_availability` — add staff availability windows,
  staff shifts, shift swap requests, and staff attendance records.
- `packages/domain/src/rbac.ts` — adds shared staff-role helpers for
  full-admin plus Supervisor workflows.
- `apps/api/src/routers/rota.ts` — adds staff self-service availability,
  own-rota reads, full-admin staff listing, shift scheduling, and swap request
  approval/rejection procedures with audit rows.
- `apps/api/src/routers/attendance.ts` — adds full-admin staff attendance
  marking and staff attendance CSV export for full-admin or
  `attendance-exporter` users.
- `apps/api/src/__tests__/rota.router.test.ts` and
  `apps/api/src/__tests__/attendance.router.test.ts` — cover availability,
  rota scheduling, swap approval/rejection, staff attendance mark/export, RBAC,
  and audit rows.

Verification:

- `pnpm db:generate` → pass.
- `pnpm --filter @oasis/api test` → pass.
- `pnpm --filter @oasis/api typecheck` → pass.
- `pnpm --filter @oasis/domain typecheck` → pass.
- `pnpm --filter @oasis/db typecheck` → pass.
- `pnpm lint` → pass.
- `pnpm typecheck` → pass.
- `pnpm test` → pass.
- `pnpm --filter @oasis/web build` → pass.
- `graphify update .` → pass.

### PR-2.3 merged — `feat/phase-2-pr2.3-school-years-centre-groups`

**PR scope:** Backend/domain UK school-year calculation and Head-managed
year-group band configuration. No web UI, rota scheduling, or mobile workflow
is included.

Changed scope:

- `packages/domain/src/schoolYears.ts` — adds standard England/Wales school
  year labels, the 31 August cutoff helper, and year-group band validation
  schemas.
- `packages/db/prisma/schema.prisma` and migration
  `20260429000000_year_group_bands` — add `YearGroupBand` and seed Lower
  Primary, Upper Primary, and Secondary defaults.
- `apps/api/src/routers/admin.ts` — adds Head-only list/create/update/deactivate
  procedures for year-group bands with audit rows.
- `apps/api/src/routers/student.ts` — accepts standard school-year overrides and
  derives the create default from date of birth when no override is supplied.
- `docs/phase-2-build-plan.md` — tracked the PR-2.3 scope and handoff status.

Verification:

- `pnpm db:generate` → pass.
- `pnpm --filter @oasis/api test` → pass.
- `pnpm --filter @oasis/domain test` → pass after correcting the Year 11/13
  fixture dates to match the 31 August rule.
- `pnpm lint` → pass.
- `pnpm typecheck` → pass after updating the existing Head student forms to use
  standard-year selects that match the stricter API contract.
- `pnpm test` → pass.
- `pnpm --filter @oasis/web build` → pass.
- `graphify update .` → pass.

Merged via PR #25 on 2026-04-29.

### PR-2.2 merged — `feat/phase-2-pr2.2-behaviour-logging`

**PR scope:** Backend behaviour logging, Sensitive visibility enforcement,
linked Spend ledger rows, audit coverage, and Phase 2 handoff docs. No web or
mobile behaviour UI is included.

Changed scope:

- `apps/api/src/routers/behaviour.ts` — implements `behaviour.log` and
  `behaviour.listForStudent` for full-admin and Supervisor roles, with RLS
  transactions for BehaviourEntry reads/writes.
- `apps/api/src/__tests__/behaviour.router.test.ts` — covers RBAC,
  encrypted notes, fixed demerits, linked ledger rows, Sensitive read blocking,
  and audit rows.
- `docs/phase-2-build-plan.md` — marks PR-2.1 merged and PR-2.2 in progress.

Verification:

- `pnpm --filter @oasis/api test` → pass.
- `pnpm lint` → pass.
- `pnpm typecheck` → pass.
- `pnpm test` → pass.
- `pnpm db:integration` → pass after rerunning outside the sandbox because
  `tsx` IPC was blocked inside the sandbox.
- `pnpm api:smoke-context-rls` → pass after rerunning outside the sandbox
  because `tsx` IPC was blocked inside the sandbox.
- `graphify update .` → pass.

### 2026-04-29 admin sidebar logo polish — `feat/admin-sidebar-logo-contrast`

**PR scope:** Improve the Head admin sidebar logo treatment only.

Changed scope:

- `apps/web/src/app/(admin)/admin/layout.tsx` — wraps the desktop sidebar logo
  in a dedicated frame and delegates route-aware navigation to a client
  component.
- `apps/web/src/components/admin/admin-nav.tsx` — restores active-route state for
  desktop and mobile admin navigation using `usePathname`.
- `apps/web/src/app/(admin)/admin/admin.css` — adds a light, bordered logo
  backing so the crest stands out against the navy sidebar, and styles the
  active nav item.

Verification:

- `pnpm --filter @oasis/web build` → pass.
- `pnpm --filter @oasis/web typecheck` → pass after the build regenerated
  `.next/types`.
- Local browser verified the authenticated admin page at
  `http://localhost:3003/admin`.
- Local browser verified the active sidebar highlight at
  `http://localhost:3003/admin/students`.

### PR-1.1 merged — `feature/phase-1-pr1.1-env-key-encryption`

**Decision change:** AWS KMS replaced with an env-managed master key
(see ADR-0006 / ADR-0005 superseded). Cost reason: the centre is small
(~30 students) and free-tier hosting rules out KMS at this stage. The
envelope-encryption strategy is identical — per-record AES-256-GCM DEKs,
wire format `v1:<keyVersion>:<wrappedDek>:<wrapIv>:<wrapTag>:<iv>:<tag>:<ct>`,
blind-index peppers in env — only the wrapping mechanism changes.

Changed files:

- `packages/db/src/encryption.ts` — env-key provider, versioned format, no AWS SDK
- `packages/db/src/__tests__/encryption.test.ts` — 13 tests (round-trip, tamper,
  nullable, key rotation, malformed wire)
- `docs/adr/0006-pii-envelope-encryption-env-key.md` — new ADR
- `docs/adr/0005-pii-envelope-encryption-kms.md` — marked Superseded
- `.env.example` — `OASIS_MASTER_KEY`, `OASIS_MASTER_KEY_VERSION`, `OASIS_BIDX_PEPPER`

### PR-1.2 merged — `feature/phase-1-pr1.2-db-integration`

**PR scope:** Supabase/Postgres migration foundation, RLS apply script, CI
database integration job, and runbook instructions.

Merged scope:

- `packages/db/prisma/migrations/20260425000000_init/migration.sql` — initial
  Prisma migration generated from the Phase 0 schema so `migrate deploy`
  has a real schema to apply in CI/Supabase.
- `packages/db/scripts/apply-rls.ts` — executes `prisma/rls.sql` after
  migrations.
- `packages/db/scripts/smoke-rls.ts` — seeds a minimal Head/student/behaviour
  fixture and proves Head can read Sensitive behaviour while Supervisor cannot.
- `packages/db/prisma/rls.sql` — made idempotent with `DROP POLICY IF EXISTS`
  and added `FORCE ROW LEVEL SECURITY` for the behaviour table.
- `packages/db/package.json`, root `package.json` — wired `db:migrate`,
  `migrate:dev`, `rls:apply`, and `db:integration`.
- `.github/workflows/ci.yml` — added a dedicated Postgres-backed
  `db-integration` job.
- `apps/web/src/lib/supabase.ts` — browser-safe Supabase client using
  `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- `docs/runbook.md` — updated Supabase setup, migration/RLS procedure, and
  env-managed key operational notes.

**Verification completed before merge:**

- `pnpm --filter @oasis/db lint` → pass.
- `pnpm --filter @oasis/db typecheck` → pass.
- `pnpm --filter @oasis/db test` → pass (13/13 encryption tests).
- 2026-04-26 CI follow-up: `apply-rls.ts` now ignores SQL line/block comments
  before splitting statements, fixing the `syntax error at or near
"documented"` failure caused by a semicolon inside the `rls.sql` header
  comment. Added `apply-rls.test.ts` coverage for comment semicolons and quoted
  semicolons.
- 2026-04-26 CI follow-up: removed hardcoded CI encryption fixture env values
  from `.github/workflows/ci.yml` after GitGuardian flagged the base64 test key.
  Current migration and RLS smoke jobs do not need encryption env vars.
- 2026-04-26 CI follow-up: `smoke-rls.ts` now prepares and queries through a
  non-owner `oasis_app` runtime role, so the RLS smoke cannot pass or fail via
  Postgres superuser/table-owner bypass.
- 2026-04-26 web build fix: `apps/web/next.config.mjs` now aliases `.js`
  imports to TypeScript source extensions while transpiling workspace packages.
  This lets Next build `@oasis/api` source files that intentionally use
  NodeNext-style `.js` import specifiers.
- `pnpm lint` → pass.
- `pnpm typecheck` → pass.
- `pnpm test` → pass.
- `pnpm --filter @oasis/web build` → pass after `pnpm db:generate`.
- GitHub CI completed the Postgres-backed migration and RLS integration path
  after the follow-up fixes above.

### PR-1.3 merged — `feat/phase-1-pr1.3-clerk-auth`

**PR scope:** Clerk provider/middleware wiring, Clerk webhook → encrypted local
User sync, 2FA scaffold, and auth route shells.

Merged scope:

- `apps/api/src/routers/clerkWebhook.ts` — verifies Clerk webhook requests with
  `@clerk/backend/webhooks`, maps `user.created` / `user.updated` payloads,
  encrypts full name/email/phone via `@oasis/db`, computes `emailBidx`, upserts
  active users with default `Parent` role, and deactivates users on `user.deleted`.
- `apps/api/src/__tests__/clerkWebhook.test.ts` — covers real signed webhook
  verification, invalid-signature rejection, encrypted PII/default-role upsert,
  deleted-user deactivation, and payload mapping.
- `apps/web/src/app/api/clerk/webhook/route.ts` — exposes the webhook handler as
  a Next route.
- `apps/web/src/middleware.ts` — adds Clerk middleware for protected route groups.
- `apps/web/src/app/layout.tsx` — wraps the web app in ClerkProvider when
  `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` is available; CI/no-secret builds render
  safely without Clerk.
- `apps/web/src/app/(auth)/...` — adds sign-in, sign-up, and 2FA setup shells.
- `apps/mobile/app/_layout.tsx` — wraps Expo in ClerkProvider using the Clerk
  Expo SecureStore token cache.
- `packages/domain/src/rbac.ts` — adds `SessionUser.requires2fa`, currently
  always false until Phase 5 enforcement.
- `.env.example` — documents Clerk web/mobile publishable keys, secret key,
  and `CLERK_WEBHOOK_SIGNING_SECRET`.

**Verification on branch:**

- `pnpm lint` → pass.
- `pnpm typecheck` → pass.
- `pnpm test` → pass.
- `pnpm --filter @oasis/web build` → pass without Clerk secrets.
- User confirmed the merged changes completed with no errors.

### PR-1.4 merged — `feat/phase-1-pr1.4-trpc-context-rls` → [PR #10](https://github.com/jntagengwa/oasis-portal/pull/10)

**PR scope:** Clerk-backed tRPC request context, RLS session variables, and
audit-log middleware. Sprint 1 is now complete.

Changed files:

- `apps/api/src/context.ts` — `createContext` verifies Clerk session → loads
  `User` by `clerkId` → hydrates `SessionUser`; exposes `withRls()` which
  opens a `$transaction` and sets `app.user_id` / `app.user_role` /
  `app.full_admin` via `set_config` so every query in the request fires RLS.
  Core extracted as `applyRlsTx` (exported for integration smokes).
- `apps/api/src/trpc.ts` — adds `authedProcedure`, `fullAdminProcedure`,
  `roleProcedure(...roles)`, `auditedProcedure`. RBAC guards delegate to
  `requireFullAdmin` / `requireRole` from `@oasis/domain`. `auditedProcedure`
  writes `Update` on successful mutations, `PermissionDenied` on
  `AccessDeniedError`, rethrows as FORBIDDEN.
- `apps/api/src/routers/health.ts` — `health.me` smoke endpoint.
- `apps/web/src/app/api/trpc/[trpc]/route.ts` — calls `auth()` from
  `@clerk/nextjs/server`; anonymous fallback when Clerk secrets are absent.
- `apps/api/scripts/smoke-context-rls.ts` — Postgres integration smoke proving
  Head=2 / Supervisor=1 / anonymous=0 `BehaviourEntry` rows; wired to
  `db-integration` CI job.
- `packages/db/src/index.ts` — re-exports `Prisma` namespace.
- `apps/api/src/index.ts` — re-exports procedures + `RlsTx`.
- `apps/api/src/__tests__/trpc.middleware.test.ts` — 7 unit tests.

**Verification completed before merge:**

- `pnpm lint` → pass.
- `pnpm typecheck` → pass.
- `pnpm test` → pass (15/15: 7 new middleware + 8 webhook).
- `pnpm --filter @oasis/web build` → pass without Clerk secrets.
- CI `db-integration` job: RLS smoke + context RLS smoke both green.

### PR-1.5 complete — `feat(domain): user invite + guardian linking`

**PR scope:** Head-admin user invitations through Clerk plus idempotent
guardian/student linking.

Changed scope:

- `packages/domain/src/users.ts` — invite and guardian-link zod schemas, role/tag
  whitelists, and Clerk invite metadata parsing.
- `apps/api/src/lib/clerk.ts` — injectable Clerk invitation client.
- `apps/api/src/routers/admin.ts` — `admin.inviteUser` and `admin.linkGuardian`
  with full-admin RBAC and entity-specific audit rows.
- `apps/api/src/routers/clerkWebhook.ts` — first sync reads role/tags from Clerk
  `public_metadata`; later syncs update PII only.
- Tests cover invite validation, Clerk parameters, audit logging, idempotent
  guardian linking, role validation, and webhook metadata fallback.

### PR-1.6 complete — `feat(domain): student CRUD + subject assignment`

**PR scope:** Backend-only student CRUD, encrypted student PII, subject assignment,
PACE-number update, RBAC, and audit rows.

Changed scope:

- `apps/api/src/routers/student.ts` — implements `student.create`,
  `student.update`, `student.list`, `student.byId`, `student.assignSubject`, and
  `student.setCurrentPace`.
- Full-admin roles can mutate students and assignments. Supervisors can list and
  read students by id but cannot write.
- Student PII (`fullName`, `dob`, optional `address`) is encrypted on write using
  `ctx.db.$enc`; `nameBidx` is computed for exact normalised search.
- Reads decrypt only after RBAC passes and write one `DecryptPii` audit row per
  request for `student.list` / `student.byId`.
- Subject assignment validates student + active subject, defaults current PACE to
  `1001`, handles duplicate assignment idempotently, and audits only real writes.
- `apps/api/src/__tests__/student.router.test.ts` — 4 focused tests covering
  encrypted create/list round trip, Supervisor read/write permissions, assignment
  idempotency, and missing/inactive error cases.

### PR-1.7 merged — `feat(web): Head admin screens`

**PR scope:** Head-admin web onboarding screens, minimal read APIs required by
those screens, and subtle professional Framer Motion animation.

Changed scope:

- `apps/api/src/routers/admin.ts` — adds full-admin-only `listActiveSubjects`
  and `searchParents` read procedures. Parent lookup decrypts parent display PII
  and writes one `DecryptPii` audit row per lookup request.
- `apps/web/src/app/(admin)/admin/...` — adds the Head admin shell, student list,
  student create form, student edit/detail view, subject assignment, guardian
  linking, and staff/parent invite form.
- `apps/web/src/components/...` — adds tRPC provider, full-admin server guard,
  restrained motion primitives, and small shadcn-style form/button primitives.
- `apps/web/playwright.config.ts` and `apps/web/tests/e2e/...` — add opt-in
  Playwright coverage for Head onboarding. The test skips unless
  `E2E_HEAD_EMAIL` and `E2E_HEAD_PASSWORD` are provided.
- Dependencies added to `@oasis/web`: `framer-motion`, `react-hook-form`,
  `@hookform/resolvers`, `clsx`, `class-variance-authority`, `lucide-react`,
  and `@playwright/test`.

Verification completed locally:

- `pnpm lint` → pass.
- `pnpm typecheck` → pass.
- `pnpm test` → pass.
- `pnpm --filter @oasis/web build` → pass.
- `env E2E_BASE_URL=http://127.0.0.1:3000 pnpm --filter @oasis/web test:e2e`
  → pass with 1 skipped test because Clerk E2E credentials are not set.
- `graphify update .` → graph refreshed after code changes.

### PR-1.7.5 merged — `feat(web): align Head admin screens with design handoff` → PR #16

**PR scope:** Convert the screens created in PR-1.7 to the visual system in
`design/Oasis Learning Center-handoff.zip`, while preserving the live tRPC
forms and Phase 1 onboarding workflows.

Merged branch: `feat/phase-1-pr1.7.5-design-conversion`

Changed scope so far:

- `apps/web/src/app/(admin)/admin/layout.tsx` — replaces the interim topbar
  with the design handoff's navy staff-portal sidebar, logo treatment, mobile
  header, and bottom navigation.
- `apps/web/src/app/(admin)/admin/admin.css` — maps the handoff palette,
  cards, stat panels, badges, inputs, table styling, buttons, responsive
  layout, and mobile chrome into production CSS.
- `apps/web/src/app/(admin)/admin/page.tsx` — adds a design-aligned dashboard
  landing page for the admin shell instead of redirecting directly to students.
- `apps/web/src/app/(admin)/admin/students/...` and
  `apps/web/src/app/(admin)/admin/staff/...` — updates page headers, student
  rows, status badges, profile header, and active toggle to match the handoff.
- `apps/web/public/oasis-logo.svg` — serves the Oasis logo used by the design
  handoff.
- Follow-up fix: `packages/db/scripts/smoke-rls.ts` and
  `apps/api/scripts/smoke-context-rls.ts` now write real encrypted fixture PII
  instead of `enc:*` placeholders. A local malformed `ci-student` smoke row was
  repaired in place after it caused `student.list` to return `Malformed ciphertext`.
- CI fix: both smoke scripts generate process-local test encryption env values
  when `OASIS_MASTER_KEY` / `OASIS_BIDX_PEPPER` are absent, avoiding hardcoded
  fixture secrets in GitHub Actions while keeping production encryption strict.

### Local Docker DB implemented — `chore(dev): local Postgres bootstrap`

**Purpose:** Make local testing realistic before production deployment by
running Postgres in Docker with separate owner/runtime roles.

Changed scope:

- `compose.yaml` — starts `postgres:16-alpine` on `localhost:5432` with the
  `oasis_dev` database.
- `docker/postgres/init/001-runtime-role.sql` — creates local `oasis_app`
  runtime role for app connections.
- Root package scripts — add `db:dev:up`, `db:dev:down`, `db:dev:logs`,
  `db:dev:reset`, `db:dev:setup`, and env-loaded DB commands.
- `scripts/with-env.mjs` — dependency-free loader for repo-root `.env.local`
  before DB scripts run.
- `packages/db/scripts/bootstrap-head.ts` — promotes a Clerk-synced local user
  to `Head` by email after the webhook creates the DB row.
- DB setup scripts now use `DIRECT_URL` for owner-level migration/RLS setup and
  `DATABASE_URL` for runtime-role verification.

Verification completed locally:

- `docker compose config` → pass.
- `pnpm db:dev:setup` → pass; migrations, RLS, and six ACE subjects applied.
- `pnpm db:integration` → pass against Docker; Head sees Sensitive behaviour,
  Supervisor sees General only.
- `pnpm --filter @oasis/db typecheck` → pass.
- `pnpm --filter @oasis/db test` → pass.

### PR-1.8 merged — `feat(audit): audit-log viewer + Phase 1 verification suite` → PR #17

**PR scope:** Full-admin audit log read API and `/admin/audit` viewer, removal
of plaintext PII from invitation audit metadata, `pnpm verify:encryption` using
`pg_dump --data-only`, and a CI encryption verification job.

Merged branch: `feat/phase-1-pr1.8-audit-verification`

Changed scope:

- `apps/api/src/routers/audit.ts` — added full-admin-only `audit.list` with
  cursor pagination and filters for action, entity, actor, and date range.
- `apps/web/src/app/(admin)/admin/audit/...` — added the filterable audit log
  viewer at `/admin/audit`.
- `apps/api/src/routers/admin.ts` — removed plaintext invitation email from
  invitation audit metadata.
- `packages/db/scripts/verify-encryption.ts` and
  `packages/db/src/__tests__/verify-encryption.test.ts` — added dump-scanning
  encryption verification and fixture-detection tests.
- `.github/workflows/ci.yml` — added `encryption-verification` after the DB/RLS
  smoke job.

Verification completed locally:

- `pnpm lint` → pass.
- `pnpm typecheck` → pass.
- `pnpm test` → pass.
- `pnpm --filter @oasis/web build` → pass.
- `pnpm db:integration` → pass.
- `pnpm api:smoke-context-rls` → pass.
- `pnpm verify:encryption` → pass.

The credentialed Playwright onboarding flow exists in
`apps/web/tests/e2e/head-admin-onboarding.spec.ts`, but remains opt-in unless
`E2E_HEAD_EMAIL` and `E2E_HEAD_PASSWORD` are configured.

### PR-1.9 merged — `docs: close Phase 1 and prepare Phase 2 kickoff`

**PR scope:** Documentation-only closeout for Phase 1 readiness.

Changed scope:

- `docs/phase-1-build-plan.md` — mark Phase 1 complete, record PR-1.8 as merged,
  add PR-1.9, and document the Phase 2 gate decision.
- `PROJECT_Oasis_Context.md` — update current status, verification, next steps,
  and Phase 2 confirmations.

Merged via PR #18 on 2026-04-28. Follow-up PR-2.0 creates the Phase 2 daily
workflow tracking plan and marks Phase 2 as current in the master plan.

### Sprint 2 (week 3) — Head admin surface

PRs 1.5–1.8 are complete: user invite + guardian linking, student CRUD, Head
admin web screens, audit log viewer, and encryption-proof script.

**What exists (from Phase 0):**

- **Monorepo:** Turborepo + pnpm workspaces. Root `package.json`,
  `turbo.json`, `pnpm-workspace.yaml`, strict `tsconfig.base.json`.
- **packages/config:** shared ESLint + TS presets (strictTypeChecked,
  `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`).
- **packages/db:** Prisma schema v1 covering Users, Students, Parents,
  Attendance, BehaviourEntry, MeritLedgerEntry, InvestmentHolding/Txn,
  ShopItem/Purchase, Club/Signup, Notice, MessageThread/Message,
  TermReport, AuditLog. PII columns suffixed `Enc` with sibling
  `*_bidx` for blind-index equality lookups. Envelope encryption helper
  (`src/encryption.ts`, AES-256-GCM, per-record KMS-wrapped DEKs) and
  Postgres RLS policies (`prisma/rls.sql`) in place.
- **packages/domain:** all pure business logic with 80 passing Vitest
  tests — RBAC (8 roles, 3 permission tags, full-admin parity for
  Head/Principal/Pastor/HeadOfDiscipline), double-entry merit ledger
  (demerit = −5, zero-sum `correlationId`), weekly tithe
  (10/15/20% of gross, floor maths, Monday-start UTC), investment sim
  (GBM with regime switches, 10% drift / 15% vol, seeded Mulberry32,
  5% withdrawal fee), shop (VAT-inclusive pricing, shopkeeper /
  shopadmin tag enforcement, atomic debit+decrement), leaderboards
  (TopTithers default; HighestDemerits gated to leaderboard-admin),
  clubs, report compilation.
- **packages/ui:** stub workspace (components land in Phase 2).
- **apps/api:** tRPC v11 + superjson. 14 routers skeletoned with zod
  inputs; every procedure returns `notImplemented('<name>')`.
  `AppRouter` type is frozen and exported so clients can be typed today.
- **apps/web:** Next.js 15 App Router scaffold, tRPC client created,
  `/api/trpc/[trpc]` fetch-adapter route handler in place, placeholder
  landing page.
- **apps/mobile:** Expo SDK 52 + expo-router scaffold, tRPC client
  created, metro config for pnpm workspace resolution, placeholder
  landing screen.
- **docs/adr/0001–0005:** monorepo, Clerk+2FA, RBAC+RLS two-wall,
  double-entry ledger, KMS envelope encryption. Each ADR cites context,
  decision, consequences, reversibility.
- **docs/runbook.md:** environments, local dev, deploy, incident
  playbooks (KMS outage, PII leak, ledger imbalance, investment-sim
  drift, Clerk outage), backups, on-call checklist.
- **.github/workflows/ci.yml:** pnpm + Postgres service; runs lint,
  typecheck, test across the monorepo.

**Verification today:**

- `pnpm --filter @oasis/domain test` → 80/80 pass.
- `pnpm --filter @oasis/domain typecheck` → clean.
- `pnpm --filter @oasis/db typecheck` → clean (after `db generate`).
- `pnpm --filter @oasis/api typecheck` → clean.
- Web/mobile typecheck requires `pnpm install` to pull Next/Expo deps.
- 2026-04-23 CI fix: regenerated `pnpm-lock.yaml` after web/mobile
  workspace manifests were added without matching lockfile importers.
  `CI=true pnpm install --frozen-lockfile` now completes locally.
- 2026-04-23 CI lint fix: added root ESLint flat-config bridge, made
  shared config ESM-explicit, added direct flat-config dependencies, and
  cleaned strict lint findings. `pnpm lint` now passes locally.
- 2026-04-23 CI typecheck fix: added `@types/node` to the mobile
  workspace and made web/mobile tRPC clients explicitly typed so
  TypeScript does not infer non-portable pnpm store paths. `pnpm
typecheck` now passes locally.
- 2026-04-23 CI test fix: API and DB Phase 0 packages now run Vitest
  with `--passWithNoTests`; domain remains the real unit-test gate with
  80 passing tests. `pnpm test` now passes locally.
- 2026-04-23 operating-system update: `AGENTS.md` now includes PR scope
  checkpoints so each branch maps to one focused pull request. Mixed
  work, such as login plus clubs, must be split before PR creation.
- 2026-04-28 Phase 1 closeout verification: `pnpm lint`, `pnpm typecheck`,
  `pnpm test`, `pnpm --filter @oasis/web build`, `pnpm db:integration`,
  `pnpm api:smoke-context-rls`, and `pnpm verify:encryption` pass locally.

## Design decisions made (see ADRs for full rationale)

1. **Turborepo + pnpm workspaces** — type-sharing via `workspace:*`; no
   codegen for tRPC.
2. **Clerk for auth + 2FA** — EU residency tier; 2FA required for every
   user. `User.clerkUserId` is the foreign key; PII stays in our DB
   encrypted, not in Clerk.
3. **Two-wall sensitive visibility** — RBAC guards in
   `packages/domain/src/rbac.ts` _and_ Postgres RLS policies on
   `BehaviourEntry` (and later Report/Message). Forgetting the RBAC
   call is a defensive fail — RLS still denies.
4. **Double-entry append-only merit ledger** — every op emits rows that
   sum to zero per `correlationId`. Balances derived. Refunds = new
   rows, never edits.
5. **Per-record envelope encryption with env master key** (ADR-0006,
   supersedes ADR-0005) — PII stored as
   `v1:<keyVersion>:<wrappedDek>:<wrapIv>:<wrapTag>:<iv>:<tag>:<ct>` base64.
   Per-record DEKs wrapped with `OASIS_MASTER_KEY` (AES-256-GCM, versioned
   for rotation). Sibling `*_bidx` columns (HMAC-SHA256 with
   `OASIS_BIDX_PEPPER`) support equality search without decryption.
   AWS KMS deferred until the centre outgrows free-tier limits.
6. **Deterministic investment sim** — Mulberry32 PRNG + FNV-1a seed
   hashing; seed persisted per student on first buy; GBM with regime
   switches so students occasionally lose money.

## Blockers / escalations

No product blockers currently. Phase 1 is code-complete and merged through PR-1.9.

**Items to confirm with the centre before Phase 2:**

- Exact list of initial permission-tag assignments (who is shopkeeper,
  shopadmin, leaderboard-admin).
- Tithe default (currently 10% with 15/20 as options — confirm).
- Shop VAT rate default (currently configurable per item).
- Whether parents can view non-sensitive behaviour entries for their
  own child (currently yes in RBAC).

## Next steps — Phase 2 daily workflow

1. Build PR-2.5 subject management and PACE write rules API, including migration and tests.
2. PR-2.6 PACE read model (`pace.forStudent`) follows immediately after PR-2.5 merges.
3. Carry forward credentialed Supabase-preview Playwright onboarding as a
   verification task, not a Phase 2 blocker.

## Who's working on it

Technical Agent (Codex). No Strategic Agent work needed until we hit
shop pricing policy and tithe/investment comms copy in Phase 2.
