# PROJECT: Oasis Learning Centre Portal — Context

**Last updated:** 2026-06-16
**Agent:** Technical Agent (Codex)
**Phase:** Messaging contact-list layout.

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

## Current status - Phase 4 complete

Repository head: `main` fast-forwarded to `b9c3f44` before starting the current
observability branch.

Phase 6 now owns the production mobile build plan. The mobile app currently has
Expo, Clerk, Expo Router, typed tRPC wiring, and smoke screens under
`apps/mobile/src/components/smoke`; production mobile routes, reusable native
primitives, role journeys, mobile e2e, and EAS internal builds are planned as
small PRs in `docs/phase-6-mobile-production-build-plan.md`.

## Current session - 2026-06-16 messaging contact-list layout

Working branch: `feat/message-platform-conversations`.

**PR scope:** Replace the separate new-message composer with a contact list
that opens existing or empty conversations, keeping all message composition in
the right-hand chat panel.

Completed:

- Removed the full-width `New Message` form from the web message centre.
- Split the message UI into focused contact-list, conversation-panel, display
  helper, and type modules under `apps/web/src/components/messages`.
- Added contact rows for available recipients without history; selecting one
  calls `message.openConversation`, refreshes conversations, updates the URL,
  and opens the chat panel.
- Kept Staffroom first for staff-facing message centres and preserved existing
  conversation rows with unread counts.
- Updated the message layout CSS so the contact list and chat history scroll
  internally within a bounded two-column surface, with stacked bounded panels
  on smaller screens.
- Added API regression coverage for opening and reusing an empty direct
  conversation before the first message is sent.

Verification:

- `pnpm --filter @oasis/api test -- message.router.test.ts` - pass; Vitest ran
  all API tests because of repository argument handling: 39 files / 827 tests.
- `pnpm --filter @oasis/web typecheck` - pass.
- `pnpm --filter @oasis/web lint` - pass.
- `pnpm --filter @oasis/web build` - pass.
- `graphify update .` - pass.

Notes:

- No public API, database schema, migration, permission, navigation, or product
  module ownership changes were required.
- The API suite still emits existing PDF `standardFontDataUrl` warnings in
  unrelated invoice/incident tests. The web build still emits existing Prisma
  config and Next ESLint-plugin warnings, but the commands pass.

## Current session - 2026-06-07 Twelve Data merit valuation

Working branch: `feat/convert-twelve-data-values-to-merits`.

**PR scope:** Convert cached Twelve Data market values into backend-owned merit
valuation responses for PR-8.4 without changing provider snapshot storage,
ledger accounting, buy/sell flows, or student investment UI.

Completed:

- Fast-forwarded local `main` to GitHub `main` at `53a63d3` before branching.
- Added central domain helpers for `1 merit = GBP 10`, deterministic
  six-decimal GBP-to-merit conversion, market snapshot valuation fields, and
  holding value valuation from units and GBP prices.
- Kept persisted `MarketDataSnapshot` source/GBP fields unchanged for audit and
  replay.
- Mapped cached market-data API responses to merit-denominated `priceMerits`,
  `previousCloseMerits`, and `dailyMovementMerits` fields so clients do not
  receive raw provider price fields from `investment.marketData`.
- Exported the public market-data valuation DTO type from the API package.
- Added regression coverage for conversion rounding, non-GBP-after-GBP
  valuation, zero-unit holdings, cached API responses, and stale cache results.

Verification:

- `pnpm --filter @oasis/domain test`
- `pnpm --filter @oasis/api test`
- `pnpm --filter @oasis/domain typecheck`
- `pnpm --filter @oasis/api typecheck`
- `pnpm --filter @oasis/domain lint`
- `pnpm --filter @oasis/api lint`
- `pnpm exec prettier --check` on changed TypeScript files.
- `graphify update .`

Notes:

- No Prisma schema, RLS, migration, cron, provider HTTP, ledger, buy/sell
  accounting, or UI file was changed.
- The API tests still emit existing PDF `standardFontDataUrl` warnings in
  unrelated invoice/incident tests, but the suites pass.

## Current session - 2026-06-06 Twelve Data server-side quote refresh

Working branch: `feat/twelve-data-server-quotes`.

**PR scope:** Fetch Twelve Data quotes only from the server, persist quote
snapshots before student reads, expose cached market data through the investment
router, and add a cron refresh path without changing ledger accounting or the
student investment UI.

Completed:

- Fast-forwarded local `main` to GitHub `main` before branching.
- Added a server-side Twelve Data refresh service with London-session checks,
  persisted daily/minute quota guards, timeout/retry handling, raw payload
  hashing, provider credit metadata capture, oldest-due cohort selection, and
  stale-cache fallback.
- Added internal GBP conversion support for non-GBP quotes and fixed `GBp`/`GBX`
  pence conversion to GBP values.
- Extended investment market-data storage with typed snapshot counting for quota
  checks.
- Added `investment.marketData` cached reads and full-admin-only
  `investment.refreshMarketData`.
- Added `/api/cron/investment-market-refresh` behind `CRON_SECRET`.
- Regenerated graphify output and the component relationship map.

Verification:

- `pnpm --filter @oasis/domain exec vitest run src/__tests__/investmentMarketData.test.ts`
- `pnpm --filter @oasis/api exec vitest run src/__tests__/investment-market-data-storage.test.ts src/__tests__/twelve-data-refresh.test.ts src/__tests__/investment.router.test.ts`
- `pnpm --filter @oasis/domain typecheck`
- `pnpm --filter @oasis/api typecheck`
- `pnpm --filter @oasis/web typecheck`
- `pnpm --filter @oasis/db typecheck`
- `pnpm --filter @oasis/domain lint`
- `pnpm --filter @oasis/api lint`
- `pnpm --filter @oasis/web lint`
- `pnpm --filter @oasis/db lint`
- `pnpm exec prettier --check` on changed TypeScript files.
- `git diff --check`
- `pnpm db:generate`
- `pnpm --filter @oasis/web build`
- `graphify update .`
- `pnpm docs:component-map`

Notes:

- Student-facing reads use cached DB snapshots only and do not invoke provider
  HTTP calls.
- More than 8 enabled instruments are handled as quota-safe cohorts rather than
  one full-list request, matching the PR-8.2 note that current seeds exceed the
  original 8-instrument planning cap.
- No Prisma schema, RLS, merit ledger, buy/sell accounting, or investment UI
  files were changed.

## Current session - 2026-06-06 Investment market snapshots

Working branch: `feat/investment-market-snapshots`.

**PR scope:** Add database-backed curated instruments and provider market-data
snapshot storage for Phase 8 without live provider calls, student UI changes,
cron wiring, new tRPC endpoints, or ledger changes.

Completed:

- Added `InvestmentInstrument` and `MarketDataSnapshot` Prisma models.
- Added migrations that seed 8 US Basic-compatible educational instruments:
  `VOO`, `VT`, `BND`, `GLD`, `AAPL`, `MSFT`, `NVDA`, and `DIS`, plus requested
  LSE-listed ETFs `VUSA`, `CSP1`, `EQQQ`, `JEPQ`, and `JEPI`.
- Added indexed snapshot storage for provider timestamp, server fetch timestamp,
  source price, GBP conversion rate, GBP price, previous close, day change, raw
  payload hash, and provider credit metadata.
- Added a focused server-side market-data storage service for enabled instrument
  reads, latest snapshot reads, and normalized quote snapshot persistence.
- Updated the Phase 8 plan to record the US seed decision and defer London-first
  instruments until coverage/licensing is confirmed, then added the requested
  LSE-listed ETF follow-up after checking Twelve Data market pages.
- Added the market-data service and migration directory to the finance module
  ownership map source.

Verification:

- Baseline: `pnpm --filter @oasis/domain test -- investmentMarketData.test.ts`
- Baseline: `pnpm --filter @oasis/api exec vitest run src/__tests__/twelve-data-config.test.ts`
- TDD red check: missing market-data storage service.
- `pnpm --filter @oasis/api test -- investment-market-data-storage.test.ts`

Notes:

- No `InvestmentAccount`, `InvestmentNav`, `InvestmentTransaction`, merit ledger,
  router, cron, live HTTP adapter, or UI file was changed.
- More than 8 enabled instruments are allowed. PR-8.3 should refresh them in
  cohorts of 8 to respect the Twelve Data free-tier per-minute credit cap.
- RLS was not added because the new instrument and snapshot data is global
  provider reference/cache data, not tenant-, user-, or student-scoped data.
- The isolated worktree did not include `graphify-out/graph.json`; the required
  PR-start graphify query was run from the main checkout's current graph before
  editing in this worktree.

## Current session - 2026-06-06 Twelve Data provider contracts

Working branch: `feat/twelve-data-provider-contracts`.

**PR scope:** Add typed, fixture-backed Twelve Data market-data provider
contracts for Phase 8 without live provider calls, schema changes, cron wiring,
or student UI changes.

Completed:

- Added pure domain DTOs and normalizers for Twelve Data quote, history, and
  stock/ETF profile payloads.
- Added typed normalisation errors for invalid provider responses, missing
  prices, missing timestamps, missing currencies, missing GBP conversion rates,
  unsupported instruments, provider errors, rate limits, and stale quotes.
- Added server-only Twelve Data config parsing for `TWELVE_DATA_API_KEY` and
  optional `TWELVE_DATA_BASE_URL`.
- Added `.env.example` placeholders without committing secrets.
- Added the new investment market-data helper to the finance module ownership
  map and regenerated `docs/architecture/component-relationships.md`.

Verification:

- Baseline: `pnpm --filter @oasis/domain test -- investmentSim.test.ts investmentTransactions.test.ts`
- TDD red checks for missing provider/config modules.
- `pnpm --filter @oasis/domain test -- investmentMarketData.test.ts`
- `pnpm --filter @oasis/api exec vitest run src/__tests__/twelve-data-config.test.ts`

Notes:

- No Prisma schema, RLS, migration, cron route, live HTTP adapter, or UI file was
  changed in this PR.
- Provider facts were rechecked on 2026-06-06 before implementation. Symbol
  coverage and licensing for the final curated list still need confirmation when
  Phase 8 selects production instruments.

## Current session - 2026-06-05 Demerit stage escalation

Working branch: `fix/demerit-stage-escalation`.

**PR scope:** Rework daily demerit stage calculation so selected demerit values
drive stages 1-3, counts above 6 flag Head review, and Heads can manually
escalate a student's daily stage independent of the count.

Completed:

- Changed demerit policy units to use the stored selected demerit value.
- Updated automatic stage thresholds to 1-2 = Stage 1, 3-4 = Stage 2, 5-6 =
  Stage 3, and more than 6 = Head review without automatic Stage 4/5.
- Added daily `DemeritStageOverride` persistence with RLS so manual Head
  escalations do not falsify the actual demerit count.
- Added Head-only `behaviour.escalateDemeritStage` API support.
- Merged manual stages into daily demerit badges and student drill-through
  discipline status.
- Added selected demerit value controls to admin and supervisor behaviour forms,
  including batch entry.
- Updated focused domain and behaviour router regression tests.
- Regenerated the graph and component relationship map.

Verification:

- `pnpm db:generate`
- `pnpm --filter @oasis/domain exec vitest run src/__tests__/demeritPolicy.test.ts`
- `pnpm --filter @oasis/api exec vitest run src/__tests__/behaviour.router.test.ts`
- `pnpm --filter @oasis/domain typecheck`
- `pnpm --filter @oasis/api typecheck`
- `pnpm --filter @oasis/web typecheck`
- `pnpm --filter @oasis/db typecheck`
- `pnpm --filter @oasis/domain lint`
- `pnpm --filter @oasis/api lint`
- `pnpm --filter @oasis/web lint`
- `pnpm --filter @oasis/db lint`
- `pnpm exec prettier --check` on changed TypeScript, TSX, and CSS files.
- `git diff --check`
- `pnpm db:migrate`
- `pnpm with-env pnpm --filter @oasis/db exec prisma migrate status`
- `pnpm --filter @oasis/web build`
- `graphify update .`
- `pnpm docs:component-map`

Notes:

- `pnpm db:migrate` and `prisma migrate status` needed elevated execution for
  Prisma schema-engine access to the configured local `oasis_dev` database.
- Prisma and SQL files were checked through Prisma generation, formatting,
  migration application, RLS application, and migration status rather than
  Prettier, because this repo's Prettier configuration does not infer parsers
  for those file types.

## Current session - 2026-06-05 Twelve Data stock and ETF planning

Working branch: `docs/twelve-data-source-of-truth`.

**PR scope:** Documentation-only Phase 8 planning for Twelve Data as the stock
and ETF market-data source of truth, including London trading-session rules and
free-tier server refresh budgeting.

Completed:

- Added `docs/phase-8-live-investment-data-plan.md`.
- Finalised Twelve Data as the source of truth for stock/ETF prices, quote
  timestamps, day changes, and market-open state.
- Documented that Oasis will not offer FX trading, crypto, commodities, options,
  leveraged products, or brokerage-style trading.
- Added the standard London Stock Exchange open/closed policy:
  `08:00-16:30` Monday to Friday in `Europe/London`, with weekends, exchange
  holidays, and configured half-days treated as closed.
- Calculated the free-tier automated server pull budget from the current Twelve
  Data Basic limit of 8 API credits per minute and 800 API credits per UTC day.
- Recommended a v1 cap of 8 enabled stock/ETF instruments, giving 100 full-list
  refreshes per London trading day at an average 5.1 minute interval.

Verification:

- Manual Markdown review of
  `docs/phase-8-live-investment-data-plan.md`.
- Provider free-tier and London trading-hours facts checked against public
  Twelve Data and London Stock Exchange pages on 2026-06-05.
- `git diff --check`.

Notes:

- No application code, schema, generated graph, route, cron, or UI file was
  changed for this docs-only request.
- Work was implemented in an isolated `/private/tmp/oasis-docs-twelve-data`
  worktree because the main checkout had unrelated dirty student portal work.
- `graphify query` was run from the main checkout before editing. The clean
  worktree did not contain `graphify-out/graph.json`, so the query could not be
  repeated there without introducing generated files into a docs-only branch.

## Current session - 2026-06-05 Attendance reset and special attendance

Working branch: `feat/attendance-register-reset-special`.

**PR scope:** Add selected-date reset controls to attendance registers, add
special attendance registers for field trips, minibus journeys, and The Cedars,
and consolidate admin attendance surfaces into tabs.

Completed:

- Added student, staff, and club attendance reset API mutations with existing
  attendance/club permissions and audit rows.
- Added special attendance session and record models for Field Trip, Minibus
  Inbound, Minibus Outbound, and The Cedars registers.
- Stored minibus destination once per date and journey direction, encrypted at
  the session level.
- Added special attendance read, session-save, mark, and reset procedures using
  the existing daily student roster scope.
- Added reset buttons to student, staff, and club registers.
- Replaced admin attendance subpage navigation with tabs for Student register,
  Staff register, Special attendance, and Attendance center.
- Preserved `/admin/attendance/staff` and `/admin/attendance/center` as
  permission-checked redirects to the matching admin attendance tabs.
- Added special attendance capture to the supervisor attendance view for users
  who can record student attendance.

Verification:

- `pnpm --filter @oasis/api exec vitest run src/__tests__/attendance.router.test.ts src/__tests__/club.router.test.ts`
- `pnpm db:generate`
- `pnpm --filter @oasis/api typecheck`
- `pnpm --filter @oasis/web typecheck`
- `pnpm --filter @oasis/db typecheck`
- `pnpm --filter @oasis/api lint`
- `pnpm --filter @oasis/web lint`
- `pnpm exec prettier --check` on changed TypeScript, TSX, and CSS files.
- `git diff --check`
- `pnpm db:migrate`
- `pnpm with-env pnpm --filter @oasis/db exec prisma migrate status`
- `graphify update .`

Notes:

- Work was implemented in an isolated `/private/tmp/oasis-attendance-register-reset-special`
  worktree because the main checkout had unrelated dirty student portal work.
- `pnpm db:migrate` required sourcing the main checkout's local env and elevated
  execution so Prisma could reach the local `oasis_dev` database at
  `localhost:5432`.

## Current session - 2026-06-04 Linked-child guardian parent access

Working branch: `feat/student-account-provisioning`.

**PR scope note:** This request was implemented on the existing branch at Jean-Fidele's
explicit direction. The code change itself is scoped to parent-portal access for
Guardian-linked adult roles.

Completed:

- Added a shared linked-child guardian RBAC helper for `Parent` plus
  child-registration-capable adult roles.
- Updated parent-facing API gates for reports, merit wallets, shop reservations,
  tithe config, parent-staff messages, parent calendar, and club listings so linked
  supervisors can act only for active children linked through `Guardian`.
- Added parent portal server guards to the shop and incidents pages.
- Updated RLS source and migration policies for parent-facing invoice, permission-slip,
  student settings, and incident parent-copy access to use Guardian-linked adult roles.
- Added regression tests proving linked supervisors pass linked-child paths and unlinked
  supervisors remain denied.

Verification:

- `pnpm --filter @oasis/domain exec vitest run src/__tests__/rbac.test.ts`
- `pnpm --filter @oasis/api exec vitest run src/__tests__/report.router.test.ts src/__tests__/meritLedger.router.test.ts src/__tests__/shop.router.test.ts src/__tests__/tithe.router.test.ts src/__tests__/message.router.test.ts src/__tests__/club.router.test.ts src/__tests__/calendar.router.test.ts`
- `pnpm --filter @oasis/domain typecheck`
- `pnpm --filter @oasis/api typecheck`
- `pnpm --filter @oasis/web typecheck`
- `pnpm --filter @oasis/db typecheck`
- `pnpm --filter @oasis/domain lint`
- `pnpm --filter @oasis/api lint`
- `pnpm --filter @oasis/web lint`
- `pnpm --filter @oasis/db lint`
- `pnpm exec prettier --check` on changed TypeScript/TSX files.
- `git diff --check`
- `pnpm db:migrate`
- `pnpm with-env pnpm --filter @oasis/db exec prisma migrate status`
- `graphify update .`

Notes:

- `pnpm db:migrate` required elevated execution because sandboxed commands could not
  connect to the healthy Docker-mapped local Postgres instance on `localhost:5432`.
- Existing `.codex/tech-debt-review/*` worktree changes were left untouched.

## Current session - 2026-06-04 Student account provisioning

Working branch: `feat/student-account-provisioning`.

**PR scope:** Fix student login provisioning through the parent student settings
workflow without mixing unrelated product changes.

Completed:

- Updated the default Clerk student credential adapter to use the SDK `ClerkClient`
  type instead of a hand-written user API cast.
- Added `skipLegalChecks: true` when creating provisioned no-email Student
  users, so Clerk legal-consent settings do not block parent/admin-created
  student logins.
- Added focused tests for the default Clerk create-user payload and for mapping
  legal-consent provider failures without linking a local user.
- Mapped Clerk-style credential provider `400` errors so username format
  rejections return an actionable login-handle message instead of an opaque bad
  request/internal error.
- Mapped Clerk email-required provider errors to an explicit configuration
  message, since this branch's student login flow intentionally creates no-email
  username/password accounts.
- Added rollback cleanup for failed student login linking: if Clerk creates the
  no-email Student user but the local transaction fails, the router now deletes
  the just-created Clerk account so the username/password are not left orphaned.
- Fixed the Clerk webhook race in `studentSettings.createChildLogin`: when the
  webhook has already inserted the local `User` for the newly created Clerk ID,
  the router now reuses that row instead of failing on the unique `clerkId`
  constraint and deleting the provider account during cleanup.
- Moved the create-login `StudentPortalSettings` audit row into the same local
  transaction so an audit failure cannot report an error after the student has
  already been linked locally.
- Kept the parent create-login form in a pending state until the linked-children
  query refetch confirms the child is `accountLinked`, so the username/password
  controls are only displayed after the created login is confirmed locally.
- Fixed the local link failure shown in dev logs: `StudentPortalSettings` writes
  now run through `ctx.withRls`, so parent create-login and settings upserts set
  the `app.user_id`/`app.user_role` session values required by the forced RLS
  policies before inserting or updating settings rows.
- Kept the existing branch changes that restrict child login handles to 4-64
  alphanumeric characters and map provider duplicate-login, username, and
  password policy failures.

Verification:

- `pnpm --filter @oasis/api exec vitest run src/__tests__/studentSettings.router.test.ts`
- `pnpm --filter @oasis/api typecheck`
- `pnpm --filter @oasis/api lint`
- `pnpm --filter @oasis/web typecheck`
- `pnpm --filter @oasis/web lint`
- `pnpm exec prettier --check apps/api/src/routers/studentSettings.ts apps/api/src/__tests__/studentSettings.router.test.ts apps/web/src/components/parent/parent-student-settings-client.tsx PROJECT_Oasis_Context.md`
- `git diff --check`
- `graphify update .`

Notes:

- `graphify update .` completed, but reported a node-count mismatch before the
  watch rebuild updated `graphify-out` outputs.
- Local untracked environment files contain Clerk-looking secrets. Treat them as
  sensitive and rotate/review them if they were ever committed, shared, or used
  outside this machine.

## Current session - 2026-06-03 Club merits scoping

Working branch: `fix/club-merits-scope`.

**PR scope:** Store club-scoped behaviour entries and use that source boundary
so Clubs Lead merit/demerit summaries only reflect entries logged for the selected
club.

Completed:

- Added nullable `BehaviourEntry.clubId` with a `Club` relation and index for
  club-scoped behaviour reads.
- Persisted `clubId` when club behaviour is logged and filtered
  `recentEntries`, `dailyDemeritStatuses`, and demerit-stage checks by selected
  club when `clubId` is supplied.
- Updated the Clubs Lead portal to query recent entries and daily demerit badges
  with the selected club id.
- Added club-specific merit categories: `Homework` and `General Club Merit`.

Verification:

- `pnpm --filter @oasis/api exec vitest run src/__tests__/behaviour.router.test.ts`
- `pnpm db:generate`
- `set -a; source /Users/JeanFidele/Projects/oasis-portal/.env.local; set +a; pnpm --filter @oasis/db exec prisma validate`
- `pnpm --filter @oasis/api typecheck`
- `pnpm --filter @oasis/web typecheck`
- `pnpm --filter @oasis/api lint`
- `pnpm --filter @oasis/web lint`
- `pnpm --filter @oasis/web build`
- `git diff --check`
- `graphify update .`

Notes:

- `pnpm db:migrate` could not be completed because local Postgres at
  `localhost:5432` was not responding and Docker was unavailable in this
  environment. The migration file was added but still needs applying where the
  configured migration database is reachable.

## Current session - 2026-06-03 Incident draft ownership and review detail

Working branch: `fix/incident-draft-edit-delete`.

**PR scope:** Fix incident draft edit/update/delete ownership, add Head/admin
read-only incident form detail, and expand parent PDF default sections.

Completed:

- Added creator-only draft ownership checks for draft update, submit, and delete
  in the incident API, with audit rows for draft update and delete.
- Replaced draft child, staff, and witness links on update so editing a draft
  preserves the full form state.
- Added a draft delete mutation and wired supervisor UI controls so only the
  report creator sees edit/delete actions for Draft reports.
- Added the Head/admin read-only incident report detail section for the
  supervisor-entered classification, when/where, people, factual account,
  direct disclosure, actions, witnesses, injury/medical fields, and
  reportability checks.
- Expanded parent PDF defaults with parent-safe classification, when/where,
  factual account, and injury/first-aid/medical sections while keeping direct
  disclosure out of the parent PDF by default.
- Tightened incident RLS write policies so draft update/delete writes are scoped
  to the report creator at the database policy layer.

Verification:

- `pnpm --filter @oasis/api test -- incident.router.test.ts`
- `pnpm --filter @oasis/api exec vitest run src/__tests__/incident.router.test.ts`
- `pnpm --filter @oasis/api typecheck`
- `pnpm --filter @oasis/web typecheck`
- `pnpm --filter @oasis/db typecheck`
- `pnpm --filter @oasis/db test`
- `pnpm --filter @oasis/api lint`
- `pnpm --filter @oasis/web lint`
- `pnpm --filter @oasis/db lint`
- `pnpm exec prettier --check` on changed supported TypeScript and CSS files.
- `git diff --check`
- `graphify update .`

Notes:

- `pnpm --filter @oasis/db rls:apply` reached Prisma outside the sandbox but
  could not run because `DATABASE_URL` is not configured in this worktree
  environment.
- `pnpm db:integration` was not run outside the sandbox because the approval
  reviewer blocked it as potentially destructive unless pointed at a confirmed
  disposable database.
- The isolated worktree uses local ignored `node_modules` symlinks to reuse the
  existing install while resolving `@oasis/api` to this branch.

## Current session - 2026-06-03 Portal landing page

Working branch: `feat/portal-landing-page`.

**PR scope:** Recreate the updated public landing-page design from
`design/Oasis Learning Center.zip`, keep authenticated users routed to
`/post-sign-in`, and wire the term at-a-glance section to live calendar and
attendance data.

Completed:

- Added typed Oasis term helpers for Spring, Summer, and Autumn boundary dates.
- Replaced the public `/` route with the recreated landing-page design and kept
  signed-in users redirected to `/post-sign-in`.
- Added a server-side landing data loader for current-term calendar events,
  centre-wide attendance percentage, and last-six-week attendance bars.
- Added a static verse placeholder until a DB-backed verse source is introduced.
- Scoped landing-page CSS through the app layout so portal dashboard styles stay
  isolated.

Verification:

- `pnpm --filter @oasis/domain test`
- `pnpm --filter @oasis/web typecheck`
- `pnpm --filter @oasis/web lint`
- `pnpm --filter @oasis/web build`
- `graphify update .`

Notes:

- Browser verification of `/` was attempted on the local dev server, but dynamic
  app routes such as `/` and `/post-sign-in` timed out in the existing Clerk dev
  runtime while static assets served normally. Production build verification
  passed.
- Existing build warnings remain: Prisma config deprecation/driverAdapters
  warnings and the Next.js ESLint-plugin warning.

## Current session - 2026-06-03 Pastor invoice payment notification

Working branch: `feat/invoice-paid-pastor-email`.

**PR scope:** Notify active Pastor users by email when a parent marks a school
fee invoice as paid, while keeping the invoice in `PaymentPending` until staff
confirmation.

Completed:

- Added a branded invoice payment notification email template and builder.
- Extended the invoice router to accept an injected email client and lazily use
  Resend in production.
- Notifies active `Pastor` users after `invoice.parentMarkPaid` succeeds.
- Kept notification emails minimal: family label, invoice number, and portal
  confirmation link only when `APP_URL` is configured.
- Added sent/failed email audit metadata and operational failure logging without
  writing decrypted family labels, invoice line items, amounts, or PDF contents
  into audit metadata.

Verification:

- `pnpm --filter @oasis/api test -- invoice.router.test.ts email.router.test.ts`
- `pnpm --filter @oasis/api typecheck`
- `pnpm --filter @oasis/api lint`
- `pnpm exec prettier --check apps/api/src/__tests__/email.router.test.ts apps/api/src/__tests__/invoice.router.test.ts apps/api/src/emails/invoice-payment-notification-email.tsx apps/api/src/index.ts apps/api/src/lib/email.ts apps/api/src/routers/invoice.ts`
- `git diff --check`
- `graphify update .`

Notes:

- No database migration is required.
- The isolated implementation worktree required `pnpm install --frozen-lockfile`
  because dependencies were not present in that worktree.

## Current session - 2026-06-03 PACE self-test duplicate guard

Working branch: `fix/pace-self-test-updates`.

**PR scope:** Prevent duplicate PACE Self-Test records for the same
student/subject/PACE number and refresh PACE workflow views after PACE
corrections from child drill-through surfaces.

Completed:

- Added API guards so `pace.record` and `pace.updateRecord` reject duplicate
  Self-Test rows for the same student, subject, and PACE number while still
  allowing multiple PACE Test attempts.
- Changed PACE score creation to default to PACE Test when a Self-Test already
  exists for the current PACE, and disabled duplicate Self-Test saves in the
  score modal.
- Broadened PACE mutation invalidation from PACE workflow, student
  drill-through, and child snapshot surfaces so PACE workflow, roster,
  drill-through, snapshot, centre snapshot, and parent dashboard data refresh
  together.

Verification:

- `pnpm --filter @oasis/api test -- pace.router.test.ts`
- `pnpm --filter @oasis/web typecheck`
- `pnpm lint`
- `pnpm --filter @oasis/web build`
- `git diff --check`
- `graphify update .`

Notes:

- No database unique index was added because production already contains
  duplicate Self-Test rows. Existing duplicates, such as repeated 1041 rows,
  still need a separate cleanup after the correct historical record is
  confirmed.

## Current session - 2026-05-29 Parent tithe wallet

Working branch: `feat/parent-tithe-wallet`.

**PR scope:** Implement parent-side tithe percentage management and automatic
Friday 13:00 Europe/London tithe settlement for the existing merit economy.

Completed:

- Changed tithe weeks from Monday UTC to Friday 13:00 to Friday 13:00 in
  `Europe/London`, with GMT and BST tests.
- Changed `TitheRun.periodStart` and `periodEnd` from date-only fields to full
  timestamps and applied migration `20260529130000_tithe_friday_1pm_periods`.
- Extracted reusable weekly tithe settlement logic for both the existing
  full-admin tRPC mutation and a new protected `/api/cron/tithe-weekly` route.
- Added Vercel cron entries for 12:00 and 13:00 UTC on Fridays; the route runs
  only when local London time is Friday 13:00, covering BST and GMT.
- Added the parent-side 10/15/20 percent selector to the child detail Merits tab
  and kept the parent dashboard wallet card read-only with a manage link.

Verification:

- `pnpm --filter @oasis/domain test -- tithe.test.ts phase4AccountingInvariants.test.ts`
- `pnpm --filter @oasis/api test -- tithe.router.test.ts meritLedger.router.test.ts`
- `pnpm --filter @oasis/domain typecheck`
- `pnpm --filter @oasis/api typecheck`
- `pnpm --filter @oasis/web typecheck`
- `pnpm --filter @oasis/domain lint`
- `pnpm --filter @oasis/api lint`
- `pnpm --filter @oasis/web lint`
- `pnpm db:migrate` against local `oasis_dev`, with RLS reapplied.
- `pnpm --filter @oasis/web build`
- `pnpm exec prettier --check` on changed supported source files.
- `git diff --check`
- `graphify update .`
- `pnpm docs:component-map`

Notes:

- `pnpm db:migrate` failed inside the sandbox with a Prisma schema engine error
  against local Postgres, then passed when rerun outside the sandbox.
- Build still reports the existing Prisma config and Next.js ESLint plugin
  warnings.

## Current session - 2026-05-28 Phase 5 runtime observability

Working branch: `chore/runtime-observability`.

**PR scope:** Implement Phase 5 PR-5.6 runtime observability on top of PR #191.
Update local `main` first, then add Sentry error reporting for the Next.js
web/API runtime, structured operational logs for auth/tRPC/email/audit failure
paths, runbook setup notes, and tracker updates. Do not build GDPR, backup
restore, launch e2e, mobile production observability, UAT, or launch-closeout
work in this branch.

Completed:

- Fast-forwarded local `main` to `origin/main` at PR #191 before creating this
  branch.
- Added the Sentry SDK to `@oasis/web`.
- Added dependency-free operational log helpers with redaction tests.
- Wired Sentry instrumentation for Next.js server, edge, browser, global error,
  request error, and tRPC route-handler failures.
- Replaced API notification failure `console.error` calls with structured
  operational log events for email delivery, recipient resolution, and audit
  write failures.
- Updated `.env.example`, Turborepo env passthrough, the Phase 5 plan, and the
  runbook with Sentry setup and safe smoke guidance.

Verification:

- `pnpm exec prettier --check .env.example PROJECT_Oasis_Context.md apps/api/src/__tests__/admin.router.test.ts apps/api/src/__tests__/observability.test.ts apps/api/src/index.ts apps/api/src/lib/observability.ts apps/api/src/routers/admin.ts apps/api/src/routers/behaviour.ts apps/api/src/routers/club.ts apps/api/src/routers/message.ts apps/api/src/routers/profile.ts apps/api/src/routers/report.ts apps/web/next.config.mjs apps/web/package.json apps/web/src/app/api/auth-context.ts 'apps/web/src/app/api/trpc/[trpc]/route.ts' apps/web/src/app/global-error.tsx apps/web/src/instrumentation-client.ts apps/web/src/instrumentation.ts apps/web/src/sentry-shared.ts apps/web/src/sentry.edge.config.ts apps/web/src/sentry.server.config.ts docs/phase-5-build-plan.md docs/runbook.md turbo.json`
- `pnpm --filter @oasis/api test -- observability.test.ts`
- `pnpm --filter @oasis/api typecheck`
- `pnpm --filter @oasis/web typecheck`
- `pnpm lint`
- `pnpm --filter @oasis/web build`
- `git diff --check`
- Secret/PII log scan against changed runtime files and docs.
- `graphify update .`

Notes:

- Added `@sentry/nextjs` as the justified dependency for the selected Sentry
  implementation.
- Build still reports existing Prisma deprecation/driverAdapters warnings and
  the existing Next.js ESLint plugin warning.

## Current session - 2026-05-27 Phase 5 2FA flag reconciliation

Working branch: `feat/reconcile-portal-2fa-flag`.

**PR scope:** Reapply the existing Phase 5 PR-5.5 Clerk two-factor enforcement
path onto current `origin/main`, keeping enforcement disabled by default behind
`OASIS_ENFORCE_2FA` until Clerk is upgraded. Do not build later Phase 5
observability, GDPR, backup, e2e, mobile, UAT, or launch-closeout work in this
branch.

Completed:

- Reapplied the existing Phase 5 PR-5.5 Clerk two-factor enforcement path onto
  current `origin/main`.
- Kept enforcement disabled by default behind `OASIS_ENFORCE_2FA=false` until
  Clerk is upgraded to Pro.
- Added `OASIS_ENFORCE_2FA=false` to `.env.example` and included the flag in
  Turborepo strict env configuration.
- Updated the Phase 5 plan so PR-5.5 is marked feature-flagged rather than
  purely planned.
- Preserved the newer portal switcher post-sign-in behavior while adding the
  `/2fa` transition route.

Verification:

- `pnpm --filter @oasis/api test -- trpc.middleware.test.ts clerk-auth.test.ts`
- `pnpm --filter @oasis/domain test -- rbac.test.ts`
- `pnpm --filter @oasis/api typecheck`
- `pnpm --filter @oasis/web typecheck`
- `pnpm --filter @oasis/domain typecheck`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm --filter @oasis/web build`
- `git diff --check`
- `graphify update .`

Notes:

- Fetched `origin` during the session and confirmed this branch contains current
  `origin/main`; there were no upstream commits to merge.
- Targeted API and domain Vitest commands still ran full package suites because
  of the repo's package-script argument handling.
- Existing warnings remain: Prisma config deprecation/driverAdapters warnings
  and the Next.js ESLint-plugin warning during web build.

## Current session - 2026-05-27 GitHub Actions Node 24 runtime

Working branch: `ci/node24-actions`.

**PR scope:** Update first-party GitHub Actions versions in the CI workflow so
CI, preview deploys, and production deploys stop using deprecated Node 20 action
runtimes. Do not change the app runtime, deploy logic, cache keys, or package
manager setup.

Completed:

- Updated `actions/checkout`, `actions/setup-node`, `actions/cache`, and
  `actions/github-script` references in `.github/workflows/ci.yml` to their
  Node 24-compatible major versions.
- Confirmed `NODE_VERSION` remains `20` because that controls the project
  runtime, not the GitHub action runtime.

Verification:

- `rg "actions/(checkout|setup-node|cache)@v4|actions/github-script@v7" .github/workflows/ci.yml`
- `pnpm --dir /Users/JeanFidele/Projects/oasis-portal exec prettier --check /private/tmp/oasis-node24-actions/.github/workflows/ci.yml /private/tmp/oasis-node24-actions/PROJECT_Oasis_Context.md`
- `git diff --check`

Notes:

- The isolated worktree at `/private/tmp/oasis-node24-actions` avoids the dirty
  primary workspace branch.
- GitHub Actions PR workflow remains the final validation for the hosted runner
  environment.

## Current session - 2026-05-27 Finance fee display

Working branch: `fix/finance-fee-display`.

**PR scope:** Update invoice/finance displays so parents and Pastor/Principal
staff can see gross fees, adjusted fees, savings, and gross left-to-pay figures
without mixing this with unrelated invoice workflows.

Completed:

- Added gross invoice totals beside the existing discounted totals for parent
  fee stats, family year summaries, and per-child year summaries.
- Updated parent fees to show `Current Balance`, `Annual Fee / Adjusted Fee`,
  green savings text, gross left-to-invoice/left-to-pay, and collapsed invoice
  cards by default while leaving individual invoice totals discounted.
- Added a Pastor/Principal-only student finance API and student-view Finance
  tab with paid/left-to-pay chart, discounts, invoiced, left to invoice,
  unpaid, overdue, and pending-review values.
- Added RBAC coverage for `canViewStudentFinance` so finance-tagged supervisors,
  Heads, parents, and students cannot access the child finance tab or endpoint.
- Kept student finance annual discount calculations aligned with the full linked
  family invoice context, including sibling invoices.

Verification:

- `pnpm exec prettier --write ...`
- `pnpm --filter @oasis/domain test -- rbac.test.ts`
- `pnpm --filter @oasis/api test -- invoice.router.test.ts`
- `pnpm --filter @oasis/domain typecheck`
- `pnpm --filter @oasis/api typecheck`
- `pnpm --filter @oasis/web typecheck`
- `pnpm --filter @oasis/domain lint`
- `pnpm --filter @oasis/api lint`
- `pnpm --filter @oasis/web lint`
- `pnpm --filter @oasis/web build`
- `git diff --check`
- `graphify update .`

Notes:

- Targeted package test commands still ran full package suites because of the
  repo's package-script argument handling.
- Local browser smoke check started the web app on `http://localhost:3001`, but
  the protected parent/admin finance routes redirected to Clerk sign-in without
  a signed-in test session.
- Existing warnings remain: Prisma config deprecation/driverAdapters warnings,
  Next.js ESLint-plugin warning, and the PDF standardFontDataUrl warning in the
  invoice test.

## Current session - 2026-05-26 Portal view switcher

Working branch: `feat/portal-view-switcher`.

**PR scope:** Add a parent/supervisor portal switcher for staff/admin users with
active linked children. Do not mix this with the invoice billing cycle branch.

Completed:

- Added a shared portal view switch component with Parent and Supervisor
  segments, tactile thumb movement, focus states, and reduced-motion fallback via
  existing global motion rules.
- Added role-aware staff destination resolution using the existing post-sign-in
  routing map.
- Rendered the switcher in admin, supervisor, and parent shells only when the
  current user has active linked children.
- Removed parent-only linked-child shortcuts from the admin and supervisor navs
  so staff users switch into the parent shell before using parent workflows.

Verification:

- `pnpm exec prettier --check apps/web/src/components/navigation/portal-view-switch.tsx apps/web/src/lib/portal-view-routing.ts 'apps/web/src/app/(admin)/admin/layout.tsx' 'apps/web/src/app/(supervisor)/supervisor/layout.tsx' 'apps/web/src/app/(parent)/parent/layout.tsx' 'apps/web/src/app/(admin)/admin/admin.css' 'apps/web/src/app/(parent)/parent/parent.css'`
- `pnpm --filter @oasis/web typecheck`
- `pnpm --filter @oasis/web lint`
- `pnpm --filter @oasis/web build`
- `git diff --check`
- `graphify update .`

Notes:

- The primary workspace still contains the preserved dirty invoice branch state.
  This switcher work was implemented in an isolated worktree at
  `/private/tmp/oasis-portal-view-switcher`.
- Browser smoke check could start the app on `http://localhost:3030`; authenticated
  portal routes still resolve through their existing auth guards, so visual
  switcher inspection requires a signed-in linked-child staff/admin session.

## Current session - 2026-05-25 Phase 6 mobile production plan

Working branch: `docs/phase-6-mobile-production-build`.

**PR scope:** Add the Phase 6 mobile production build plan and update phase
references only. Do not build any Phase 6 mobile PRs in this branch.

Completed:

- Added a Phase 6 plan that lists each mobile production PR with its goal, plan,
  and done criteria.
- Updated the master platform plan to point at Phase 6 and move production
  mobile ownership out of Phase 5.
- Updated the Phase 5 build plan so launch hardening consumes Phase 6 mobile
  outputs instead of adding more smoke-only mobile scope.

Verification:

- `pnpm exec prettier --check docs/phase-6-mobile-production-build-plan.md oasis-platform-plan.md docs/phase-5-build-plan.md PROJECT_Oasis_Context.md`
- `git diff --check`

## Current session - 2026-05-22 Permission slip workflow

Working branch: `feat/permission-slip-workflow`.

**PR scope:** Add the first production permission-slip workflow for Head/Pastor
creation and management, parent signing/declining, physical slip entry,
calendar sync, and payment confirmation.

Completed:

- Added permission-slip Prisma models, enums, migration, RLS policies, and
  database exports.
- Added domain helpers for Head/Pastor management gates, calendar category
  mapping, initial payment state, parent mark-paid transitions, and payment
  confirmation guards.
- Added the `permissionSlip` tRPC router with admin list/create/update/archive,
  parent list/respond/mark-paid, Head/Pastor physical-signature entry, and
  payment confirmation/rejection actions.
- Synced permission slips with calendar events when an `eventDate` is present,
  including create, update, archive, and no-event-date paths.
- Added admin and parent permission-slip pages and focused components based on
  `design/Oasis Learning Center.zip`, including nav entries and role gating.
- Updated the component ownership map for the new router, domain helper, and
  permission-slip UI surface.

Verification:

- `pnpm --filter @oasis/db exec prisma format`
- `pnpm --filter @oasis/db generate`
- `pnpm --filter @oasis/db typecheck`
- `pnpm --filter @oasis/domain typecheck`
- `pnpm --filter @oasis/api typecheck`
- `pnpm --filter @oasis/web typecheck`
- `pnpm --filter @oasis/db lint`
- `pnpm --filter @oasis/domain lint`
- `pnpm --filter @oasis/api lint`
- `pnpm --filter @oasis/web lint`
- `pnpm --filter @oasis/api test -- permissionSlip.router.test.ts calendar.router.test.ts`
- `pnpm --filter @oasis/domain test -- permissionSlips.test.ts`
- `pnpm --filter @oasis/web build`
- `pnpm db:migrate`
- `graphify update .`
- `pnpm docs:component-map`
- `git diff --check`

Notes:

- The targeted Vitest commands still ran full package suites because of the
  repo's package-script argument handling.
- The first sandboxed `pnpm db:migrate` attempt failed with a Prisma schema
  engine error against `localhost:5432`; the approved unsandboxed rerun
  completed, found no pending migrations, and applied the RLS file.
- `graphify update .` reported the existing lower-node-count warning but still
  rebuilt graph artifacts.

## Current session - 2026-05-22 Merit shop categories

Working branch: `feat/merit-shop-categories`.

**PR scope:** Add Accessories and Toys as Merit Shop categories across the
domain, API validation, database enum, and shop UI filters.

Completed:

- Added `Accessories` and `Toys` to the shop category domain source, visual
  metadata, Prisma enum, web category options, and mobile smoke shop filters.
- Added a database migration to extend the persisted `ShopCategory` enum.
- Changed the shop router test fake category type to use the exported domain
  `ShopCategory` type so tests track category additions.
- Added domain test coverage that verifies every configured shop category is
  accepted by `validateDraft`.
- Left the pre-existing spouse invite/profile changes and design zip dirty
  state untouched.

Verification:

- `pnpm --filter @oasis/db generate`
- `pnpm --filter @oasis/domain test -- shop.test.ts`
- `pnpm --filter @oasis/api test -- shop.router.test.ts`
- `pnpm --filter @oasis/domain typecheck`
- `pnpm --filter @oasis/db typecheck`
- `pnpm --filter @oasis/domain lint`
- `pnpm --filter @oasis/api typecheck`
- `pnpm --filter @oasis/api lint`
- `pnpm --filter @oasis/web typecheck`
- `pnpm --filter @oasis/web lint`
- `pnpm --filter @oasis/mobile typecheck`
- `pnpm --filter @oasis/mobile lint`
- `pnpm --filter @oasis/db lint`
- `pnpm --filter @oasis/web build`
- `git diff --check`
- `graphify update .`

Notes:

- The targeted Vitest commands still ran full package suites because of the
  repo's package-script argument handling.
- `graphify update .` reported the existing lower-node-count warning and did
  not leave a tracked graph diff.
- The web build passed with the existing Next.js ESLint-plugin warning.

## Current session - 2026-05-22 Spouse invite signup flow

Working branch: `fix/spouse-invite-signup-flow`.

**PR scope:** Fix spouse invitations so accepted spouses sign up through Clerk,
land in the parent portal with existing child links, and can see who invited
them.

Completed:

- Changed spouse invitations from the profile workflow to redirect accepted
  invitees to `/sign-up` instead of `/post-sign-in`.
- Kept the existing Clerk webhook guardian-link creation path unchanged.
- Extended `profile.me` to return the accepted spouse invitation inviter and
  audit inviter PII decrypts separately.
- Added the inviter display to Profile -> Role & Access.
- Left the pre-existing dirty `design/Oasis Learning Center.zip` change
  untouched.

Verification:

- `pnpm --filter @oasis/api test -- profile.router.test.ts clerkWebhook.test.ts`
  - pass, ran the full API suite because of package-script argument handling.
- `pnpm --filter @oasis/api typecheck`
- `pnpm --filter @oasis/web typecheck`
- `pnpm --filter @oasis/api lint`
- `pnpm --filter @oasis/web lint`
- `pnpm --filter @oasis/web build`
- `git diff --check`
- `graphify update .`

Notes:

- `graphify update .` reported the existing lower-node-count warning but still
  rebuilt the graph artifacts.

## Current session - 2026-05-21 Discipline stage tracker

Working branch: `feat/discipline-stage-tracker`.

**PR scope:** Add demerit stage escalation awareness to behaviour entry and a
parent-safe daily discipline tracker in the linked child view.

Completed:

- Added a reusable demerit policy transition helper for previous/next stage,
  escalation, and Stage 3+ note requirement.
- Added Europe/London day-boundary helpers for daily demerit status and
  discipline reset calculations.
- Enforced demerit notes in behaviour API writes when a single or batch entry
  would put any affected child on Stage 3 or higher.
- Added stage previews to the behaviour form for single and batch demerits,
  including stage-change messaging and required note controls.
- Added `discipline` data to `childLog.drillThrough` and a Discipline tab in
  the child drill-through/parent child view showing today’s stage and the
  demerits contributing to it.
- Preserved existing Sensitive behaviour visibility boundaries; parent
  discipline data only uses rows already visible to the parent.
- Left the pre-existing dirty `design/Oasis Learning Center.zip` change
  untouched.

Verification:

- `pnpm --filter @oasis/domain test -- demeritPolicy.test.ts`
- `pnpm --filter @oasis/api test -- behaviour.router.test.ts childNotes.router.test.ts`
- `pnpm --filter @oasis/domain typecheck`
- `pnpm --filter @oasis/api typecheck`
- `pnpm --filter @oasis/web typecheck`
- `pnpm --filter @oasis/domain lint`
- `pnpm --filter @oasis/api lint`
- `pnpm --filter @oasis/web lint`
- `pnpm --filter @oasis/web build`
- `git diff --check`
- `graphify update .`

Notes:

- The targeted package test commands currently run the full package suites
  because of the repo’s Vitest argument handling.
- API tests pass with the existing invoice PDF standard font warning.

## Current session - 2026-05-20 Admin clubs UI refresh

Working branch: `feat/admin-clubs-ui`.

**PR scope:** Refresh `/admin/clubs` to match the new admin clubs design:
card-grid landing, drill-in club detail, lead assignment, student assignment,
club attendance, rota, and notices.

Completed:

- Added manager-only `club.managementList` so club admin UI can show assigned
  lead names/emails without widening parent-facing `club.list`.
- Rebuilt admin clubs UI into focused components for cards, detail tabs, create
  and edit modal, visual helpers, and state orchestration.
- Reworked the Club Lead tab to match the provided card-based assignment
  screenshot, including the no-lead banner, candidate cards, per-card
  assign/remove actions, and "already leads" context.
- Added persisted club visual settings with nullable `Club.iconKey` and
  `Club.accentColor`, a create/edit icon picker, random colour defaulting, and
  deterministic fallback visuals for existing clubs.
- Preserved existing club create/update/deactivate, student assignment,
  multi-lead assignment, attendance, rota, and notice behaviours.
- Added attendance summary counts and a Mark all present action.
- Updated clubs E2E selectors for the new flow.
- Relaxed club-router ID inputs from CUID-only validation to non-empty string
  validation so valid linked student IDs from existing environments can be
  assigned without failing at the tRPC boundary.
- Added API regression coverage for non-CUID linked student IDs during club
  signup.
- Referenced the updated `design/Oasis Learning Center.zip` as the UI source of
  truth; the zip remains user-provided dirty context.

Verification:

- `pnpm --filter @oasis/api test -- src/__tests__/club.router.test.ts`
- `pnpm --filter @oasis/api typecheck`
- `pnpm --filter @oasis/api lint`
- `pnpm --filter @oasis/web typecheck`
- `pnpm --filter @oasis/web lint`
- `pnpm --filter @oasis/web build`
- `git diff --check`
- `graphify update .`

Not run:

- `pnpm --filter @oasis/web test:e2e -- phase-3-5-clubs.spec.ts` because no
  `E2E_*` credentials are configured in this environment.

## Current session - 2026-05-19 Clubs assignment action colours

Working branch: `fix/clubs-assign-remove-colours`.

**PR scope:** Make the admin clubs Assign action visually distinct from Remove
without changing assignment behaviour.

Completed:

- Scoped the student assignment row's Assign button to the existing Oasis
  success green, leaving Remove on the existing danger treatment.
- Referenced `design/Oasis Learning Center.zip` and reused the established
  success/danger colour tokens from the Oasis palette.

Verification:

- `pnpm --filter @oasis/web typecheck`
- `pnpm --filter @oasis/web lint`
- `NEXT_PRIVATE_BUILD_WORKER=0 pnpm --filter @oasis/web build`
- `git diff --check`
- `graphify update .`

No blockers.

## Current session - 2026-05-19 Invite email role preservation

Working branch: `fix/invite-email-role`.

**PR scope:** Preserve the selected admin invitation role when the invited user
accepts the email link, even if Clerk does not copy invitation metadata onto the
created user webhook payload.

Completed:

- Changed the Clerk webhook store to use the pending `UserInvitation` row for
  the accepting email as the source of truth for first-time account role/tags.
- Kept existing-user sync behaviour unchanged so webhook updates still do not
  overwrite admin-managed roles or tags.
- Added a regression test for a Pastor invite where Clerk sends the webhook
  without invitation metadata.

Verification:

- `pnpm --filter @oasis/api test -- src/__tests__/clerkWebhook.test.ts`
- `pnpm --filter @oasis/api typecheck`
- `pnpm --filter @oasis/api lint`
- `git diff --check`
- `graphify update .`

No blockers.

## Current session - 2026-05-19 Clubs Lead portal and club assignments

Working branch: `feat/clubs-lead-portal`.

**PR scope:** Add a ClubsLead role and portal, allow club managers to assign
children and ClubsLead users to clubs, and scope ClubsLead behaviour,
attendance, and notices to assigned active clubs and active students.

Completed:

- Added the `ClubsLead` role, post-sign-in routing to `/clubs-lead`, RBAC
  exclusions from unrelated staff/admin/tag workflows, and invite/profile labels.
- Added `ClubLeadAssignment` in Prisma with assignment indexes and RLS policies
  that only allow ClubsLead users to select/insert General behaviour for active
  students in assigned active clubs.
- Extended the club API for manager-side student assignment, ClubsLead
  assignment, assigned club lookup, scoped roster/attendance/notification access,
  and parent-visible club notices.
- Extended behaviour API scoping so ClubsLead users can record only
  General-visible Merit/Demerit/General entries for active assigned-club
  students.
- Added `/clubs-lead` with the Oasis clubs lead design reference: assigned club
  switcher, overview, behaviour entry, club attendance, and noticeboard tabs.
- Added admin club assignment panels and parent My Clubs notice rendering.
- Updated component relationship coverage and graphify output.

Verification:

- `pnpm --filter @oasis/db generate`
- `pnpm --filter @oasis/domain test -- src/__tests__/rbac.test.ts src/__tests__/clubs.test.ts src/__tests__/shop.test.ts`
- `pnpm --filter @oasis/api test -- src/__tests__/club.router.test.ts src/__tests__/behaviour.router.test.ts`
- `pnpm --filter @oasis/db test`
- `pnpm --filter @oasis/domain typecheck`
- `pnpm --filter @oasis/api typecheck`
- `pnpm --filter @oasis/db typecheck`
- `pnpm --filter @oasis/web typecheck`
- `pnpm --filter @oasis/domain lint`
- `pnpm --filter @oasis/api lint`
- `pnpm --filter @oasis/db lint`
- `pnpm --filter @oasis/web lint`
- `pnpm --filter @oasis/web build`
- `pnpm docs:component-map`
- `graphify update .`
- `git diff --check`

Known blocker:

- `pnpm --filter @oasis/db db:integration` first hit sandbox IPC restrictions.
  The env-wrapped rerun was rejected by the approval reviewer because the RLS
  smoke truncates and repopulates tables against the configured database. Run it
  only against an explicitly approved disposable/local database.

## Current session - 2026-05-19 Multi-child behaviour and ClubsAdmin parity

Working branch: `feat/multi-child-behaviour`.

**PR scope:** Allow behaviour entries to target multiple children at once and
make ClubsAdmin match Supervisor site-wide, with club management as the only
extra capability.

Completed:

- Added multi-student behaviour mutations for single Merit/Demerit/General
  entries and batch Merit/Demerit entries, preserving the existing single-student
  mutation contracts.
- Updated admin and supervisor behaviour forms to use multi-select child
  selectors with a Select all option.
- Expanded ClubsAdmin parity in RBAC and route gates for child-registration,
  all-student supervisor workflow tags, student reads, PACE workflow date
  editing, attendance register access, and admin calendar visibility.
- Updated behaviour, RBAC, admin-router, and ClubsAdmin e2e expectations for
  the new access model.

Verification:

- `pnpm --filter @oasis/domain test -- rbac.test.ts`
- `pnpm --filter @oasis/api test -- behaviour.router.test.ts admin.router.test.ts`
- `pnpm --filter @oasis/domain typecheck`
- `pnpm --filter @oasis/api typecheck`
- `pnpm --filter @oasis/web typecheck`
- `pnpm --filter @oasis/api lint`
- `pnpm --filter @oasis/web lint`
- `pnpm --filter @oasis/web build`
- `pnpm lint`
- `git diff --check`

Known blocker:

- `graphify update .` failed because the local graphify Python environment is
  missing `networkx`; no graph files were updated.

## Current session - 2026-05-18 Audit log Head access and inspection scope

Working branch: `feat/audit-log-head-ui`.

**PR scope:** Refresh `/admin/audit` for Head-facing inspection review and
delegate access through `audit-viewer`, without removing lower-level security
audit rows from storage.

Completed:

- Added shared `canViewAuditLog` RBAC so `Head` can always access the audit log
  and non-parent/non-student users require the `audit-viewer` tag.
- Changed `audit.list` to apply an inspection audit scope before user filters:
  attendance, attendance exports, PACE records/advancement, behaviour entries,
  child notes, student records, student subjects, staff attendance, and user
  profile changes.
- Refreshed the `/admin/audit` UI against the Oasis design reference with
  compact summary cards, labelled filters, clearer entity/action/actor display,
  and mobile-friendly table behaviour.
- Updated the audit page copy so it describes inspection-relevant operational
  rows instead of technical decrypt/login events.

Verification:

- `pnpm --filter @oasis/domain test -- rbac.test.ts`
- `pnpm --filter @oasis/api test -- audit.router.test.ts`
- `pnpm --filter @oasis/domain typecheck`
- `pnpm --filter @oasis/api typecheck`
- `pnpm --filter @oasis/web typecheck`
- `pnpm --filter @oasis/web lint`
- `pnpm --filter @oasis/web build`
- `pnpm lint`
- `git diff --check`
- `graphify update .`

No blockers.

## Previous session - 2026-05-17 Merit shop reservations CI lint repair

Working branch: `feat/merit-shop-reservations`.

**PR scope:** Repair the GitHub lint failure in the shop reservation API scope
without changing reservation behaviour.

Completed:

- Narrowed the created reservation in `shop.router.test.ts` before using its ID
  in ledger reason template literals.
- Removed redundant shop router type assertions now caught by
  `@typescript-eslint/no-unnecessary-type-assertion`.

Verification:

- `pnpm --filter @oasis/api lint`
- `pnpm --filter @oasis/api test -- src/__tests__/shop.router.test.ts`
- `pnpm --filter @oasis/api typecheck`
- `pnpm lint`
- `graphify update .`

No blockers.

**Completed scope:** Phase 4 merit economy, shop, leaderboards, student mobile
view, and term report workflows are merged. End-of-phase verification is in
place with accounting invariant coverage, credentials-gated Phase 4 Playwright
smoke coverage, mobile typecheck coverage, DB/RLS smoke, and encryption dump
verification.

Merged Phase 4 status:

- PR-4.0 `feat(api): merit wallet balances and transfers` merged via PR #134
  on 2026-05-15.
- PR #135 `feat: add mobile more nav drawer` merged on 2026-05-15.
- PR-4.1 `feat(api): weekly tithe config and run` merged via PR #136 on
  2026-05-15.
- PR-4.2 `feat(api): investment NAV and account transactions` merged via PR
  #138 on 2026-05-15.
- PR-4.3 `feat(api): shop item management` merged via PR #139 on 2026-05-15.
- PR-4.4 `feat(api): shopkeeper purchase flow` merged via PR #140 on
  2026-05-15; post-merge `main` CI/CD run 25945758410 passed, including
  production deploy.
- PR-4.5 `feat(web): shop admin and shopkeeper UI` merged via PR #141 on
  2026-05-15; post-merge `main` CI/CD run 25946785198 passed, including
  production deploy.
- PR-4.6 `feat(api): merit leaderboards` merged via PR #142 on 2026-05-16;
  post-merge `main` CI/CD run 25947421915 passed, including production deploy.
- PR-4.7 `feat(mobile): student merit and results view` merged via PR #143 on
  2026-05-16; post-merge `main` CI/CD run 25948107960 passed, including
  production deploy.
- PR-4.8 `feat(api): term report draft/review/send` merged via PR #144 on
  2026-05-16; post-merge `main` CI/CD run 25948783221 passed, including
  production deploy.
- PR-4.9 `feat(web): term report review and send UI` merged via PR #145 on
  2026-05-16; post-merge `main` CI/CD run 25949609647 passed, including
  production deploy.
- PR-4.10 `test: Phase 4 verification suite` merged via PR #146 on
  2026-05-16; post-merge `main` CI/CD run 25950126576 passed, including
  production deploy.

Completed verification:

- `pnpm --filter @oasis/api test -- report.router.test.ts email.router.test.ts`
- `pnpm --filter @oasis/api typecheck`
- `pnpm --filter @oasis/api lint`
- `pnpm --filter @oasis/domain test -- phase4AccountingInvariants.test.ts`
- `pnpm --filter @oasis/domain typecheck`
- `pnpm --filter @oasis/domain lint`
- `pnpm --filter @oasis/web typecheck`
- `pnpm --filter @oasis/web lint`
- `pnpm --filter @oasis/web build`
- `pnpm --filter @oasis/web test:e2e -- phase-4-verification.spec.ts` when
  `E2E_*` credentials are configured.
- `pnpm --filter @oasis/mobile typecheck`
- `pnpm docs:component-map`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm db:integration`
- `pnpm api:smoke-context-rls`
- `pnpm verify:encryption`
- `git diff --check`
- `graphify update .`

Next phase:

- Phase 5 remains the next planned workstream.
- No Phase 4 blockers are being carried forward.

## Previous status - PR-4.4 Shopkeeper purchase flow

Working branch: `feat/shopkeeper-purchase-flow`.

**PR scope:** Implement API-only Merit Shop purchase recording on top of merged
PR-4.3 item management, while leaving shop web UI, leaderboards, reports, and
mobile surfaces to later Phase 4 PRs.

Merged Phase 4 status:

- PR-4.0 `feat(api): merit wallet balances and transfers` merged via PR #134
  on 2026-05-15.
- PR #135 `feat: add mobile more nav drawer` merged on 2026-05-15.
- PR-4.1 `feat(api): weekly tithe config and run` merged via PR #136 on
  2026-05-15.
- PR-4.2 `feat(api): investment NAV and account transactions` merged via PR
  #138 on 2026-05-15.
- PR-4.3 `feat(api): shop item management` merged via PR #139 on 2026-05-15.
- PR-4.4 `feat(api): shopkeeper purchase flow` merged via PR #140 on
  2026-05-15.

Planned scope:

- Implement `shop.purchase`.
- Gate purchase recording to full-admin or `shopkeeper`.
- Require active student, active item, positive units, sufficient stock, and
  sufficient Spend balance.
- Run purchase writes in a serializable transaction.
- Atomically decrement item stock, create `ShopPurchase`, and append balanced
  Spend/Given ledger rows.
- Audit purchase success, rejected purchase paths, and permission-denied paths.

Verification target:

- `pnpm --filter @oasis/api test -- shop.router.test.ts`
- `pnpm --filter @oasis/domain test -- shop.test.ts`
- `pnpm --filter @oasis/api typecheck`
- `pnpm --filter @oasis/api lint`
- `pnpm lint`
- `pnpm typecheck`
- `git diff --check`
- `graphify update .`

## Previous status - PR-4.3 Shop item management

Working branch: `feat/shop-item-management`.

**PR scope:** Implement API-only Merit Shop item listing, creation, update, and
deactivation on top of the merged Phase 4 wallet, tithe, and investment APIs,
while leaving shopkeeper purchase flow, shop UI, leaderboards, reports, and
mobile surfaces to later Phase 4 PRs.

Merged Phase 4 status:

- PR-4.0 `feat(api): merit wallet balances and transfers` merged via PR #134
  on 2026-05-15.
- PR #135 `feat: add mobile more nav drawer` merged on 2026-05-15.
- PR-4.1 `feat(api): weekly tithe config and run` merged via PR #136 on
  2026-05-15.
- PR-4.2 `feat(api): investment NAV and account transactions` merged via PR
  #138 on 2026-05-15.

Planned scope:

- Replace the shop item-management placeholder handlers with implemented
  `listItems`, `createItem`, and `updateItem`.
- Keep `shop.purchase` deferred to PR-4.4.
- Allow active item browsing for signed-in users by default.
- Gate inactive item listing and item create/update/deactivate to full-admin or
  `shopadmin`.
- Reuse the domain shop pricing and validation helpers for VAT-inclusive prices.
- Audit item create, update, deactivate, and permission-denied management paths.

Verification target:

- `pnpm --filter @oasis/api test -- shop.router.test.ts`
- `pnpm --filter @oasis/domain test -- shop.test.ts`
- `pnpm --filter @oasis/api typecheck`
- `pnpm --filter @oasis/api lint`
- `pnpm lint`
- `pnpm typecheck`
- `git diff --check`
- `graphify update .`

## Previous status - PR-4.2 Investment NAV and account transactions

Working branch: `feat/investment-nav-account-transactions`.

**PR scope:** Implement API-only investment NAV ticks, account reads, buy, and
sell transactions on top of the merged PR-4.0 merit wallet API and PR-4.1
weekly tithe API, while leaving shop, leaderboards, reports, and UI surfaces to
later Phase 4 PRs.

Merged Phase 4 status:

- PR-4.0 `feat(api): merit wallet balances and transfers` merged via PR #134
  on 2026-05-15.
- PR #135 `feat: add mobile more nav drawer` merged on 2026-05-15.
- PR-4.1 `feat(api): weekly tithe config and run` merged via PR #136 on
  2026-05-15.

Planned scope:

- Replace the `investment` placeholder router with `account`, `navHistory`,
  `buy`, `sell`, and `tickNav`.
- Use the deterministic investment simulator and `INVESTMENT_NAV_SEED`, falling
  back to `oasis-v1` in local/test mode when the env var is absent.
- Store one `InvestmentNav` row per UTC day and make repeat ticks idempotent.
- Allow full-admin users to view/transact for active students, linked parents to
  view linked children, and linked students to view/transact for themselves.
- Keep parent investment writes denied and audited in PR-4.2.
- Buy investment units from Spend merits at latest NAV.
- Sell units back to Spend at latest NAV, applying the 5 percent withdrawal fee.
- Add `InvestmentReturn` ledger accounting so realized gains/losses keep
  buy/sell ledger rows balanced without corrupting Investment cost basis.
- Audit buy, sell, tick, rejected transaction, and permission-denied paths.

Verification target:

- `pnpm --filter @oasis/api test -- investment.router.test.ts meritLedger.router.test.ts tithe.router.test.ts`
- `pnpm --filter @oasis/domain test -- investmentSim.test.ts investmentTransactions.test.ts meritLedger.test.ts tithe.test.ts`
- `pnpm --filter @oasis/api typecheck`
- `pnpm --filter @oasis/api lint`
- `pnpm lint`
- `pnpm typecheck`
- `git diff --check`
- `graphify update .`

## Current status - PR-4.1 Weekly tithe config and run

Working branch: `feat/weekly-tithe-config-run`.

**PR scope:** Implement API-only weekly tithe config and run support on top of
the merged PR-4.0 merit wallet API, while leaving investment, shop,
leaderboards, reports, and UI surfaces to later Phase 4 PRs.

Merged Phase 4 status:

- PR-4.0 `feat(api): merit wallet balances and transfers` merged via PR #134
  on 2026-05-15.
- PR-4.1 `feat(api): weekly tithe config and run` merged via PR #136 on
  2026-05-15.

Planned scope:

- Replace the `tithe` placeholder router with `getConfig`, `setPercentage`,
  and `runWeek`.
- Default tithe config to 10 percent weekly when no row exists.
- Allow full-admin users and linked parents to view/update tithe percentage;
  students cannot view or update tithe config in PR-4.1.
- Run weekly tithe for active students only, using Monday-Sunday UTC periods.
- Compute tithe from gross positive merits only; demerits do not reduce the
  base.
- Make each student/week run idempotent via `TitheRun`.
- Create balanced `Spend` debit and `TithePaid` credit ledger rows when a
  positive tithe is due.
- Audit config changes, denied access, and weekly run summaries.

Verification target:

- `pnpm --filter @oasis/api test -- tithe.router.test.ts meritLedger.router.test.ts`
- `pnpm --filter @oasis/domain test -- tithe.test.ts meritLedger.test.ts`
- `pnpm --filter @oasis/api typecheck`
- `pnpm --filter @oasis/api lint`
- `pnpm lint`
- `pnpm typecheck`
- `git diff --check`
- `graphify update .`

## Current status - PR-4.0 Merit wallet API

Working branch: `feat/merit-wallet-api`.

**PR scope:** Implement API-only merit wallet balances, calendar activity, and
Spend/Saving transfers while leaving UI, tithe, shop, leaderboard, and
investment unit accounting to later Phase 4 PRs.

Changed scope:

- Replaced the `meritLedger` placeholder router with implemented
  `balances`, `activity`, and `transfer` procedures.
- Added role-aware wallet access: full-admin users can read and transfer for
  active students, parents can read linked active children only, and students
  can read/transfer only their linked student record.
- Kept transfers limited to `Spend` and `Saving`; Investment movement now
  returns a clear API error and is reserved for the investment buy/sell API.
- Derive balances from append-only `MeritLedger` rows and calendar activity
  from behaviour entries for the current Monday-Sunday week or current calendar
  month.
- Added audit writes for permission denials, rejected transfer attempts, and
  successful balanced transfer rows.
- Added focused API router coverage for balances, activity periods, access
  boundaries, insufficient funds, Investment transfer rejection, and audit rows.

Verification:

- `pnpm --filter @oasis/api test -- meritLedger.router.test.ts behaviour.router.test.ts` -
  pass; due to existing Vitest argument handling this ran all API router tests:
  19 files / 450 tests.
- `pnpm --filter @oasis/domain test -- meritLedger.test.ts` - pass; due to
  package-script argument handling this ran all domain tests: 12 files / 148
  tests.
- `pnpm --filter @oasis/api typecheck` - pass.
- `pnpm --filter @oasis/api lint` - pass.
- `pnpm lint` - pass.
- `pnpm typecheck` - pass.
- `git diff --check` - pass.
- `graphify update .` - pass with an existing graph-size warning; graphify
  reported `graph.json`, `graph.html`, and `GRAPH_REPORT.md` updated under
  `graphify-out`.

Notes:

- No database migration was needed.
- Unrelated working-tree changes are present in the mobile more-nav drawer
  scope and were left untouched.

## Current status - Mobile more nav drawer

Working branch: `feat/mobile-more-nav-drawer`.

**PR scope:** Add a reusable Expo mobile overflow navigation drawer so mobile
shells can support more destinations without overcrowding the bottom bar.

Changed scope:

- Extended the shared mobile bottom nav to render up to four primary buttons by
  default, with the rightmost button becoming `More` when overflow items exist.
- Added a modal bottom drawer for overflow nav items with Oasis-themed light and
  dark styling, active states, badges, backdrop dismissal, and built-in React
  Native slide/spring animation.
- Tuned the drawer to use a slower eased entrance with three bounce steps before
  settling, and added manual drag-down dismissal using React Native
  `PanResponder`.
- Strengthened the drawer gesture capture so downward swipes over drawer content
  dismiss reliably while outside backdrop taps still close the drawer.
- Refined the bounce animation to use smaller decaying overshoots and extended
  the drawer background below the viewport so the bottom UI is not exposed
  during the slide-up bounce.
- Added a hand-drawn `more` icon to the existing mobile nav icon set without
  adding dependencies.
- Staff mobile now overflows `Clubs` into the More drawer because it has five
  tabs; parent mobile remains unchanged because it currently has four tabs.

Verification:

- `pnpm --filter @oasis/mobile typecheck` - pass.
- `pnpm --filter @oasis/mobile lint` - pass.
- `pnpm exec prettier --check apps/mobile/src/components/smoke/portal-mobile-shell.tsx` -
  pass.
- `pnpm --filter @oasis/mobile exec expo export --platform ios --output-dir /tmp/oasis-mobile-more-nav-drawer-export` -
  pass.
- `git diff --check` - pass.
- `PYTHONPATH=graphify python3 -m graphify query "mobile bottom navigation drawer more menu options" --budget 1500` -
  blocked by missing local Python dependency `networkx`.
- `PYTHONPATH=graphify python3 -m graphify update .` - blocked by missing local
  Python dependency `networkx`.

## Current status - PR-3.5.6 Phase 3.5 verification suite

Working branch: `test/phase-3-5-verification-suite`.

**PR scope:** Close Phase 3.5 by confirming merged club PRs, extending the
credential-gated web verification suite for parent signup/withdrawal, and
re-running end-of-phase API/domain/web/DB/RLS/encryption checks.

Merged Phase 3.5 status:

- PR-3.5.0 `feat(api): club management and signups` merged via PR #96 on
  2026-05-11.
- PR-3.5.1 `feat(web): ClubsAdmin club management` merged via PR #103 on
  2026-05-11.
- PR-3.5.2 `feat(web): parent club signup` merged via PR #105 on 2026-05-11.
- PR-3.5.3 `feat(api): club notifications` merged via PR #110 on 2026-05-12.
- PR-3.5.4 `feat(web): club notification UI` merged via PR #112 on
  2026-05-12.
- PR-3.5.5 `feat(mobile): clubs smoke` merged via PR #121 on 2026-05-13.
- Follow-up `fix(mobile): surface admin clubs` merged via PR #128 on
  2026-05-14.

Changed scope:

- Updated the Phase 3.5 plan so PR-3.5.5 is recorded as merged, the PR #128
  mobile club-manager visibility follow-up is captured, and PR-3.5.6 is active.
- Extended `phase-3-5-clubs.spec.ts` with parent signup/withdrawal coverage
  that runs when the configured Parent fixture has linked children and at least
  one available or signed-up club.

Verification:

- `pnpm --filter @oasis/web test:e2e -- phase-3-5-clubs.spec.ts` - pass after
  sandbox escalation for the local web server bind; 6 credential-gated tests
  skipped because local E2E account variables are not configured.
- `pnpm --filter @oasis/api test -- club.router.test.ts profile.router.test.ts clerkWebhook.test.ts admin.router.test.ts email.router.test.ts` -
  pass, ran all API tests because of Vitest argument handling: 18 files / 440
  tests.
- `pnpm --filter @oasis/domain test -- rbac.test.ts clubs.test.ts users.test.ts` -
  pass, ran all domain tests because of package-script argument handling: 12
  files / 148 tests.
- `pnpm lint` - pass.
- `pnpm typecheck` - pass.
- `pnpm test` - pass: 18 API files / 440 tests, 5 DB files / 28 tests, and 12
  domain files / 148 tests.
- `pnpm --filter @oasis/web build` - pass.
- `pnpm db:integration` - pass; run by Jean-Fidele against a confirmed
  disposable database after the sandboxed run was blocked by `tsx` IPC
  restrictions.
- `pnpm api:smoke-context-rls` - pass; run by Jean-Fidele against a confirmed
  disposable database after the sandboxed run was blocked by `tsx` IPC
  restrictions.
- `pnpm verify:encryption` - pass after sandbox escalation for read-only
  `pg_dump`; 16 plaintext fixture values absent from dump data.
- `git diff --check` - pass.
- `graphify update .` - pass.

Carry-forward:

- Run credential-gated web club scenarios in an environment with
  `E2E_HEAD_EMAIL`, `E2E_HEAD_PASSWORD`, `E2E_CLUBS_ADMIN_EMAIL`,
  `E2E_CLUBS_ADMIN_PASSWORD`, `E2E_SUPERVISOR_EMAIL`,
  `E2E_SUPERVISOR_PASSWORD`, `E2E_PARENT_EMAIL`, and `E2E_PARENT_PASSWORD`
  configured if the local environment skips those paths.

## Current status - Mobile admin clubs visibility fix

Working branch: `fix/mobile-admin-clubs-visible`.

**PR scope:** Make the admin/staff side of the Expo mobile smoke app surface
club access visibly from the staff dashboard, not only behind the bottom Clubs
tab.

Changed scope:

- Added a club-manager role gate in the staff mobile smoke screen for Head,
  Principal, Pastor, HeadOfDiscipline, and ClubsAdmin users.
- Loaded `club.list` on the dashboard for those club-manager roles so the admin
  side shows a Clubs card immediately after sign-in.
- Added an "Open Clubs" dashboard action that switches to the existing Clubs
  roster tab.
- Kept Supervisor accounts from loading club manager data on the dashboard, so
  club access errors remain scoped to the Clubs tab if they open it.

Verification:

- `pnpm --filter @oasis/mobile typecheck` - pass.
- `pnpm --filter @oasis/mobile lint` - pass.
- `pnpm --filter @oasis/mobile exec expo export --platform ios --output-dir /tmp/oasis-mobile-admin-clubs-visible-export` -
  pass.
- `git diff --check` - pass.
- `pnpm exec prettier --check apps/mobile/src/components/smoke/supervisor-smoke-screen.tsx PROJECT_Oasis_Context.md` -
  pass.
- `graphify update .` - pass.

## Current status - PR-3.5.5 Mobile clubs smoke

Working branch: `feat/mobile-clubs-smoke`.

**PR scope:** Add minimal Expo mobile smoke coverage for parent club
signup/withdrawal and ClubsAdmin roster reads using the existing typed club API.
PR-3.5.4 is marked merged via PR #112 on 2026-05-12.

Changed scope:

- Added a parent mobile Clubs tab that reads `club.linkedChildSignupContext`,
  shows linked-child selection, active clubs, capacity/full state, signed-up
  state, pending state, success feedback, empty state, and mutation errors.
- Added a staff mobile Clubs tab that reads `club.list` and `club.roster` for
  club-manager accounts, with access errors kept inside the clubs panel.
- Extended the shared mobile nav icons with a clubs icon while preserving the
  existing smoke shell styling derived from the Oasis design reference.
- Updated the Phase 3.5 tracker so PR-3.5.4 is recorded as merged and PR-3.5.5
  is active.

Verification:

- `pnpm --filter @oasis/mobile typecheck` - pass.
- `pnpm --filter @oasis/mobile lint` - pass.
- `pnpm --filter @oasis/mobile exec expo export --platform ios --output-dir /tmp/oasis-mobile-clubs-smoke-export` -
  pass.
- `git diff --check` - pass.
- `graphify update .` - pass.

Notes:

- Manual mobile smoke with live Parent and ClubsAdmin credentials was not run in
  this environment.

## Current status - Centre snapshot PACE identity label

Working branch: `feat/pace-auto-merits`.

**PR scope:** Clarify the whole-centre snapshot PACE test rows so staff can
distinguish the student who took the test from the supervisor who recorded it.

Changed scope:

- Updated the compact "PACE Tests this period" rows to render
  `Subject #PACE - Student full name` when the row is shown from the
  whole-centre snapshot.
- Labelled the recorder as `Supervisor: Name` in the compact row metadata.

Verification:

- `pnpm exec prettier --check apps/web/src/components/child-log/child-snapshot-client.tsx` -
  pass.
- `pnpm --filter @oasis/web typecheck` - pass.
- `pnpm --filter @oasis/web lint` - pass.
- `graphify update .` - pass.

## Current status - PR-3.5.4 Club notification UI

Working branch: `feat/club-notification-ui`.

**PR scope:** Add the web club notification composer and scoped notification
history for Head/full-admin and ClubsAdmin users on the existing `/admin/clubs`
management surface. Previous Phase 3.5 PRs 3.5.1, 3.5.2, and 3.5.3 are marked
merged.

Changed scope:

- Added `club.notifications`, a club-manager-only history query returning recent
  notification title, sent time, and sender display name without decrypted body
  text or recipient PII.
- Added a notification composer to the selected club roster/detail panel with
  required title/body fields, estimated recipient count, inactive-club guard,
  pending, success, and error states.
- Added notification history to the club detail panel with loading, empty, and
  error states.
- Extended the club E2E spec to cover the empty-recipient notification path
  when ClubsAdmin credentials are configured.
- Updated the Phase 3.5 plan so PR-3.5.1, PR-3.5.2, and PR-3.5.3 are recorded
  as merged.

Verification:

- `pnpm --filter @oasis/api test -- club.router.test.ts email.router.test.ts` -
  pass, ran all API tests because of package-script argument handling: 18 files
  / 376 tests.
- `pnpm --filter @oasis/api typecheck` - pass.
- `pnpm --filter @oasis/web typecheck` - pass.
- `pnpm --filter @oasis/web test:e2e -- phase-3-5-clubs.spec.ts` - pass with
  5 credential-gated tests skipped because local E2E account variables are not
  configured.
- `pnpm lint` - pass.
- `pnpm --filter @oasis/web build` - pass.
- `graphify update .` - pass.
- `git diff --check` - pass.

Notes:

- The clean branch was created in a separate worktree at
  `/private/tmp/oasis-club-notification-ui` so the dirty
  `feat/behaviour-general-batch-marks` branch was left untouched.
- The first Playwright run failed in the sandbox because the web server could
  not bind to `0.0.0.0:3000`; it passed after rerunning with approved
  escalation.

## Previous status - Supervisor attendance and attendance insight center

Working branch: `feat/supervisor-attendance-insights-visible`.

**PR scope:** Expand attendance so Head/full-admin users can mark student and
staff attendance in separate registers, require absence subcategories for new
Absent records, and view student/supervisor attendance trends on a separate
visual-only attendance center page.

Changed scope:

- Added nullable `absenceReason` fields to student and staff attendance with
  the subcategories Sick, Holiday, Not scheduled, Excused, and Unexcused.
- Preserved legacy Absent rows without a reason; reports and insights surface
  them as Unknown until manually updated.
- Extended attendance APIs to return absence reasons, require them for new
  Absent saves, clear them for Present/Late, and keep existing CSV endpoints
  available for backward compatibility.
- Added a rota-backed staff attendance register at `/admin/attendance/staff`
  so scheduled supervisors appear by day and unscheduled staff who came in can
  be added as Present.
- Kept the student register on `/admin/attendance` and moved the view-only
  visual center to `/admin/attendance/center`.
- The visual center contains Students/Supervisors tabs, aggregate summaries,
  trend charts, status breakdowns, absence reason breakdowns, and individual
  drilldown.

Verification:

- `pnpm --filter @oasis/db generate` - pass.
- `DATABASE_URL=postgresql://user:pass@localhost:5432/oasis DIRECT_URL=postgresql://user:pass@localhost:5432/oasis pnpm --filter @oasis/db exec prisma validate` - pass.
- `pnpm --filter @oasis/api test -- attendance.router.test.ts` - pass, ran all
  API tests because of package-script argument handling: 18 files / 358 tests.
- `pnpm --filter @oasis/api typecheck` - pass.
- `pnpm --filter @oasis/web typecheck` - pass.
- `pnpm exec prettier --check ...` for changed TS/TSX/CSS files - pass.
- `pnpm lint` - pass.
- `pnpm --filter @oasis/web build` - pass.
- `graphify update .` - pass.
- `git diff --check` - pass.

Notes:

- Prisma validation used explicit placeholder `DATABASE_URL` and `DIRECT_URL`
  values because this clean worktree does not include local env files.
- The browser smoke check could start the dev server, but authenticated
  attendance pages redirected to the app's unauthenticated 404 path without a
  Clerk session.

## Previous status - Calendar categories and birthday visibility

Working branch: `feat/calendar-categories-birthdays`.

**PR scope:** Extend the shared portal calendar with category colours,
head-only visibility, optional single-day time ranges, virtual birthday events,
and read-only event details for parent/supervisor views.

Changed scope:

- Added calendar categories with fixed colour mapping and a legend across the
  shared calendar UI.
- Added `Heads` calendar audience visibility for Head, Principal, Pastor, and
  HeadOfDiscipline only.
- Added optional start/end time ranges for single-date manual events.
- Added encrypted optional user DOB storage for admin-managed adult profiles so
  supervisor birthdays can be generated.
- Generated student and supervisor birthday events virtually for full-admin
  head roles only; birthday events are not persisted, editable, or archivable.
- Added admin date-click form syncing and read-only event detail modals for
  non-managing parent/supervisor calendar views.
- Follow-up: added a single-date/date-range selector to the admin calendar form.
  In range mode, the first calendar click sets the start date and the second
  click sets the end date, with the selected range highlighted in the month
  grid.

Verification:

- `pnpm db:generate` - pass with existing Prisma deprecation warnings.
- `pnpm --filter @oasis/api test admin.router.test.ts calendar.router.test.ts profile.router.test.ts` -
  pass, 3 files / 98 tests.
- `pnpm --filter @oasis/api typecheck` - pass.
- `pnpm --filter @oasis/web typecheck` - pass.
- `pnpm --filter @oasis/web lint` - pass.
- `graphify update .` - pass.
- Follow-up checks for range selection: `pnpm db:generate`, `pnpm --filter
@oasis/web typecheck`, `pnpm --filter @oasis/web lint`, `pnpm exec prettier
--check ...`, `graphify update .`, and `pnpm --filter @oasis/web build` -
  pass.

Notes:

- Existing `.gitignore` changes were already present before this branch and were
  left untouched.
- Full build and full monorepo lint were not run in this session.

## Previous status - ClubsAdmin supervisor workflow extension

Working branch: `feat/clubs-admin-linked-children`.

**PR scope:** Extend ClubsAdmin from club management only to club management plus
daily Supervisor workflow access, while keeping full-admin-only management
boundaries intact.

Changed scope:

- Treats ClubsAdmin as operational staff for Supervisor workflows.
- Allows ClubsAdmin to be scheduled on the supervisor rota and appear in active
  staff scheduling/availability lists.
- Allows ClubsAdmin to use assigned-band PACE scoring, behaviour merit/demerit
  logging, child notes, snapshot/drill-through, staff calendar, and staff
  notices through existing Supervisor workflow surfaces.
- Keeps ClubsAdmin routed to `/admin/clubs` after sign-in, with admin-shell
  links to linked-child `My Children`, linked-child `My Clubs`, and the
  Supervisor portal when applicable.
- Adds a `Club Admin` link back from the Supervisor shell for users who can
  manage clubs.
- Preserves linked-child signup restrictions so ClubsAdmin can sign up or
  withdraw only linked children unless they are also a full-admin role.

Verification:

- `pnpm --filter @oasis/domain test -- clubs.test.ts rbac.test.ts` - pass, ran
  all domain tests because of package-script argument handling: 12 files / 145
  tests.
- `pnpm --filter @oasis/api test -- club.router.test.ts rota.router.test.ts behaviour.router.test.ts pace.router.test.ts notice.router.test.ts childNotes.router.test.ts` -
  pass, ran all API tests because of package-script argument handling: 18 files
  / 351 tests.
- `pnpm --filter @oasis/api typecheck` - pass.
- `pnpm --filter @oasis/web typecheck` - pass.
- `pnpm exec prettier --check ...` for changed files - pass after formatting
  changed API tests.
- `pnpm lint` - pass.
- `pnpm --filter @oasis/web build` - pass when rerun by itself.
- `pnpm --filter @oasis/web test:e2e -- phase-3-5-clubs.spec.ts` - pass with 5
  credential-gated tests skipped because local E2E account variables are not
  configured.
- `graphify update .` - pass.
- `git diff --check` - pass.

Notes:

- The first Playwright run failed in the sandbox because the web server could
  not bind to `0.0.0.0:3000`; it passed after rerunning with approved
  escalation.
- One concurrent build failed while Playwright was also using `.next`; the build
  passed when rerun in isolation.

## Previous status - PR-3.5.2 Parent club signup + spouse invite

Working branch: `feat/parent-club-signup`.

**PR scope:** Add linked-child club signup surfaces for Parents, Supervisors,
and full-admin users with linked children, plus one per-family spouse invite
that links the accepted Parent account to the same active children. Club
management remains on `/admin/clubs`.

Changed scope:

- Added `club.linkedChildSignupContext` to return active clubs, the current
  user's active linked children, and per-child signup state.
- Expanded signup and withdraw authorization so Parents and
  child-registration-prompt roles can act only for linked children, while
  preserving full-admin correction access for any active student through the
  existing direct API.
- Added `/parent/clubs`, `/supervisor/clubs`, and `/admin/my-clubs` using a
  reusable `LinkedChildClubSignupClient`; Paddle is surfaced as a normal active
  club record, not hard-coded.
- Added parent, supervisor, and admin-shell navigation entries for the signup
  pages while keeping `/admin/clubs` as the club management surface.
- Added spouse invite status and invite APIs on `profile`, with a Prisma
  migration for invite-origin guardian metadata.
- Enforced one spouse invite per family across the inviting adult's active
  linked child IDs, blocking existing linked Parent guardians, pending spouse
  invitations, and existing user emails.
- Updated Clerk invitation acceptance to create the accepted Parent user's
  guardian links for the invited child IDs so they bypass initial registration
  after sign-in.
- Added the spouse invite panel to the self-profile account surface when the
  user has linked children.
- Regenerated the component relationship map and graphify knowledge graph.

Verification:

- `pnpm --filter @oasis/db generate` - pass.
- `pnpm with-env pnpm --filter @oasis/db exec prisma validate` - pass.
- `pnpm --filter @oasis/db typecheck` - pass.
- `pnpm --filter @oasis/domain test -- rbac.test.ts clubs.test.ts` - pass, ran
  all domain tests because of package-script argument handling: 12 files / 145
  tests.
- `pnpm --filter @oasis/api test -- club.router.test.ts profile.router.test.ts clerkWebhook.test.ts admin.router.test.ts` -
  pass, ran all API tests because of package-script argument handling: 18 files
  / 347 tests.
- `pnpm --filter @oasis/api typecheck` - pass.
- `pnpm --filter @oasis/web typecheck` - pass.
- `pnpm --filter @oasis/web test:e2e -- phase-3-5-clubs.spec.ts` - pass with 5
  credential-gated tests skipped because local E2E account variables are not
  configured.
- `pnpm lint` - pass.
- `pnpm --filter @oasis/web build` - pass.
- `graphify update .` - pass.
- `pnpm docs:component-map` - pass.
- `git diff --check` - pass.

Notes:

- The Playwright command initially failed in the sandbox because the web server
  could not bind to `0.0.0.0:3000`; it passed after being rerun with approved
  escalation.
- No payments, attendance, waitlists, document uploads, or notification
  composer work was included in this PR scope.

## Previous status - Web responsive side menu

Working branch: `fix/web-responsive-menu`.

**PR scope:** Add a web-only small-screen side menu to the Admin, Parent, and
Supervisor portal shells so phone-width browser users can reach every visible
page while leaving the native mobile app untouched.

Changed scope:

- Added a shared `MobileSideMenu` client component with a hamburger trigger,
  dialog semantics, focus management, Escape/backdrop close handling, link-close
  behaviour, and body scroll lock while open.
- Reused `AdminSidebarNav`, `ParentSidebarNav`, and `SupervisorSidebarNav` in
  the drawer so permissions, active states, unread badges, and disabled states
  stay in one source of truth.
- Tightened the mobile web header at small widths and added accessible labels
  for icon-only profile/logout controls.
- Collapsed the Behaviour Log layout on small screens, stacked section headers
  and filters, converted shared `DataTable` rows into labelled mobile cards
  below phone widths, and removed mobile-only button minimum widths that caused
  horizontal overflow.
- Adjusted the Snapshot overview mobile layout so tabs render as a stable
  segmented control, stat cards drop from four columns to two at the mobile
  shell breakpoint, and the attendance card gets enough width before stacking
  on very narrow phones.
- Added a slide/fade animation to the mobile side drawer while preserving the
  existing reduced-motion override.
- Added credential-gated Playwright coverage for Admin, Parent, and Supervisor
  drawer navigation.
- Added `apps/web/src/components/navigation/` to the generated component map
  ownership source and regenerated the architecture map.

Verification:

- `pnpm --filter @oasis/web lint` - pass.
- `pnpm --filter @oasis/web typecheck` - pass.
- `pnpm exec prettier --check ...` for changed web files - pass.
- `pnpm --filter @oasis/web build` - pass.
- `graphify update .` - pass.
- `pnpm docs:component-map` - pass.
- `pnpm --filter @oasis/web test:e2e -- supervisor-dashboard.spec.ts` - pass:
  2 unauthenticated tests passed, 10 credential-gated tests skipped because
  local E2E account variables are not configured.

Notes:

- Reapplied the responsive-menu stash after pulling current `main`; resolved
  conflicts in the admin shell, generated component map, and project context.
  The admin shell resolution preserves the new ClubsAdmin navigation props.
- No unrelated `docs/phase-3.5-build-plan.md` change is included in this PR.
- No API, database, RBAC, or `apps/mobile` changes were made.

## Previous status - PR-3.5.1 ClubsAdmin club management

Working branch: `feat/phase-3.5-pr3.5.1-clubsadmin-management`.

**PR scope:** Add the web club management surface for Head/full-admin and
ClubsAdmin users on top of the merged PR-3.5.0 club API. Parent club signup UI,
club notifications, mobile clubs smoke, payments, attendance, waitlists, and
calendar sync remain out of scope.

Changed scope:

- Marked PR-3.5.0 merged via PR #96 on 2026-05-11 and set PR-3.5.1 as the
  current Phase 3.5 web work.
- Added `canManageClubs` to the domain RBAC helpers, routed ClubsAdmin users to
  `/admin/clubs` after sign-in, and removed ClubsAdmin from child-registration
  prompt/drill-through eligibility so the role stays clubs-only.
- Added `/admin/clubs` with create, edit, activate/deactivate, club list, and
  roster panels using the existing typed `club` API.
- Updated the admin shell and navigation so ClubsAdmin sees only the clubs
  route and self-profile access, with `/admin/calendar` guarded against
  ClubsAdmin direct access.
- Added focused Playwright coverage for Head management, ClubsAdmin routing,
  and Supervisor/Parent denial, gated by local E2E credentials.
- Added the clubs web component owner to the component relationship map config
  and regenerated the architecture map.

Verification:

- `pnpm --filter @oasis/domain test -- rbac.test.ts clubs.test.ts` - pass, ran
  all domain tests because of package-script argument handling: 12 files / 143
  tests.
- `pnpm --filter @oasis/api test -- club.router.test.ts` - pass, ran all API
  tests because of package-script argument handling: 18 files / 336 tests.
- `pnpm --filter @oasis/web typecheck` - pass.
- `pnpm --filter @oasis/web test:e2e -- phase-3-5-clubs.spec.ts` - pass with 4
  credential-gated tests skipped because local E2E credentials are not
  configured.
- `pnpm lint` - pass.
- `pnpm --filter @oasis/web build` - pass.
- `graphify update .` - pass.
- `pnpm docs:component-map` - pass.
- `git diff --check` - pass.

Notes:

- The implementation was completed in a clean worktree to avoid mixing with the
  existing dirty `fix/web-responsive-menu` branch in the main checkout.
- No schema migration or new dependency was added.

## Previous status - Snapshot supervisor year-band access

Working branch: `fix/snapshot-supervisor-year-band`.

**PR scope:** Limit Snapshot student access so full-admin users retain all
active-student access while Supervisors only see and open students in today's
assigned rota year-group band.

Changed scope:

- Added `childLog.listSnapshotStudents` for the Snapshot picker.
- Reused the mainline `daily-year-band-scope` helper so Snapshot, behaviour,
  attendance, and student list scoping share the same today's-rota band rules.
- Scoped `childLog.snapshot`, `childNotes.create`, and
  `childNotes.listForStudent` so direct API calls cannot bypass the Supervisor
  band boundary.
- Updated the web Snapshot client to use the Snapshot-specific student list.
- Reapplied the stashed Snapshot changes after pulling current `main`; no
  conflict markers or unmerged paths remained, and the implementation was
  adapted to the new mainline scope helper instead of adding a duplicate helper.

Verification:

- `pnpm --filter @oasis/api test -- childNotes.router.test.ts` - pass; package
  argument handling ran all API tests: 18 files / 330 tests.
- `pnpm --filter @oasis/api typecheck` - pass.
- `pnpm --filter @oasis/web typecheck` - pass.
- `pnpm lint` - pass.
- `git diff --check` - pass.
- `graphify update .` - pass.
- `pnpm --filter @oasis/web build` - pass.

Notes:

- Existing untracked `docs/decks/` files remain untouched.
- No schema migration or new dependency was needed.

## Previous status - rota and calendar visibility

Working branch: `feat/rota-calendar-visibility`.

**PR scope:** Allow staff to see the team rota for swap context, make the
calendar readable through existing portal shells, restrict calendar editing to
Head or staff with `calendar-manager`, and let full-admin users maintain their
own rota availability.

Changed scope:

- Added `rota.teamSchedule` for staff-visible active team shifts with decrypted
  staff display metadata and audit logging.
- Moved the signed-in user's weekly availability editor into a shared rota
  component and reused it from Supervisor rota and Admin rota.
- Updated Supervisor rota to show the team week schedule while keeping swap
  requests scoped to the user's own shift and selected candidate shift.
- Changed calendar management policy to Head or staff with
  `calendar-manager`, and made that tag Head-managed.
- Added `calendar.listVisible` for authenticated read-only calendar access with
  existing Parent/Supervisor/All audience targeting preserved.
- Regenerated graphify output and the component relationship map after adding
  the shared rota component surface.

Verification:

- `pnpm --filter @oasis/domain test -- rbac.test.ts` - pass, ran all domain
  tests because of package-script argument handling: 12 files / 139 tests.
- `pnpm --filter @oasis/api test -- calendar.router.test.ts rota.router.test.ts admin.router.test.ts`
  - pass, ran all API tests because of package-script argument handling: 18
    files / 322 tests.
- `pnpm --filter @oasis/api typecheck` - pass.
- `pnpm --filter @oasis/domain typecheck` - pass.
- `pnpm --filter @oasis/web typecheck` - pass.
- `pnpm lint` - pass.
- `pnpm typecheck` - pass on rerun after the parallel web build finished
  generating `.next/types`.
- `pnpm --filter @oasis/web build` - pass.
- `graphify update .` - pass.
- `pnpm docs:component-map` - pass.

Notes:

- Existing untracked `docs/decks/` files remain untouched.
- No schema migration or new dependency was needed.

## Previous status - PR-3.5.0 club management and signups

Working branch: `feat/phase-3.5-pr3.5.0-club-management-signups`.

**PR scope:** Implement the backend-only club management and signup API for
Phase 3.5. Web UI, mobile UI, notifications, payments, attendance, waitlists,
and calendar sync remain out of scope.

Changed scope:

- Marked Phase 3 PR-3.10 merged via PR #95 on 2026-05-11 and set Phase 3.5 /
  PR-3.5.0 as the current work.
- Added a club signup history migration so withdrawn signup rows remain
  historical while a later active re-sign is allowed.
- Replaced the `club` placeholder API for list/create/update/roster/signUp and
  withdraw while leaving `club.notify` deferred to PR-3.5.3.
- Enforced Head/full-admin/ClubsAdmin club management,
  parent/full-admin signup rules, active club/student checks, capacity checks,
  active-signup uniqueness, idempotent authorized withdrawal, and non-PII audit
  rows.

Verification:

- `pnpm --filter @oasis/db generate` - pass.
- `pnpm with-env pnpm --filter @oasis/db exec prisma validate` - pass.
- `pnpm --filter @oasis/api test club.router.test.ts` - pass: 1 file / 25
  tests.
- `pnpm --filter @oasis/domain test -- clubs.test.ts rbac.test.ts` - pass, ran
  all domain tests because of Vitest argument handling: 12 files / 138 tests.
- `pnpm --filter @oasis/api typecheck` - pass.
- `pnpm --filter @oasis/db typecheck` - pass.
- `pnpm lint` - pass.
- `pnpm typecheck` - pass.
- `git diff --check` - pass.
- `graphify update .` - pass.

Notes:

- Existing untracked `docs/decks/` files remain untouched.
- `pnpm --filter @oasis/api test -- club.router.test.ts` ran the full API suite
  because of package-script argument handling; all API tests passed before
  Vitest reported an unrelated Prisma native-engine load error from
  `audit.router.test.ts`.

## Previous status - PR-3.10 Phase 3 verification suite

Merged via PR #95 on 2026-05-11.

Working branch: `test-phase-3-pr3.10-verification-suite`.

**PR scope:** Add focused end-of-phase verification coverage for Phase 3 parent
portal, registration, notices, and messaging. No API, database, schema, route
contract, or production UI changes are in scope.

Note: the originally requested branch name
`test/phase-3-pr3.10-verification-suite` could not be created in this local
checkout before implementation; the replacement branch keeps the same single PR
scope.

Changed scope:

- Mark PR-3.9 merged via PR #92 and record PR #93 as the mobile parent
  messaging redesign follow-up in the Phase 3 plan.
- Added Playwright coverage for parent dashboard or registration state, parent
  registration edit state, parent notice publish/read flow, and parent-Head
  messaging flow.
- Re-ran the Phase 3 API/domain, repo, DB/RLS, encryption, and web build
  verification commands.

Verification:

- `pnpm --filter @oasis/web test:e2e -- phase-3-verification.spec.ts` - pass
  with 4 credential-gated tests skipped because local E2E credentials are not
  configured.
- `pnpm --filter @oasis/api test -- registration.router.test.ts notice.router.test.ts message.router.test.ts childNotes.router.test.ts profile.router.test.ts email.router.test.ts`
  - pass, ran all API tests because of Vitest argument handling: 17 files / 294
    tests.
- `pnpm --filter @oasis/domain test -- registration.test.ts rbac.test.ts users.test.ts`
  - pass, ran all domain tests because of Vitest argument handling: 12 files /
    138 tests.
- `pnpm lint` - pass.
- `pnpm typecheck` - pass.
- `pnpm test` - pass: 17 API files / 294 tests, 4 DB files / 23 tests, and 12
  domain files / 138 tests.
- `pnpm --filter @oasis/web build` - pass.
- `pnpm db:integration` - pass with local environment variables sourced for the
  isolated worktree.
- `pnpm api:smoke-context-rls` - pass with local environment variables sourced
  for the isolated worktree.
- `pnpm verify:encryption` - pass with local environment variables sourced for
  the isolated worktree.
- `graphify update .` - pass.
- `git diff --check` - pass.

Notes:

- Existing untracked `docs/decks/` files remain untouched.
- Carry forward a credentialed Playwright run in an environment with
  `E2E_HEAD_EMAIL`, `E2E_HEAD_PASSWORD`, `E2E_PARENT_EMAIL`, and
  `E2E_PARENT_PASSWORD` configured.

## Previous status - PR-3.9 parent portal mobile smoke

Merged via PR #92 on 2026-05-11. Follow-up PR #93 merged on 2026-05-11 with
the mobile parent messaging redesign.

Working branch: `feat/phase-3-pr3.9-parent-portal-smoke`.

**PR scope:** Add a minimal Expo parent portal smoke path using existing typed
tRPC APIs. Backend APIs, database/schema changes, push notifications, and
production mobile polish remain out of scope.

Changed scope:

- Marked PR-3.8 merged via PR #90 and the follow-up message badge/send fix
  merged via PR #91 in the Phase 3 plan.
- Added a signed-in mobile smoke router that calls `health.me`; Parent users
  see the parent portal smoke screen and non-parent users keep the existing
  Supervisor daily workflow smoke.
- Added a parent smoke screen covering linked child list, selected child
  overview/detail, parent notices with mark-read, and parent message
  thread/read/send/create flows.
- Kept the mobile smoke UI free of domain package runtime imports so Expo Metro
  does not bundle NodeNext `.js` source re-exports from `@oasis/domain`.
- Exported inferred router input/output types from the API router and mobile
  tRPC helper so the new mobile screen can use precise endpoint output types
  without adding mobile dependencies.
- Mapped the new parent mobile communication surface into the component
  relationship map and regenerated graphify output.

Verification:

- `pnpm --filter @oasis/mobile typecheck` - pass.
- `pnpm --filter @oasis/mobile lint` - pass.
- `pnpm --filter @oasis/api typecheck` - pass.
- `graphify update .` - pass.
- `pnpm docs:component-map` - pass.
- `pnpm lint` - pass.
- `pnpm typecheck` - pass.
- `pnpm --filter @oasis/mobile exec expo export --platform ios --output-dir /tmp/oasis-mobile-export`
  - pass.
- `git diff --check` - pass.

Notes:

- Existing untracked `docs/decks/` files remain untouched.
- Manual parent credential smoke was not run in this session.

## Previous status - PR-3.8 parent/admin messaging UI

Merged via PR #90 on 2026-05-09. Follow-up PR #91 merged on 2026-05-10 with
message badge clearing and send-on-enter fixes.

Working branch: `feat/phase-3-pr3.8-messaging-ui`.

**PR scope:** Add parent and admin messaging UI on top of the merged PR-3.7
message thread API, with tagged responder assignment and best-effort Resend
notifications. Attachments, push notifications, and group announcements remain
deferred.

Changed scope:

- Mark PR-3.7 merged via PR #89 in the Phase 3 plan.
- Added the `parent-message-responder` permission tag and kept it Head-managed
  alongside other protected tags.
- Gated parent-message recipients so Head is always eligible and other
  full-admin users require the tag.
- Added `message.listRecipients`, participant display metadata on thread
  outputs, and sender display metadata on thread messages.
- Added best-effort Resend notifications for new portal messages without
  including message body content in email.
- Added `/parent/messages` and `/admin/messages` with shared inbox/thread UI,
  parent new-thread composer, reply composer, and loading/empty/error/pending
  states.
- Guarded `/admin/messages` with the same responder permission used by the API
  and navigation.
- Added parent/admin navigation entries for Messages, unread badges in the nav
  and thread list, and removed the hard-coded admin message badge.
- Added `MessageRead` read receipts with an idempotent migration-backed table;
  opening a thread automatically marks messages from other users as read and
  exposes read state in thread responses.

Verification:

- `pnpm --filter @oasis/domain test -- rbac.test.ts users.test.ts` - pass, ran
  all domain tests because of Vitest argument handling: 12 files / 138 tests.
- `pnpm --filter @oasis/api test -- message.router.test.ts email.router.test.ts`
  - pass, ran all API tests because of Vitest argument handling: 17 files / 294
    tests.
- `pnpm --filter @oasis/api typecheck` - pass.
- `pnpm --filter @oasis/db generate` - pass.
- `pnpm --filter @oasis/db typecheck` - pass.
- `pnpm --filter @oasis/web typecheck` - pass.
- `pnpm lint` - pass.
- `pnpm --filter @oasis/web build` - pass.
- `graphify update .` - pass.
- `pnpm docs:component-map` - pass, updated
  `docs/architecture/component-relationships.md`.
- `git diff --check` - pass.

Notes:

- Existing untracked `docs/decks/` files remain untouched.
- Adds migration `20260509020000_message_read_receipts`.

## Previous status - PR-3.7 parent messaging threads API

Merged via PR #89 on 2026-05-09.

Working branch: `feat/phase-3-pr3.7-parent-messaging-api`.

**PR scope:** Replace the parent messaging placeholder router with audited,
encrypted thread APIs while keeping UI, email notifications, attachments, read
receipts, and group announcements deferred.

Changed scope:

- Implemented `message.listThreads`, `message.openThread`, `message.send`, and
  `message.listInThread` against the existing `MessageThread` and `Message`
  Prisma models.
- Enforced parent-only thread creation, parent-only own-thread access, Head
  global access, and assigned-thread-only access for other full-admin roles.
- Denied Supervisor, ClubsAdmin, TechnicalSupport, and Student access to parent
  messaging unless future policy changes.
- Encrypted message bodies at rest, returned decrypted bodies only from
  `listInThread`, and kept thread summaries free of body decryption.
- Audited thread creation and message sends.
- Marked PR-3.6 merged via PR #83 and the noticeboard follow-up merged via PR
  #84 in the Phase 3 plan, with PR #85 recorded as the merged notice read-race
  fix.

Verification:

- `pnpm --filter @oasis/api test -- message.router.test.ts` - pass, ran all API
  tests because of Vitest argument handling: 17 files / 287 tests.
- `pnpm --filter @oasis/api typecheck` - pass.
- `pnpm lint` - pass.
- `graphify update .` - pass.
- `pnpm docs:component-map` - pass, updated
  `docs/architecture/component-relationships.md`.
- `git diff --check` - pass.

Notes:

- Existing untracked `docs/decks/` files remain untouched.
- No schema migration was required; this uses the existing messaging tables.

## Previous status - Technical Support-only User Access

Working branch: `fix/technical-support-user-access`.

**PR scope:** Make `/admin/access` a Technical Support-only account-shell
workflow while preserving Head role changes in People & Profiles.

Changed scope:

- Narrowed `canManageUserAccounts` / `requireUserAccountAdmin` so only the
  `TechnicalSupport` role can enter User Access or use Technical Support
  account-shell profile/status endpoints.
- Hid `User Access` from full-admin navigation while keeping Technical Support
  post-sign-in routing pointed at `/admin/access`.
- Kept Head role changes in People & Profiles unchanged.
- Kept shared invitation listing, invite, and resend workflows available to full
  admins through a separate guard because People & Profiles uses them outside
  `/admin/access`.

Verification:

- `pnpm --filter @oasis/domain test -- rbac.test.ts` - pass, ran all domain
  tests because of Vitest argument handling: 12 files / 137 tests.
- `pnpm --filter @oasis/api test -- trpc.middleware.test.ts admin.router.test.ts`
  - pass, ran all API tests because of Vitest argument handling: 16 files / 276
    tests.
- `pnpm --filter @oasis/web typecheck` - pass.
- `pnpm lint` - pass.
- `pnpm --filter @oasis/web build` - pass.
- `graphify update /Users/JeanFidele/Projects/oasis-portal` - pass.

Notes:

- Existing untracked `docs/decks/` files remain untouched.
- No product ownership mapping changed, so `pnpm docs:component-map` was not
  rerun.

## Previous status - Parent registration edit and sibling add

Working branch: `feat/parent-registration-edit-siblings`.

**PR scope:** Let parents maintain their submitted registration directly and
quick-add a sibling from an existing registration without adding an admin review
queue, database migration, or unrelated parent portal work.

Changed scope:

- Added parent registration update and sibling-add domain schemas that reuse the
  existing registration field limits, consent rules, date coercion, and six-child
  maximum.
- Added `registration.mine`, `registration.updateMine`, `registration.addSibling`,
  and `registration.addSiblings` with server-side ownership checks against
  `parentRegistration.parentUserId`, encrypted writes, linked-student validation,
  guardian link creation, consent upserts, and audit rows.
- Reused the existing registration form for initial submission, parent edit, and
  parent edit, with parent edit saving official records directly.
- Replaced the separate add-sibling route with a focused modal that captures only
  new child details, supports adding multiple siblings before saving, and saves
  the batch in one mutation.
- Added `/parent/registration`, wired active parent sidebar and mobile bottom
  navigation, and added dashboard shortcuts for editing registration details and
  adding siblings.
- Regenerated graphify and the component relationship map for the expanded
  registration API/UI surface.

Verification:

- `pnpm --filter @oasis/domain test -- registration.test.ts` - pass, ran all
  domain tests because of Vitest argument handling: 12 files / 137 tests.
- `pnpm --filter @oasis/api test -- registration.router.test.ts` - pass, ran all
  API tests because of Vitest argument handling: 16 files / 276 tests.
- `pnpm --filter @oasis/domain typecheck` - pass.
- `pnpm --filter @oasis/api typecheck` - pass.
- `pnpm --filter @oasis/web typecheck` - pass.
- `pnpm lint` - pass.
- `pnpm --filter @oasis/web build` - pass.
- `graphify update .` - pass.
- `pnpm docs:component-map` - pass.
- `git diff --check` - pass.

Notes:

- Existing untracked `docs/decks/` files remain untouched.
- No schema migration was required; this extends the existing parent
  registration tables and relationships.

## Previous status - Shared portal calendar

Working branch: `feat/shared-calendar`.

**PR scope:** Add a shared key-dates calendar across current web portals.
Full-admin users and Supervisor staff with the `calendar-manager` tag can manage
dates. Parents and supervisors can read dates scoped to their audience. Mobile
and a dedicated student portal remain out of scope.

Changed scope:

- Added `calendar-manager` as a permission tag and `canManageCalendar` as the
  domain helper for calendar write access.
- Added `CalendarEvent` and `CalendarEventAudience` to Prisma with encrypted
  optional descriptions, date-only start/end fields, active archive state, and
  creator/audit ownership.
- Added `calendar` tRPC procedures for admin management, parent reads,
  supervisor reads, create, update, and archive.
- Added `/admin/calendar`, `/supervisor/calendar`, and `/parent/calendar` using
  a shared calendar UI split into small model/card/controller modules.
- Added a default month-grid calendar view above the supporting list so the
  calendar surface renders even when there are no dates yet.
- Wired calendar navigation into admin, supervisor, and parent shells.
- Updated the component relationship map ownership for the new router and
  calendar component surface.

Verification:

- `pnpm --filter @oasis/db generate` - pass.
- `pnpm --filter @oasis/domain test -- rbac.test.ts` - pass, ran all domain
  tests because of Vitest argument handling: 12 files / 132 tests.
- `pnpm --filter @oasis/api test -- calendar.router.test.ts` - pass, ran all API
  tests because of Vitest argument handling: 16 files / 266 tests.
- `pnpm --filter @oasis/domain typecheck` - pass.
- `pnpm --filter @oasis/api typecheck` - pass.
- `pnpm --filter @oasis/web typecheck` - pass.
- `pnpm --filter @oasis/db typecheck` - pass.
- `pnpm with-env pnpm --filter @oasis/db exec prisma validate` - pass.
- `pnpm lint` - pass.
- `pnpm --filter @oasis/web build` - pass.
- `graphify update .` - pass.
- Follow-up month-grid verification: `pnpm --filter @oasis/web typecheck` -
  pass; `pnpm lint` - pass; `pnpm --filter @oasis/web build` - pass;
  `graphify update .` - pass.
- `pnpm docs:component-map` - pass after graph refresh.
- `git diff --check` - pass.

Notes:

- The Prisma migration file was created but not applied to any configured
  database in this session to avoid mutating an unknown target database.
- Existing untracked `docs/decks/` files remain untouched.

## Previous status - PR-3.6 noticeboard UI

Working branch: `feat/phase-3-pr3.6-noticeboard-follow-up`.

**PR scope:** Implement the noticeboard web UI for full-admin, Supervisor, and
Parent users. Full-admin users can post notices to supervisors, parents, or both.
Parent messaging, read-count analytics, attachments, editing, and deletion remain
out of scope.

Changed scope:

- Marked PR-3.4 merged via PR #81 and PR-3.5 merged via PR #82 in the Phase 3
  build plan.
- Added `/admin/noticeboard` for full-admin users with a notice composer,
  required title/body validation, optional expiry, pending state, success/error
  feedback, and active notice list.
- Added `/supervisor/noticeboard` for staff readers with active notice list,
  read/unread state, mark-read action, loading, empty, and error states.
- Added `/parent/noticeboard` for parent readers with active parent/both notices,
  read/unread state, mark-read action, and parent navigation unread badge.
- Added notice audience targeting to the notice API and Prisma model:
  `Supervisors`, `Parents`, or `Both`, with existing notices defaulting to
  `Supervisors`.
- Wired admin, supervisor, and parent navigation to the noticeboard routes.
- Replaced the Supervisor dashboard placeholder notice adapter with live
  `notice.listForStaff` summaries and a link to the full noticeboard.
- Added credential-gated Playwright coverage for full-admin publishing,
  parent notice publishing, Supervisor/Parent noticeboard read persistence, and
  non-staff denial.
- Added a Supervisor Noticeboard navigation badge that counts active unread
  notices for the current supervisor.
- Changed authored notices so the author does not mark their own notice as
  read; authored notices now show a recipient read summary with read/unread
  recipient detail for the selected audience.
- Updated `pnpm dev:watch` so nodemon runs the web dev server directly instead
  of wrapping Turbo, preventing orphaned Next listeners during restarts.
- Regenerated the component relationship map for the expanded noticeboard
  surface.

Verification:

- `pnpm db:generate` - pass.
- `pnpm db:migrate` - pass after starting the local Docker Postgres container
  and rerunning with local DB access; 11 migrations found and RLS reapplied.
- `pnpm --filter @oasis/api test -- notice.router.test.ts` - pass, ran 15 API
  test files / 254 tests because of the repo's Vitest argument handling.
- `pnpm --filter @oasis/web typecheck` - pass.
- `pnpm lint` - pass.
- `pnpm --filter @oasis/web build` - pass after stopping stale local Next dev
  servers that were writing `.next`.
- Local API debug as the notice author - pass; authored notice returns `read:
true`, `readAt: null`, and recipient read summary.
- `pnpm dev:watch` smoke - pass; starts a single Next server on
  `http://localhost:3000` and remains running after idle check.
- `pnpm --filter @oasis/web test:e2e -- supervisor-dashboard.spec.ts` - pass
  after sandbox escalation for the local Next.js server; 2 passed, 7
  credential-gated tests skipped.
- `graphify update .` - pass.
- `pnpm docs:component-map` - pass.
- `git diff --check` - pass.

Notes:

- Existing untracked `docs/decks/` files remain untouched.
- PR-3.4 is merged via PR #81 on 2026-05-08.
- PR-3.5 is merged via PR #82 on 2026-05-08.
- PR #83 merged the base staff noticeboard UI; this follow-up branch carries the
  unread badge, badge refresh, parent noticeboard, and audience-targeting work.

## Previous status - PR-3.5 staff notices API

Working branch: `feat/phase-3-pr3.5-staff-notices`.

**PR scope:** Implement the backend-only staff notice API with encrypted bodies,
active/expiry filtering, read receipts, RBAC, and audit rows without starting
PR-3.6 web noticeboard UI, parent messaging, mobile smoke, clubs, shop, or
Phase 4 merit-wallet work.

Changed scope:

- Added `StaffNotice.active` and `StaffNotice.expiresAt` with a Prisma
  migration and index for active/expiry/newest-first listing.
- Implemented `notice.post`, `notice.listForStaff`, and `notice.markRead`.
- Restricted posting to full-admin roles and reading/mark-read to full-admin or
  Supervisor users.
- Encrypted notice bodies in `bodyEnc`, filtered inactive/expired notices, and
  made read receipts idempotent per user/notice.
- Added focused API coverage for posting, RBAC denial, encrypted storage,
  active/expiry filtering, read state, idempotent read receipts, and audit rows.
- Updated the Phase 3 build plan to mark PR-3.5 ready for review.

Verification:

- `pnpm db:generate` - pass.
- `pnpm --filter @oasis/api test -- notice.router.test.ts` - pass, ran 15 API
  test files / 242 tests because of the repo's Vitest argument handling.
- `pnpm --filter @oasis/api typecheck` - pass.
- `pnpm --filter @oasis/web typecheck` - pass.
- `pnpm lint` - pass.
- `pnpm typecheck` - pass.
- `graphify update .` - pass.
- `pnpm docs:component-map` - pass.
- `git diff --check` - pass.

Notes:

- Existing untracked `docs/decks/` files remain untouched.
- PR-3.6 web noticeboard UI remains planned and can consume the new notice API.

## Previous status - Phase 3.4 parent dashboard polish

Working branch: `feat/phase-3-pr3.4-parent-dashboard-polish`.

**PR scope:** Replace the basic parent landing page with an intentional parent
dashboard and add a focused linked-child dashboard read model without starting
notices, messaging, mobile smoke, clubs, shop, or Phase 4 merit-wallet work.

Changed scope:

- Added `childLog.parentDashboard` for linked active child summaries, recent
  attendance, recent General behaviour, visible notes, PACE progress, and
  merit balances.
- Added API coverage for linked parent dashboard data, unlinked parent empty
  state, unsupported user denial, and exclusion of Sensitive behaviour/notes.
- Replaced `/parent` with a dashboard based on the Oasis design reference,
  reusing existing parent shell, profile, registration status, child drill-through
  links, and shared UI primitives.
- Updated the Phase 3 build plan to mark PR-3.4 ready for review.

Verification:

- `pnpm --filter @oasis/api test -- childNotes.router.test.ts profile.router.test.ts registration.router.test.ts` -
  pass.
- `pnpm --filter @oasis/api typecheck` - pass.
- `pnpm --filter @oasis/web typecheck` - pass.
- `pnpm lint` - pass.
- `pnpm --filter @oasis/web build` - pass.
- Browser verification on `http://localhost:3002/parent` - pass for desktop
  rendering with the local authenticated linked-child account.

Notes:

- Existing untracked `docs/decks/` files remain untouched.
- Mobile viewport switching was attempted in the in-app browser, but the active
  browser API did not expose `setViewportSize`; responsive CSS was added and
  verified through typecheck/build.

## Previous status - Component relationship map and agent PR workflow

Working branch: `docs/component-relationship-map`.

**PR scope:** Add a graphify-backed product module relationship map and update
agent workflow rules so every PR checks module context before work starts and
refreshes the map when product ownership changes.

Changed scope:

- Added `docs/architecture/component-relationships.md` as the human-readable
  product module map with anti-duplication rules.
- Added `scripts/generate-component-map.mjs` and `pnpm docs:component-map` to
  regenerate module evidence from `graphify-out/graph.json`.
- Updated local ignored agent rule files `AGENTS.md` and `CLAUDE.md` so agents
  read the component map and run a graphify query at PR start, then check
  whether `PRODUCT_MODULES` and the generated map need refreshing before PR
  completion.

Verification:

- `pnpm docs:component-map` - pass.
- `graphify update .` - pass.
- `graphify check-update .` - pass.
- `node --check scripts/generate-component-map.mjs` - pass.
- `pnpm exec prettier --check AGENTS.md CLAUDE.md docs/architecture/component-relationships.md scripts/generate-component-map.mjs package.json` -
  pass.
- `pnpm lint` - pass.
- `graphify query "component relationship map PR start PR finish update PRODUCT_MODULES docs component map" --budget 1500` -
  pass.
- `git diff --check` - pass.

Notes:

- `AGENTS.md` and `CLAUDE.md` are intentionally ignored by `.gitignore`, so the
  local agent rules are updated but will not appear in a normal PR unless the
  ignore policy changes or they are force-added intentionally.
- Existing untracked `docs/decks/` files remain untouched.

## Previous status - Production client component serialization hotfix

Working branch: `fix/remove-client-function-prop`.

**PR scope:** Fix the production Next.js Server Component serialization error
caused by passing a `detailPathFor` function from admin/supervisor children
server pages into the client `ParentChildrenList` component.

Changed scope:

- Replaced `ParentChildrenList` function props with a serializable
  `variant` prop.
- Moved role-specific child detail route prefixes and empty-state copy into the
  client component config.
- Updated admin and supervisor children pages to pass only string variants.

Verification:

- `rg -n "detailPathFor" apps/web/src` - pass, no matches.
- `pnpm --filter @oasis/web lint` - pass.
- `pnpm --filter @oasis/web typecheck` - pass.
- `pnpm --filter @oasis/web build` - pass.
- `pnpm exec prettier --check 'apps/web/src/app/(parent)/parent/parent-children-list.tsx' 'apps/web/src/app/(admin)/admin/children/page.tsx' 'apps/web/src/app/(supervisor)/supervisor/children/page.tsx'` -
  pass.
- `git diff --check` - pass.
- `graphify update .` - pass, no tracked graph output changed.

Notes:

- GitHub deployment metadata only exposed older Vercel bot records, so the
  current production SHA was not reliable from that source. The failing
  `detailPathFor` server-to-client function prop was confirmed on local
  `main` before branching.
- Existing untracked `docs/decks/` files remain untouched.

## Previous status - Production Technical Support access fix

Working branch: `fix/prod-technical-support-access`.

**PR scope:** Fix production Clerk webhook identity sync so an existing local
Technical Support account can be linked to the signed-in Clerk user and routed
to User Access.

Changed scope:

- Updated the Clerk webhook user store to look up an existing local user by
  encrypted email blind index when no user is found by Clerk id.
- Linked that existing local account to the Clerk id while preserving
  admin-managed role and permission tags.
- Added regression coverage for the email-match linking path so Technical
  Support accounts do not fall through to the not-ready state when production
  already has a local user row for the email.

Verification:

- `pnpm --filter @oasis/api test -- clerkWebhook.test.ts` - pass, 219 tests
  across the API suite.
- `pnpm --filter @oasis/api typecheck` - pass.
- `pnpm --filter @oasis/api lint` - pass.
- `pnpm --filter @oasis/web typecheck` - pass.
- `pnpm exec prettier --write apps/api/src/routers/clerkWebhook.ts apps/api/src/__tests__/clerkWebhook.test.ts` -
  pass.
- `graphify update .` - pass.

Notes:

- Existing untracked `docs/decks/` files remain untouched.
- If the production Clerk webhook already failed before this fix, replay the
  affected Clerk `user.created`/`user.updated` event or trigger a Clerk user
  update after deployment so the local `User.clerkId` is linked.

## Previous status - PR-2.5.7 Phase 2.5 access and export verification

Working branch: `test-phase-2.5-pr2.5.7-access-export-verification`.

**PR scope:** Add verification coverage for Phase 2.5 People & Profiles,
lifecycle, attendance export, audit, RLS, and encryption behavior without
changing public APIs, schemas, routes, or UI behavior.

Changed scope:

- Added API coverage for attendance export invalid ranges, selected-student and
  selected-staff denied-call audit metadata, selector denial for Supervisor,
  Parent, and Student callers, and selected archived/inactive export rows.
- Added lifecycle/access API coverage for People & Profiles full-admin-only
  access, account deactivation/reactivation audit metadata, full-admin
  self-deactivation denial, and archived student list/detail reads.
- Added credential-gated Playwright coverage for People & Profiles attendance
  tab boundaries and attendance export control visibility.
- Marked PR-2.5.6 merged and PR-2.5.7 ready for review in the Phase 2.5 plan.

Verification:

- `pnpm --filter @oasis/api test -- attendance.router.test.ts admin.router.test.ts student.router.test.ts` -
  pass, 218 tests.
- `pnpm --filter @oasis/web test:e2e` - pass after sandbox escalation for the
  local Next.js server; 2 passed, 13 credential-gated tests skipped.
- `pnpm lint` - pass.
- `pnpm typecheck` - pass.
- `pnpm test` - pass.
- `pnpm --filter @oasis/web build` - pass.
- `pnpm db:integration` - pass after sandbox escalation for `tsx` IPC/database
  access.
- `pnpm api:smoke-context-rls` - pass after sandbox escalation for `tsx`
  IPC/database access.
- `pnpm verify:encryption` - pass after sandbox escalation for `tsx`
  IPC/database dump access.

Notes:

- Existing untracked `docs/decks/` files remain untouched.
- The requested `test/phase-2.5-pr2.5.7-access-export-verification` branch name
  could not be created because local Git refs block the `test/` namespace, so
  this work uses `test-phase-2.5-pr2.5.7-access-export-verification`.
- Credentialed Playwright verification requires the relevant `E2E_*`
  credentials; unauthenticated checks passed locally.

## Previous status - PR-2.5.6 individual attendance history

Working branch: `feat/phase-2.5-pr2.5.6-individual-attendance-history`.

**PR scope:** Add individual student and staff attendance history to People &
Profiles, reusing the PR-2.5.5 scoped CSV export contracts and keeping parent
profile surfaces unchanged.

Changed scope:

- Added `attendance.studentHistory` and `attendance.staffHistory` tRPC queries
  with date-range validation and `canExportAttendance` enforcement.
- Kept archived student and inactive staff historical attendance queryable for
  export-authorised users.
- Added Attendance tabs to student and supervisor/staff profiles with date
  filters, empty states, refresh controls, and scoped CSV export actions.
- Clarified the history UI so filters are labelled as attendance-date filters
  and the recorded timestamp is shown as the entry date.
- Changed the initial attendance history range to today-to-today so first load
  does not show the previous 30 days before a user widens the range.
- Kept parent profiles free of attendance history and export controls.
- Marked PR-2.5.5 merged and PR-2.5.6 ready for review in the Phase 2.5 plan.

Verification:

- `pnpm --filter @oasis/api test -- attendance.router.test.ts` - pass, 210
  tests.
- `pnpm --filter @oasis/api typecheck` - pass.
- `pnpm --filter @oasis/web typecheck` - pass.
- `pnpm lint` - pass.
- `pnpm --filter @oasis/web build` - pass.
- `graphify update .` - pass.
- `pnpm typecheck` - pass.

Notes:

- Existing untracked `docs/decks/` files remain untouched.

## Current status - PR-2.12 mobile supervisor workflow smoke

Working branch: `feat/phase-2-pr2.12-mobile-supervisor-smoke`.

**PR scope:** Add the thin Phase 2 mobile smoke for Supervisor daily workflows
without changing existing tRPC procedure contracts or adding mobile polish
outside rota, attendance, behaviour, and PACE verification.

Changed scope:

- Added Clerk bearer-token resolution for mobile tRPC requests after the
  existing web Clerk session path.
- Wired the Expo app with React Query, superjson, and the typed tRPC client
  using `EXPO_PUBLIC_TRPC_URL`.
- Replaced the Phase 0 mobile placeholder with a focused Supervisor smoke
  screen for session check, rota, attendance, behaviour, and PACE workflows.
- Added a plain MFA step to the smoke sign-in form for Clerk accounts that
  return `needs_second_factor`.
- Added a Clerk Expo Google SSO entry to the mobile smoke login and a callback
  route for the SSO redirect path.
- Reworked the mobile smoke UI primitives and supervisor screen against
  `design/Oasis Learning Center.zip`, using the Oasis logo asset, colour
  tokens, card/input/button proportions, badges, and dashboard stat patterns.
- Added documented manual smoke steps for emulator/device verification.
- Adjusted the mobile Metro resolver for pnpm by allowing package export maps
  and adding the Babel runtime dependency Metro expects when bundling app code.
- Pinned Clerk/Expo optional native peers to Expo SDK 52-compatible versions so
  Expo Go does not load SDK 55 JavaScript expecting unavailable native modules
  such as `ExpoCryptoAES`.
- Mobile Expo scripts now run through the repo env loader so root `.env.local`
  values such as `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` are visible from
  `apps/mobile`.

Verification:

- `pnpm --filter @oasis/mobile typecheck` - pass.
- `pnpm --filter @oasis/mobile lint` - pass.
- `pnpm --filter @oasis/api typecheck` - pass.
- `pnpm --filter @oasis/api lint` - pass.
- `pnpm --filter @oasis/api test` - pass, 199 tests.
- `pnpm --filter @oasis/web typecheck` - pass.
- `pnpm --filter @oasis/web lint` - pass.
- `pnpm --filter @oasis/mobile exec expo install --check` - pass using the
  local SDK 52 dependency map while offline.
- `pnpm --filter @oasis/mobile exec node ../../scripts/with-env.mjs expo export --platform ios --output-dir /tmp/oasis-mobile-ios-export` -
  pass.
- Targeted Prettier check for changed files - pass.
- `git diff --check` - pass.
- `graphify update .` - pass.

Notes:

- Existing untracked `docs/decks/` files remain untouched.
- Manual mobile verification requires a reachable web tRPC URL and a Supervisor
  smoke account; attendance marking requires Head access or the
  `attendance-recorder` tag.

## Current status - Inline diagnostics and favicon cleanup

Working branch: `codex/fix-inline-errors-favicon`.

**PR scope:** Remove fragile strict TypeScript/ESLint inline patterns, keep the
tRPC client type source resolvable across web/mobile, and wire the Oasis SVG
logo as the web favicon with a white background.

Changed scope:

- Added typed academic school-year option helpers so the settings panel no
  longer calls `displaySchoolYearLabel` directly, band rendering no longer
  passes it as an array callback, and edit state no longer asserts API
  `standardYears` as `StandardSchoolYear[]`.
- Replaced academic `RouterOutputs` aliases with explicit local row types so
  editor fallback inference cannot collapse `Subject` or `YearGroupBand` to
  `any`.
- Pointed web and mobile tRPC client helpers directly at
  `@oasis/api/router` for `AppRouter`, avoiding editor type fallback through
  the broader API package root.
- Added a web-local flat ESLint config that delegates to the root config and
  loads Next rules for web files, so editors opened from `apps/web` use the
  same typed lint path as repo-level checks.
- Made the pending invitation resend mutation context type explicit at the
  failing hook call site, avoiding editor fallback on the assignment line.
- Tightened agent/build guidance and the shared ESLint config so explicit
  `any` is forbidden in tests as well as application code.
- Added `apps/web/public/oasis-favicon.svg`, derived from the existing Oasis
  SVG logo with a white background.
- Updated root Next metadata to advertise the SVG favicon.

Verification:

- `pnpm turbo run lint --force` - pass.
- `pnpm turbo run typecheck --force` - pass.
- `pnpm --filter @oasis/web build` - pass; Next still emits its plugin
  detector warning even though `eslint --print-config` shows `@next/next`
  rules loaded from the web flat config.
- `pnpm exec eslint 'apps/web/src/app/(admin)/admin/_components/pending-invite-resend-action.tsx'` -
  pass.
- `cd apps/web && pnpm exec eslint 'src/app/(admin)/admin/_components/pending-invite-resend-action.tsx'` -
  pass.
- `pnpm exec eslint apps/web/src/lib/trpc.ts apps/mobile/src/lib/trpc.ts` -
  pass.
- `pnpm exec tsc --noEmit --project apps/web/tsconfig.json` - pass.
- `pnpm exec prettier --check AGENTS.md PROJECT_Oasis_Context.md packages/config/eslint.config.js apps/web/src/lib/trpc.ts apps/mobile/src/lib/trpc.ts 'apps/web/src/app/(admin)/admin/academic/_components/academic-panels.tsx' 'apps/web/src/app/(admin)/admin/academic/_components/school-year-options.ts' 'apps/web/src/app/(admin)/admin/academic/academic-settings-client.tsx' apps/web/src/app/layout.tsx` -
  pass.
- `pnpm exec prettier --parser html --check apps/web/public/oasis-favicon.svg` - pass.
- Explicit `any` type syntax audit across `apps`, `packages`, and `scripts` -
  pass; no matches in TS/TSX/JS sources.
- SVG XML/content validation - pass.
- `graphify update .` - pass.
- `git diff --check` - pass.

Notes:

- Existing untracked `docs/decks/` files were left untouched.
- No raster favicon fallback was added.

## Previous status - Post-sign-in auth handoff

Working branch: `fix/post-sign-in-handoff`.

**PR scope:** Stabilise the Clerk-to-Oasis post-sign-in handoff so fresh
sessions route through a public client landing page before server-side
role resolution.

Changed scope:

- Changed `/post-sign-in` into a public client handoff page that waits for
  Clerk client auth to load, then performs a full document navigation.
- Added `/post-sign-in/resolve` as the server-side resolver using Clerk
  `auth()`, API context creation, and the shared role portal selector.
- Removed `/post-sign-in(.*)` from the protected middleware matcher so the
  handoff page is not pre-empted before Clerk cookies settle.
- Added shared post-sign-in portal selection coverage for full admins,
  account admins, Supervisors, Parents, not-ready local users, and missing
  local users.
- Tightened admin route guards so expected access denials still become
  `notFound()`, while unexpected auth/database failures bubble instead of
  becoming fake 404s.
- Updated stale Playwright password-field selectors to avoid Clerk's
  "Show password" button.
- Added web `predev`/`prebuild` Prisma generation so cached generated clients
  cannot keep querying removed columns such as `Student.archivedAt`.
- Updated production `APP_URL` in Vercel and local ignored
  `.env.production` to `https://www.oasisportal.space`.

Verification:

- `pnpm --filter @oasis/web typecheck` - pass.
- `pnpm --filter @oasis/web lint` - pass.
- `pnpm --filter @oasis/web build` - pass.
- `pnpm --filter @oasis/domain typecheck` - pass.
- `pnpm --filter @oasis/domain test` - pass, 121/121 tests passing.
- `pnpm --filter @oasis/web test:e2e -- supervisor-dashboard.spec.ts -g "unauthenticated post-sign-in"` - pass, 2 passed and 5 credentialed tests skipped.
- Generated-client/bundle check for `archivedAt` - pass; no occurrences remain
  in the regenerated Prisma client or latest Next build output.
- `git diff --check` - pass.
- `graphify update .` - pass.

Notes:

- Vercel production `APP_URL` is verified as
  `https://www.oasisportal.space`; Vercel applies env changes to new
  deployments, so the production deployment after this branch lands is still
  required before functions use the new value.
- Existing pending Clerk invitations still need to be resent after deploy so
  recipients receive fresh invite URLs with the canonical host and
  `/post-sign-in` redirect.
- Authenticated production browser smoke was not completed in this session
  because the code is not deployed yet and the available real sign-in flow is
  2FA-gated.

## Previous status - Admin lifecycle UI

Working branch: `feat/admin-lifecycle-ui`.

**PR scope:** Add guarded UI controls for account deactivation/reactivation and
student archive/restore while preserving records and audit history.

Changed scope:

- Added a reusable admin confirmation dialog for lifecycle actions.
- Added confirmation-gated account deactivation/reactivation in User Access and
  People & Profiles, with self-deactivation still blocked.
- Changed People & Profiles user listing to include inactive accounts so they
  can be reactivated.
- Replaced the ambiguous student `Active` checkbox with explicit Archive
  student and Restore student actions on the student edit view.
- Added Head-only Active, Archived, and All filters to the Students directory,
  while non-managing users continue to see active accessible students only.
- Updated student/profile labels so archived students are presented as
  Archived rather than Inactive.

Verification:

- `pnpm --filter @oasis/web typecheck` - pass.
- `pnpm --filter @oasis/web lint` - pass.
- `pnpm --filter @oasis/web build` - pass.
- `pnpm --filter @oasis/api test` - pass, 185/185 tests passing.
- `graphify update .` - pass.
- Browser smoke check at `http://localhost:3002/admin/students` - pass; route
  redirected to Clerk sign-in as expected with no console errors or Next.js
  overlay.

Notes:

- User delete remains a soft access deactivation. No Clerk or database hard
  delete was added.
- Student archive remains `Student.active = false`; restore sets it back to
  `true`.

## Previous status - Invite post-signup routing fix

Working branch: `fix/invite-post-sign-in-redirect`.

**PR scope:** Ensure Clerk invitation acceptance always hands users to the
role-aware `/post-sign-in` router so Parents land on `/parent`, Supervisors
land on `/supervisor`, and Head/full-admin users land on `/admin`.

Changed scope:

- Added a server-owned canonical invitation redirect built from `APP_URL` and
  `/post-sign-in`; admin invite callers can no longer provide custom redirect
  URLs.
- Changed resend/retry handling so existing pending Clerk invitations are
  replaced before delivery, ensuring older pending links are regenerated with
  the canonical post-sign-in route.
- Updated `/` so authenticated users who land on the home page are immediately
  sent through `/post-sign-in`.
- Removed the optional Redirect URL controls from both staff and access invite
  forms.
- Tightened invite input validation and updated focused tests for the canonical
  redirect behavior.

Verification:

- `pnpm --filter @oasis/domain test -- users.test.ts` - pass; Vitest ran the
  domain suite with 116/116 tests passing.
- `pnpm --filter @oasis/api test -- admin.router.test.ts` - pass; Vitest ran
  the API suite with 185/185 tests passing.
- `pnpm --filter @oasis/api typecheck` - pass.
- `pnpm --filter @oasis/api lint` - pass.
- `pnpm --filter @oasis/web typecheck` - pass.
- `pnpm --filter @oasis/web lint` - pass.
- `pnpm build` - pass.
- `graphify update .` - pass.
- `git diff --check` - pass.

Notes:

- Production must keep `APP_URL` configured as the portal origin, for example
  `https://oasisportal.space`, because new Clerk invitations now require it to
  create the post-sign-in redirect.
- Existing pending invite emails should be resent so recipients receive a fresh
  Clerk link with the canonical redirect.

## Previous status - Invite resend sender normalisation

Working branch: `fix/invite-email-diagnostics`.

**PR scope:** Fix production invite resend failures caused by a quoted
`RESEND_FROM` value in Vercel while preserving the diagnostics added for the
same incident.

Changed scope:

- Root cause confirmed from production diagnostics:
  `Invalid from field. The email address needs to follow the email@example.com
or Name <email@example.com> format.`
- Added sender normalisation that strips one pair of matching shell-style
  wrapping quotes from `RESEND_FROM` before passing it to Resend. This tolerates
  Vercel values copied from `.env` syntax such as
  `"Oasis Portal <no-reply@oasisportal.space>"`.
- Added email config regression coverage for both double-quoted and
  single-quoted sender env values.

Verification:

- `pnpm --filter @oasis/api test -- email.router.test.ts` - pass; Vitest ran
  the API suite with 185/185 tests passing.
- `pnpm --filter @oasis/api typecheck` - pass.
- `pnpm --filter @oasis/api lint` - pass.
- `pnpm --filter @oasis/api email:smoke` with `.env.production` loaded and a
  deliberately quoted `RESEND_FROM` override - pass; Resend accepted the smoke
  email and returned message id `602f0b2a-aac1-4fa1-9cb2-bf0c1bd76c1d`.
- `pnpm build` - pass.
- `graphify update .` - completed; graphify rebuilt the code graph.

Notes:

- This code fix makes the app resilient to the current Vercel value. The
  operational cleanup is still to edit Vercel `RESEND_FROM` to the unquoted
  value `Oasis Portal <no-reply@oasisportal.space>` when convenient.
- After deployment, retry the pending Supervisor invite; it should now move from
  `Failed` to `Sent` with an `emailMessageId`.

## Previous status - Invite resend diagnostics

Working branch: `fix/invite-email-diagnostics`.

**PR scope:** Add sanitized production diagnostics for failed Resend invite
delivery after the React Email render fix deployed but the admin resend flow
continued returning 500.

Changed scope:

- Confirmed production is now on PR #56
  `fix/invite-email-render-runtime`, deployment
  `dpl_GGHYi8s4VdKx39zXhxosrZGuTgBJ`, commit
  `8729c71cc45488180ff7510e3597570c38c96cc4`.
- Queried recent production invitation/audit state without decrypting or
  printing PII. The pending Supervisor invite remains `emailStatus=Failed`,
  and recent `admin.resendUserInvitation` audit rows show the failure reaches
  the email-delivery catch after Clerk lookup/replacement.
- Added server-side sanitized logging in the invite delivery catch so the next
  production retry logs the underlying email error name/message, invitation id,
  role, source, and Clerk invitation status without logging recipient email or
  invite URL.
- Updated invite failure tests to assert the diagnostic log is emitted and does
  not include the recipient email.

Verification:

- `pnpm --filter @oasis/api test -- admin.router.test.ts` - pass; Vitest ran
  the API suite with 183/183 tests passing.
- `pnpm --filter @oasis/api typecheck` - pass.
- `pnpm --filter @oasis/api lint` - pass.
- `pnpm build` - pass.
- `graphify update .` - completed; graphify rebuilt the code graph.

Notes:

- The diagnostics branch does not change the browser error message or expose
  sensitive details to users. It exists so Vercel runtime logs can reveal
  whether production Resend is rejecting the recipient, sender, API key, domain,
  or account state.
- After this branch is deployed, retry the same pending invite and inspect
  Vercel runtime logs for `Invitation email delivery failed`.

## Previous status - Invite email render/runtime recovery

Working branch: `fix/invite-email-render-runtime`.

**PR scope:** Fix the server-side React Email render path used by Resend
smoke tests, first-time invite delivery, and `admin.resendUserInvitation`.

Changed scope:

- Confirmed production Vercel project `oasis-portal-web` is on deployment
  `dpl_2kCwyCpZuTTzA7rmSJ9Yqbg8Giv3`, PR #55
  `fix/retry-failed-invites`, commit `5cdda7c35f8f84b660e1de4332da0e5ff2b6546a`.
- Confirmed Vercel production/preview has `APP_URL`, `RESEND_API_KEY`, and
  `RESEND_FROM` configured as sensitive env vars.
- Reproduced the production email path failure locally with production env:
  `pnpm --filter @oasis/api email:smoke` failed before reaching Resend with
  `React is not defined`.
- Added explicit runtime React imports to the API email TSX modules so Resend's
  server-side renderer can execute the smoke and invite templates.
- Added a smoke-template render assertion alongside the existing user-invite
  render test.

Verification:

- React Email smoke template render via `@react-email/render` - pass.
- React Email user invite template render via `@react-email/render` - pass.
- `pnpm --filter @oasis/api email:smoke` with `.env.production` loaded - pass;
  Resend accepted the smoke email and returned message id
  `8d61f4b2-4dae-4ef4-b668-23b9232cc2c9`.
- `pnpm --filter @oasis/api test` - pass; 183/183 tests passing.
- `pnpm --filter @oasis/api typecheck` - pass.
- `pnpm --filter @oasis/api lint` - pass.
- `pnpm build` - pass.
- `graphify update .` - completed; graphify rebuilt the code graph.

Notes:

- `_dmarc.oasisportal.space` returned no TXT record during DNS verification.
  SPF, return-path MX, and the likely Resend DKIM record were present. Add the
  runbook DMARC record before judging long-term mailbox placement.
- Local `.env.production` currently uses `APP_URL=https://oasisportal.space`;
  the runbook expects `https://www.oasisportal.space`. This is not the render
  failure, but keep Vercel and local production env consistent.
- Production still needs this branch deployed before admin invite resend can use
  the fixed render path.

## Previous status - Resend user invites and email deliverability hardening

Working branch: `feat/resend-user-invites`.

**PR scope:** Send user invitations through Resend using Clerk-generated links,
persist pending invite rows, and show those pending users in the admin
directories until Clerk acceptance creates the local encrypted `User`.

Changed scope:

- Added `UserInvitation` persistence with encrypted invite email, blind index,
  Clerk invitation id, role/tags, pending/accepted status, email delivery
  status, inviter, accepted user, and supporting indexes.
- Updated `admin.inviteUser` so Clerk generates and stamps the invite with
  `notify: false`, Resend sends the branded button email, duplicate users or
  pending invites are blocked, and audit rows avoid email/link leakage.
- Added `admin.listUserInvitations` with the same role scope as account
  management. Technical Support sees only pending `Parent` and
  `TechnicalSupport` invites.
- Updated the Clerk webhook sync path so matching pending invites become
  `Accepted` once a Clerk-created or updated user exists in the local DB.
- Merged pending invitation rows into `/admin/access` and `/admin/staff`, with
  read-only pending panels and `Pending` badges.
- Simplified invite success UI to confirm email delivery instead of exposing the
  Clerk invite URL in the browser.
- Fixed the directory filter bar so labels wrap instead of being cut off.
- Hardened the Resend sender path after a production test email landed in junk:
  production now requires an explicit sender, bare `no-reply@oasisportal.space`
  normalises to `Oasis Portal <no-reply@oasisportal.space>`, the generic
  hello-world smoke email is now a branded deliverability check, and the invite
  copy no longer names the auth provider.
- Moved Resend message bodies to versioned React Email templates with a shared
  Oasis email shell, role-aware invite copy, text fallbacks, and Resend's
  `react` payload path.
- Added `APP_URL`-based logo URL support so email images use absolute public
  URLs when configured and are omitted when absent.
- Added an email-safe Oasis logo asset under the web public directory.
- Fixed the invite success icon sizing in both access and staff invite forms so
  the check mark fits cleanly inside the existing white status circle.
- Added a deliverability runbook covering Resend verification, DMARC monitoring,
  Gmail/Outlook header checks, Google Postmaster Tools, and recipient junk
  reports.

Verification:

- `pnpm db:generate` - pass.
- `pnpm --filter @oasis/api test` - pass.
- `pnpm --filter @oasis/api test -- email.router.test.ts` - pass; Vitest ran the
  API suite with 172/172 tests passing.
- `pnpm --filter @oasis/api typecheck` - pass.
- `pnpm --filter @oasis/api lint` - pass.
- `pnpm --filter @oasis/web typecheck` - pass.
- `pnpm --filter @oasis/web lint` - pass.
- `pnpm --filter @oasis/db typecheck` - pass.
- `pnpm --filter @oasis/db test` - pass.
- `pnpm lint` - pass.
- `pnpm typecheck` - pass.
- `pnpm --filter @oasis/web build` - pass.
- `HOME=/private/tmp/react-email-home ./node_modules/.bin/email export --dir
src/emails --outDir /private/tmp/oasis-email-out --pretty` from `apps/api` -
  pass; rendered `smoke-test-email.html` and `user-invite-email.html`.
- `git diff --check` - pass.
- `graphify update .` - completed; graphify rebuilt the code graph.

Notes:

- `RESEND_API_KEY` and `RESEND_FROM` must be configured in each environment for
  invites to deliver.
- The Resend API key shown in local `.env.production` was exposed in this
  session. Rotate it in Resend/Vercel before the next production deploy.
- Add `_dmarc.oasisportal.space` TXT `v=DMARC1; p=none;` before retesting
  mailbox placement.
- Run `pnpm --filter @oasis/api email:smoke` only after the Resend key is
  rotated and SPF/DKIM/DMARC checks are confirmed.
- Existing Clerk webhook delivery remains the source of truth for activating the
  local user row.

## Previous status - Technical Support account administration

Working branch: `feat/technical-support-role`.

**PR scope:** Add a Technical Support role for safe account-shell onboarding and
profile administration without exposing student, PACE, attendance, behaviour, or
guardian-link data.

Changed scope:

- Added `TechnicalSupport` to the domain role list and Prisma `Role` enum,
  including a migration that adds the enum value.
- Added account-admin RBAC helpers that keep `TechnicalSupport` separate from
  full-admin and staff access.
- Added safe admin API procedures for account listing, account profile updates,
  activation/deactivation, and restricted invites. Technical Support can manage
  only `Parent` and `TechnicalSupport` account shells and cannot assign
  permission tags.
- Added `/admin/access` with a sanitized account directory, invite form, profile
  editor, and account status controls. The route does not call student, guardian,
  PACE, attendance, or behaviour APIs.
- Updated admin shell access, nav visibility, role labels, and post-sign-in
  routing so Technical Support lands on `/admin/access`.
- Added tests for the Technical Support boundary and updated Next route types
  after adding the route.
- Added a small `EmailEnv` index signature compatibility fix in the existing
  resend email code because it was blocking web/root typecheck.

Verification:

- `pnpm db:generate` - pass.
- `pnpm --filter @oasis/domain test` - pass.
- `pnpm --filter @oasis/api test` - pass.
- `pnpm --filter @oasis/web typecheck` - pass.
- `pnpm --filter @oasis/api typecheck` - pass.
- `pnpm --filter @oasis/domain typecheck` - pass.
- `pnpm lint` - pass.
- `pnpm typecheck` - pass.
- `graphify update .` - completed; graphify rebuilt the code graph.

Notes:

- Jean-Fidele will assign his own account to `TechnicalSupport` manually after
  deployment.
- Existing resend email files were present in the worktree and are outside this
  role-change scope, apart from the type compatibility fix needed for checks.

## Previous status - Production Clerk webhook DB sync fix

Working branch: `fix/auth-post-sign-in-missing-user`.

**PR scope:** Fix production Clerk sign-up handoff and local DB user creation
when Prisma runs through the Supabase transaction pooler.

Changed scope:

- Pulled latest production Vercel logs for deployment
  `dpl_6yXpQUHK6kBrfYX9VyZ2FTG8rDq9`; `/post-sign-in` now fails with Postgres
  `42P05 prepared statement "s0" already exists`, not the previous missing
  Prisma query engine error.
- Added `runtimeDatabaseUrl` in `@oasis/db` so Supabase transaction-pooler URLs
  on port `6543` automatically receive `pgbouncer=true&connection_limit=1`
  before Prisma Client connects.
- Updated `/post-sign-in` so an authenticated Clerk session without a local
  `User` redirects to `/not-ready` instead of bouncing back to `/sign-in/`.
- Updated `/not-ready` copy and action so users can sign out of the current
  Clerk session instead of being pushed straight back into `/post-sign-in`.
- Documented the Supabase pooler/Prisma runtime requirement in `docs/runbook.md`.

Verification:

- `pnpm --filter @oasis/db test -- database-url.test.ts` - pass; Vitest
  currently runs the full db package suite.
- `pnpm --filter @oasis/db typecheck` - pass.
- `pnpm --filter @oasis/api test -- clerkWebhook.test.ts` - pass; Vitest
  currently runs the full api package suite.
- `pnpm --filter @oasis/web lint` - pass.
- `pnpm --filter @oasis/web typecheck` - pass.
- `pnpm exec prettier --check packages/db/src/database-url.ts packages/db/src/__tests__/database-url.test.ts packages/db/src/index.ts apps/web/src/app/post-sign-in/page.tsx apps/web/src/app/not-ready/page.tsx docs/runbook.md PROJECT_Oasis_Context.md` -
  pass after formatting the not-ready page.
- `pnpm --filter @oasis/web build` - pass.
- `git diff --check` - pass.
- `graphify update .` - completed; graphify rebuilt the code graph without
  tracked graph output changes.

Notes:

- After redeploy, replay the failed Clerk `user.created` / `user.updated`
  webhook or create the user again so the local encrypted `User` row is written.
- `apps/web/next-env.d.ts` was already locally modified before this branch work
  and was intentionally left untouched.

## Previous status - Production Prisma runtime packaging fix

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
- 2026-05-16 merit shop reservation workflow: branch
  `feat/merit-shop-reservations` adds parent/student reservations,
  `ShopReserved` ledger holds, pickup collection/cancellation, updated
  parent/admin web shop screens, and mobile parent/student shop flows
  against `design/Oasis Learning Center.zip`.
- 2026-05-16 verification for the merit shop branch: API router tests,
  domain shop/accounting tests, API/web/mobile typecheck, web/mobile lint,
  web production build, `pnpm docs:component-map`, `git diff --check`,
  and `graphify update .` pass locally. Browser smoke verified
  `/admin/shop` on desktop and narrow viewports; `/parent/shop` is present
  but unauthenticated local browser access is blocked by the parent guard.
- 2026-05-16 admin shop visual correction: the admin catalogue was reshaped
  to match the provided shop screenshots with the reference-style table,
  stats, item modal, mobile shop nav entry, and smaller menu icons. Current
  session verification: `pnpm --filter @oasis/web typecheck`,
  `pnpm --filter @oasis/web lint`, `pnpm --filter @oasis/web build`,
  `git diff --check`, and `graphify update .` pass. Browser verification
  reached the Clerk sign-in guard for `/admin/shop` on `localhost:3002`, so
  authenticated visual verification was not repeated in this session.
- 2026-05-16 admin nav follow-up: Merit Shop is now explicitly visible for
  full-admin users even if the shop-specific permission flag is false, and
  admin nav rows, mobile bottom nav buttons, and menu trigger icons were
  reduced in size. Verification: `pnpm --filter @oasis/web typecheck`,
  `pnpm --filter @oasis/web lint`, `pnpm --filter @oasis/web build`,
  `git diff --check`, and `graphify update .` pass.
- 2026-05-16 mobile admin shop follow-up: the Expo supervisor/admin bottom
  nav now surfaces the Shop icon directly, includes a staff-facing Merit Shop
  catalogue/pickup panel, and uses smaller shared mobile nav icons/buttons.
  Verification in this session: `pnpm --filter @oasis/mobile typecheck`,
  `pnpm --filter @oasis/mobile lint`, `git diff --check`, and
  `graphify update .` pass.
- 2026-05-18 school fee invoices: branch `feat/school-fee-invoices` adds
  persisted encrypted school fee invoices, finance-admin RBAC, PDF upload
  parsing via `pdfjs-dist`, parent `/parent/fees`, admin `/admin/invoices`,
  PDF upload/download route handlers, invoice domain helpers, API tests, and
  component-map ownership updates. v1 keeps online payment/reminder workflows
  out of scope.
- 2026-05-18 invoice verification: domain invoice/RBAC tests, API invoice
  router tests, DB tests, web typecheck/lint/build, root lint, component-map
  regeneration, `git diff --check`, and `graphify update .` pass locally.
  Browser smoke reached the Clerk sign-in guard for `/admin/invoices` and
  `/parent/fees`; authenticated UI flow verification remains a follow-up.
- 2026-05-21 Supabase realtime cache sync: branch
  `feat/supabase-realtime-cache-sync` adds a private Supabase Realtime
  invalidation bus for messages and child-note-driven views while keeping
  reads behind tRPC/Prisma. The migration creates guarded database triggers
  for message/thread/read/note changes and a private `realtime.messages`
  policy keyed to the Clerk subject. Verification: web typecheck, web lint,
  web build, API tests, DB tests, DB typecheck/lint, transactional `psql`
  migration validation, `pnpm db:migrate`, and `graphify update .` pass
  locally. Live browser verification still requires a configured Supabase
  Realtime project with Clerk third-party auth enabled.
- 2026-05-27 parent dashboard today status: parent hero attendance now uses
  parent-visible HalfTerm calendar closures and Oasis Tue-Fri operating days
  before showing today's attendance mark. Verification: focused tests,
  typecheck/lint, `git diff --check`, and `graphify update .` pass.
- 2026-05-28 noticeboard attachments: branch
  `feat/noticeboard-attachments` adds direct Supabase Storage uploads for
  notice attachments. Admins request signed upload tokens through the web API,
  upload files directly from the browser to a private `notice-attachments`
  bucket, and then post the notice with encrypted attachment metadata. Parents,
  supervisors, and admins can view image/PDF attachments and download all
  supported files through an authenticated signed-download route.
- 2026-05-28 Supabase production storage setup: the `notice-attachments`
  bucket now exists in the active Oasis Portal Supabase project
  (`fjatgkyswxqkbunrsmdq`). It is private, capped at 10 MB per object, and
  restricted to PDF, Word, JPEG, PNG, and WebP MIME types.
- 2026-05-29 PACE progress academic-year count: branch
  `fix/pace-progress-academic-year-count` changes parent dashboard and
  drill-through PACE completion metrics to count passed final `PaceRecord`
  rows in the UK academic year starting 1 September, rather than relying on
  lifecycle `PaceProgress` rows that may be missing for imported history.
  Verification: focused domain/API tests, typechecks, lint, Prettier check, and
  `graphify update .` pass.

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
7. **Notice attachments use private Supabase Storage** — files are not stored
   in Postgres. The database stores encrypted original filenames and encrypted
   storage paths only. Web route handlers use the Supabase service role server
   side to issue short-lived upload/download URLs after tRPC auth, audience,
   and notice availability checks.

## Blockers / escalations

No product blockers currently. Phase 1 is code-complete and merged through PR-1.9.

**Current technical verification note:**

- `pnpm db:migrate` cannot run in the isolated noticeboard attachment worktree
  until `DIRECT_URL` is present for Prisma. The migration file is created and
  should be applied once the database environment variables are available.

**Items to confirm with the centre before Phase 2:**

- Exact list of initial permission-tag assignments (who is shopkeeper,
  shopadmin, leaderboard-admin).
- Tithe default (currently 10% with 15/20 as options — confirm).
- Shop VAT rate default (currently configurable per item).
- Whether parents can view non-sensitive behaviour entries for their
  own child (currently yes in RBAC).
- Operational policy for expiring uncollected shop reservations. The
  current implementation keeps holds until collected or cancelled by
  an authorized user.

## Next steps — Phase 2 daily workflow

1. Build PR-2.5 subject management and PACE write rules API, including migration and tests.
2. PR-2.6 PACE read model (`pace.forStudent`) follows immediately after PR-2.5 merges.
3. Carry forward credentialed Supabase-preview Playwright onboarding as a
   verification task, not a Phase 2 blocker.

## Who's working on it

Technical Agent (Codex). No Strategic Agent work needed until we hit
shop pricing policy and tithe/investment comms copy in Phase 2.
