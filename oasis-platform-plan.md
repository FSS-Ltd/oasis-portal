# Oasis Learning Centre Platform — Build Plan

> **For agents:** This is the master architecture and scope document.
> Per-phase sprint & PR plans live in `docs/`:
>
> - Phase 1 (complete): [`docs/phase-1-build-plan.md`](docs/phase-1-build-plan.md)
> - Phase 2 (daily web workflows complete; mobile smoke/closeout planned): [`docs/phase-2-build-plan.md`](docs/phase-2-build-plan.md)
> - Phase 2.5 (partially pre-built): [`docs/phase-2.5-build-plan.md`](docs/phase-2.5-build-plan.md)
> - Phase 3 (partially pre-built): [`docs/phase-3-build-plan.md`](docs/phase-3-build-plan.md)
> - Phase 3.5 (planned): [`docs/phase-3.5-build-plan.md`](docs/phase-3.5-build-plan.md)
> - Phase 4 (planned): [`docs/phase-4-build-plan.md`](docs/phase-4-build-plan.md)
> - Phase 5 (hardening foundations partially pre-built): [`docs/phase-5-build-plan.md`](docs/phase-5-build-plan.md)
>
> Always read the relevant phase plan before writing code — it contains
> the authoritative PR breakdown, file lists, and done/in-progress status.
> Also read [`PROJECT_Oasis_Context.md`](PROJECT_Oasis_Context.md) for
> current status and any decisions that supersede this document.
>
> **UI design source:** Before building or changing any UI, inspect
> [`design/`](design/). The folder contains the Claude design handoff ZIP,
> whose internal `README` is the design reference for UI implementation, plus
> Oasis logo assets as PNG and SVG. Use those assets and conventions before
> inventing new visual direction.

## Context

Oasis Learning Centre (Christian ACE homeschool enrichment centre, 16 → 30 students, Tue–Fri) currently runs on paper forms, spreadsheets, WhatsApp, and email. The Director has signed off `Oasis_Platform_Brief_v2.docx`, which resolves all v1 open questions.

**Why we're building this**

- Head of Centre is the single point of failure for attendance, PACEs, behaviour, and end-of-term reports — she spends hours per term manually compiling data.
- Behaviour data (merits/demerits) is lost or incomplete, so the Merit Shop runs on unreliable totals.
- Parents contact staff on personal WhatsApp — no professional boundary, no audit trail.
- Sensitive behaviour entries leak to all supervisors; the brief requires this to be enforced at the data layer, not the UI.
- The centre wants a **Merit Shop with biblical money management** — merits split across tithing, investing, charitable giving, and spendable balance. This is a core feature, not a nice-to-have.
- The Director has extended the brief (post-v2) with: a **Student mobile view**, a **three-account merit system (Saving / Spend / Investment)** with a fluctuating investment simulator averaging ~10% p.a., weekly tithing at a chosen percentage (10/15/20), demerits fixed at −5 merits, **public leaderboards** (top tithers, top investors, top savers) and an admin-only highest-demerits leaderboard, plus an **in-app shop** run by tagged shopkeepers with auto-stock-decrement and auto-debit from the student's Spend account.

**Intended outcome**
One bespoke platform — web + native iOS/Android — with role-scoped experiences for Head of Centre, Principal, Pastor, Head of Discipline (all four at full-admin parity), Technical Support, Clubs Admin (limited), Supervisor, Parent, and Student, plus granular permission tags for exports, lifecycle support, PACE access, shop, leaderboards, behaviour reporting, and Sensitive child notes. 2FA is scaffolded and enforced in Phase 5. The platform is hosted in UK/EU infrastructure, keeps end-to-end auditability, and generates term reports. Built to the FSS quality bar in `BUILD.md` (strict TS, RBAC on every endpoint, GDPR-by-default).

---

## Architecture (aligned with BUILD.md §3)

**Monorepo, modular monolith first.**

```
oasis-portal/
├── apps/
│   ├── web/          Next.js 15 (App Router) — Head + Supervisor + Parent web
│   ├── mobile/       Expo (React Native) — iOS + Android, shared UI primitives
│   └── api/          Next.js Route Handlers (tRPC) — single backend for web + mobile
├── packages/
│   ├── db/           Prisma schema, migrations, seed
│   ├── domain/       Pure TS business logic (merit-shop split, report compilation, RBAC guards)
│   ├── ui/           Shared Tamagui / React-Native-Web components
│   └── config/       eslint, tsconfig, tailwind preset
└── infra/            deployment configuration and CI/CD wiring
```

**Stack**

- **Frontend (web)**: Next.js 15 + App Router + Server Actions + Tailwind + shadcn/ui
- **Frontend (mobile)**: Expo SDK 52 (RN 0.76) + expo-router + Tamagui (shared with web via react-native-web)
- **API**: tRPC over Next.js Route Handlers — one typed client consumed by both web and mobile
- **DB**: Supabase Postgres in an EU region. Prisma owns schema + migrations; `packages/db/scripts/apply-rls.ts` applies RLS after migrations.
- **Auth**: Clerk (UK/EU data residency where available), role sync through signed webhooks, TOTP/SMS 2FA scaffolded and enforcement deferred to Phase 5.
- **File storage**: Supabase Storage (EU) for photo/document uploads (nice-to-have feature)
- **Push**: Expo Push Notifications (mobile) + web-push (web) — wired from day one even though push features are nice-to-have
- **Email**: Resend for branded transactional invitations and future parent/report notifications.
- **PDF**: `@react-pdf/renderer` server-side for term reports
- **Hosting**: Vercel (web + API in one Next.js app), EAS Build + Submit for mobile
- **CI/CD**: GitHub Actions — lint, typecheck, unit tests, DB/RLS smoke, encryption dump verification, and Vercel preview/prod deploys
- **Testing**: Vitest (unit), Playwright (web e2e), Detox or Maestro (mobile e2e), Prisma test containers (integration)
- **Observability**: Sentry (errors, both apps) + Axiom or Vercel logs (structured JSON) + OpenTelemetry traces

---

## Data model (packages/db/prisma/schema.prisma)

Core tables (Prisma names):

- `User` — linked 1:1 to Clerk; `role: Head | Principal | Pastor | HeadOfDiscipline | TechnicalSupport | ClubsAdmin | Supervisor | Parent | Student`; `tags: string[]` for granular permissions.
  - `Head`, `Principal`, `Pastor`, `HeadOfDiscipline` are grouped into a single `isFullAdmin(user)` predicate used by every RBAC guard — they share identical access (all data, all students, all staff records, all reports, all Sensitive entries, all communications).
  - `TechnicalSupport` can administer account shells for safe onboarding and support, without full student/behaviour/academic access.
  - `ClubsAdmin` has access only to the Clubs module (create / edit clubs, view signups, send club notifications); no student academic, behaviour, or financial data.
  - Current permission tags: `shopkeeper`, `shopadmin`, `leaderboard-admin`, `attendance-exporter`, `attendance-recorder`, `audit-viewer`, `sensitive-note-viewer`, `behaviour-viewer`, `student-drillthrough-viewer`, `pace-full-access`.
- `Student` — `fullName, dob, yearGroup, enrolmentDate, userId?` (optional login for the student view)
- `Guardian` — `User` join table to `Student` (many-to-many for multi-child parents — nice-to-have but schema ready)
- `Subject` — seeded ACE subjects
- `StudentSubject` — `currentPaceNumber`
- `PaceRecord` — `studentId, subjectId, paceNumber, selfTestScore, paceTestScore, completedAt, recordedById`
- `Attendance` — `studentId, date, status: Present | Absent | Late, recordedById`
- `BehaviourEntry` — `studentId, type: Merit | Demerit, category, note, visibility: General | Sensitive, meritDelta (+N or −5), recordedById, createdAt`
- `MeritLedger` — append-only double-entry: `studentId, delta, account: Spend | Saving | Investment | TithePaid | Given, reason, relatedEntryId?, createdAt`
- `TitheConfig` — per-student: `percentage: 10 | 15 | 20`, `cadence: Weekly`, `lastRunAt` (default 10%, parent/Head editable)
- `TitheRun` — `studentId, periodStart, periodEnd, grossMerits, titheAmount, createdAt` (idempotent per period)
- `InvestmentAccount` — `studentId, units` (mutual-fund-style units; balance = units × current NAV)
- `InvestmentNav` — global price series: `date, nav, dailyReturn` (simulated daily; long-run drift ≈10% p.a., volatility ≈15%, occasional drawdowns — see `packages/domain/src/investmentSim.ts`)
- `InvestmentTransaction` — `studentId, type: Buy | Sell, units, nav, feeMerits, createdAt` (withdrawal fee on Sell)
- `ShopItem` — `name, photoUrl, priceExVat, vatRatePct, priceIncVat, stockCount, active, createdById` (createdBy must hold `shopadmin` tag)
- `ShopPurchase` — `studentId, itemId, unitsBought, totalPriceMerits, shopkeeperId, createdAt` (only users with `shopkeeper` tag can record a purchase; trigger debits Spend ledger + decrements stock atomically)
- `LeaderboardSnapshot` — rolled-up daily rankings for Top Tithers, Top Investors (by total return), Top Savers (by Saving balance)
- `Club` — `name, description, schedule, capacity?, active, createdById` (createdBy must be `ClubsAdmin` or full-admin)
- `ClubSignup` — `clubId, studentId, signedUpByUserId` (parent or full-admin), `createdAt`, `status: Active | Withdrawn`
- `ClubNotification` — `clubId, title, body, sentById, sentAt` (sent to guardians of signed-up students + optionally supervisors)
- `StaffNotice` + `StaffNoticeRead` — notice board + read receipts
- `Message` + `MessageThread` — parent ↔ Head in-platform messaging
- `TermReport` — draft → reviewed → sent, with snapshot of compiled data at send time (so historical reports don't drift when data changes)
- `AuditLog` — every create/update/delete on sensitive tables, plus every Sensitive-visibility read

**Application-layer PII encryption (Director mandate):**

Goal: a full database dump (SQL export, snapshot theft, rogue DBA read) reveals **zero identifiable personal data**. Only an authenticated request through the app, passing RBAC, can see cleartext.

- **Envelope encryption with an env-managed master key**. ADR-006 supersedes the original AWS KMS design in ADR-005 so the centre can run on free-tier infrastructure. Per-record data encryption keys (DEKs) are wrapped in-process by `OASIS_MASTER_KEY`; key versions are explicit.
- **Algorithm**: AES-256-GCM with random IVs. Ciphertext format stored in DB: `v1:<keyVersion>:<wrappedDek>:<wrapIv>:<wrapTag>:<iv>:<tag>:<ct>`. `v1:` lets us rotate schemes later.
- **Encrypted fields** (PII):
  - `User.fullName`, `User.email`, `User.phone`, `User.address`
  - `Student.fullName`, `Student.dob`, `Student.address` (if stored)
  - `Guardian` free-text notes
  - `BehaviourEntry.note`, `Message.body`, `StaffNotice.body`, `ClubNotification.body`
  - `TermReport.compiledJson` (whole snapshot)
- **Deterministic searchable index** for fields that must be looked up (email for login, student name for staff search): a **blind index** = `HMAC-SHA256(pepper, lowercased+normalised value)` stored in a sibling column (e.g. `email_bidx`). The pepper lives only in env, never in DB. Equality lookups use the blind index; fuzzy search for staff UI is done in-memory after decryption within the authorised result set.
- **Decryption in the app layer only.** The Prisma encryption helper (`packages/db/src/encryption.ts`) encrypts/decrypts fields explicitly in tRPC services. No SQL function, DB trigger, or view sees plaintext.
- **Per-role field projection** happens _after_ decryption in tRPC output transformers: e.g. Parent sees `Student.fullName` only for their own child; Supervisor sees other students' `fullName` but never `address` or `phone`; full-admin roles see everything. This is on top of RBAC — the encryption layer is the second wall, not the first.
- **Key rotation**: ciphertext stores the key version. Older keys stay available as versioned env vars during rotation; high-touch rows can be rewrapped under the new version.
- **Auditability**: Every decrypt is logged (user, field, recordId, timestamp) to `AuditLog`. Bulk-decrypt rate limits per session detect scraping attempts.
- **Backups**: Postgres snapshots remain encrypted at rest via Supabase/Neon managed encryption. Even with snapshot access, PII is still ciphertext because it was encrypted at the _application_ layer before insert.
- **Keys in non-prod**: each environment uses separate env-managed keys and blind-index peppers. Production values live only in Vercel/GitHub secret storage.
- **What is NOT encrypted** (deliberately, because it's non-identifying operational data): numeric merit ledger rows, PACE numbers, attendance status, NAV time-series, shop item stock counts. These are safe to leak under the "no identity revealed" criterion because they don't join to a name without the encryption layer.

Trade-offs: no server-side SQL search over encrypted free-text, and key rotation is operational rather than KMS-managed. This is acceptable at current centre scale and documented in ADR-006.

**Sensitive-visibility enforcement (brief risk #3):**
Not a UI flag. Enforced in the tRPC middleware layer via a `requireCanViewSensitive(userId, studentId)` guard, and by a Postgres row-level security policy on `BehaviourEntry` as a belt-and-braces second line of defence. Every Sensitive read writes an `AuditLog` row.

**Merit economy (post-brief extension):**

- **Earning**: A `BehaviourEntry` of type `Merit` credits Spend by `+N` merits. A `Demerit` debits Spend by **−5 merits** (fixed per Director). All movements are `MeritLedger` rows; balances are always derivable — never denormalised.
- **Three accounts per student**: `Spend` (default inflow), `Saving` (transfer-in from Spend, no interest, no fee), `Investment` (transfer-in buys units at current NAV; transfer-out sells units at current NAV minus a withdrawal fee in merits).
- **Weekly tithe**: A scheduled job runs end-of-week per student. It takes that week's **gross merits earned** (sum of positive `BehaviourEntry.meritDelta` in the period), multiplies by `TitheConfig.percentage` (10 / 15 / 20 — default 10), debits Spend by that amount, credits `TithePaid`. Idempotent via `TitheRun` row per period. Parents and Head can change the percentage; students cannot.
- **Investment simulator** (`packages/domain/src/investmentSim.ts`): a deterministic-given-seed daily NAV walk. Parameters: `μ = 10% p.a. drift`, `σ ≈ 15% p.a. volatility`, occasional drawdown regimes so students can see losses. A daily cron writes one `InvestmentNav` row. Student balance = `units × latestNav`. Unit tests pin the distribution so a 3-year backtest averages ~10% p.a. with realistic fluctuation.
- **Withdrawal fee**: `Sell` from Investment charges a fee in merits (default 5% of proceeds, Head-configurable). Fee is burned (logged to a `FeeSink` account in the ledger so totals still reconcile).
- **Shop purchases debit Spend only.** Transfers between Spend ↔ Saving ↔ Investment are student-initiated from the Student view (Parents can view, cannot move funds).
- **Weekly / monthly earned + lost views**: `getMeritActivity(studentId, range)` returns `{ meritsEarned, demeritsCount, demeritsMerits, net }` for last 7 / 30 days, surfaced on Student, Parent, and Supervisor views.

---

## MVP scope (from brief §5, mapped to milestones)

Every MVP item is in scope. Nice-to-haves from brief §6 are out of scope for v1 except where noted.

| #   | Feature                                                                                                          | Web | Mobile | Notes                                                     |
| --- | ---------------------------------------------------------------------------------------------------------------- | --- | ------ | --------------------------------------------------------- |
| 1   | Clerk auth + 2FA (TOTP + SMS fallback)                                                                           | ✓   | ✓      | Enforced on all three roles                               |
| 2   | Role-based access (Head / Supervisor / Parent)                                                                   | ✓   | ✓      | tRPC middleware + RLS                                     |
| 3   | Student profiles (name, age, year, subjects, PACE per subject)                                                   | ✓   | ✓      | Head + Supervisor edit, Parent read-only                  |
| 4   | Daily attendance (Present/Absent/Late)                                                                           | ✓   | ✓      | Supervisor primary use-case on tablet                     |
| 5   | Merit/demerit logging with General/Sensitive toggle                                                              | ✓   | ✓      | Mobile-first UX                                           |
| 6   | Running merit/demerit totals                                                                                     | ✓   | ✓      | Computed from ledger                                      |
| 7   | PACE progress + test score entry                                                                                 | ✓   | ✓      |                                                           |
| 8   | Parent portal (read-only child view)                                                                             | ✓   | ✓      |                                                           |
| 9   | Staff noticeboard + read receipts                                                                                | ✓   | ✓      | Head posts, Supervisors read                              |
| 10  | Parent ↔ Head messaging                                                                                          | ✓   | ✓      |                                                           |
| 11  | End-of-term report generation + Head review + send                                                               | ✓   | —      | PDF export, web only for composition                      |
| 12  | Merit Shop module with 4-way split                                                                               | ✓   | ✓      | Head-configurable percentages                             |
| 13  | Mobile-responsive web + native iOS + Android                                                                     | ✓   | ✓      | Expo EAS, submit to both stores                           |
| 14  | **Student mobile view** (results + merits read-only + transfer between own accounts + set tithe %)               | —   | ✓      | Login via Clerk; no access to other students              |
| 15  | **Three-account merit model** (Spend / Saving / Investment) + weekly tithe 10/15/20 + demerit = −5               | ✓   | ✓      | Core domain module                                        |
| 16  | **Investment simulator** — daily NAV, realistic volatility, ~10% p.a. average, withdrawal fees                   | ✓   | ✓      | Cron + deterministic seed                                 |
| 17  | **Leaderboards**: Top Tithers (default view), Top Investors, Top Savers — visible to Parents, Staff, Students    | ✓   | ✓      | Toggle between boards                                     |
| 18  | **Admin demerit leaderboard** — only users with `leaderboard-admin` tag                                          | ✓   | —      | Separate route, gated server-side                         |
| 19  | **In-app Shop**: items with photo, price + VAT, stock count; purchase records auto-debit Spend + decrement stock | ✓   | ✓      | `shopkeeper` records purchases, `shopadmin` manages items |
| 20  | **Clubs module** (v1 = tracking only): create/edit clubs, parent signup, view signups, send club notifications   | ✓   | ✓      | `ClubsAdmin` role, parents sign their own child(ren) up   |

---

## Delivery phases (BUILD.md §5)

**Phase 0 — Architecture & setup (week 0–1)** ✅ COMPLETE

- Design doc (this file + `/docs/ADRs/` for key decisions)
- Monorepo scaffold (Turborepo), Prisma schema v1, Clerk org + roles, Vercel + Supabase EU projects, CI green
- Director confirms default Merit Shop split percentages (blocker per brief risk #5)

**Phase 1 — Core data + auth (week 2–3)** ✅ COMPLETE

- Sprint & PR plan: [`docs/phase-1-build-plan.md`](docs/phase-1-build-plan.md)
- Sprint 1 ✅ — env-key encryption (PR-1.1), Supabase/RLS/CI (PR-1.2), Clerk auth + webhook sync (PR-1.3), tRPC context + RLS session vars + audit middleware (PR-1.4)
- Sprint 2 ✅ — user invite + guardian linking (PR-1.5), student CRUD (PR-1.6), Head admin screens (PR-1.7), audit viewer + verification suite (PR-1.8), docs closeout (PR-1.9)
- 2FA scaffolded for all roles (enforcement deferred to Phase 5 — see plan)
- **PII encryption layer** wired in from day one (env-key AES-256-GCM envelope encryption, per-record DEKs, blind indexes, decrypt audit — ADR-006). AWS KMS deferred; see ADR-005 (superseded).

**Phase 2 — Daily workflows (week 4–6)** 🔄 WEB COMPLETE, MOBILE/CLOSEOUT PLANNED

- Sprint & PR plan: [`docs/phase-2-build-plan.md`](docs/phase-2-build-plan.md)
- Web/API workflow is merged through PR-2.11c: attendance capture, behaviour logging/reporting, PACE entry/access, rota, child notes, child snapshots, Head academic settings, and Supervisor daily pages.
- Remaining Phase 2 work is mobile supervisor smoke and phase verification/closeout.

**Phase 2.5 — People records + attendance exports (between Phase 2 and Phase 3)** 🧭 PARTIALLY PRE-BUILT

- Sprint & PR plan: [`docs/phase-2.5-build-plan.md`](docs/phase-2.5-build-plan.md)
- Already merged: reusable web UI primitives, student drill-through, parent linked-child view, People & Profiles, TechnicalSupport account administration, and admin lifecycle controls.
- Detail pages for students, staff, and parents with view/edit support.
- Student and staff detail pages include individual attendance history with
  view/export actions.
- Parent detail pages do not expose attendance history or attendance export.
- Attendance export centre supports a selected date range with dropdowns for
  all students vs one student and all staff vs one staff member.
- Export access remains limited to full-admin users and users with the
  `attendance-exporter` tag.

**Phase 3 — Parent portal + comms (week 7–8)** 🧭 PARTIALLY PRE-BUILT

- Sprint & PR plan: [`docs/phase-3-build-plan.md`](docs/phase-3-build-plan.md)
- Already merged: parent shell/linked-child drill-through, Resend invite/email foundation, parent initial registration, and child-registration prompt for non-parent adult accounts.
- Parent read-only child view (attendance, PACEs, behaviour summary, merit balance)
- In-platform messaging (parent ↔ Head)
- Staff noticeboard with read receipts

**Phase 3.5 — Clubs module (week 8, parallel with Phase 3)** 🧭 PLANNED

- Sprint & PR plan: [`docs/phase-3.5-build-plan.md`](docs/phase-3.5-build-plan.md)
- `ClubsAdmin` role, Club CRUD, parent-initiated signup for their own children, view signup roster, send club notifications (email + push to guardians of signed-up students)
- Deliberately minimal per Director — will iterate as the centre grows

**Phase 4 — Merit economy + Shop + reports (week 9–11)** 🧭 PLANNED

- Sprint & PR plan: [`docs/phase-4-build-plan.md`](docs/phase-4-build-plan.md)
- Three-account ledger (Spend / Saving / Investment), −5 demerit rule, atomic transaction rules
- Weekly tithe engine + `TitheConfig` UI (10/15/20) for Parent and Head
- Investment simulator: NAV cron, deterministic seed, unit/sell with fee, unit tests that pin long-run distribution
- In-app Shop: `shopadmin` item CRUD (photo upload, price-ex-VAT + VAT rate, stock), `shopkeeper` purchase flow (scan student → pick items → confirm → atomic debit + stock decrement), receipt view for student and parent
- Leaderboards: Top Tithers (default), Top Investors, Top Savers — public. Highest-demerits board gated to `leaderboard-admin` tag
- Student mobile view: home (balances across 3 accounts, this-week + this-month merit activity), PACE results, transfer between own accounts, set own/ack tithe %, leaderboard tab, shop tab (browse only unless `shopkeeper`)
- Term report compilation + PDF + Head review + send flow

**Phase 5 — QA, hardening, rollout (week 11–12)** 🧭 FOUNDATIONS PARTIALLY PRE-BUILT

- Sprint & PR plan: [`docs/phase-5-build-plan.md`](docs/phase-5-build-plan.md)
- Already merged: Supabase/Vercel CI/CD, production Prisma runtime fixes, invite email hardening, post-sign-in handoff stabilisation, and admin lifecycle hardening.
- Full test pass (≥80% unit coverage, e2e for all 7 workflows in brief §4)
- Penetration-style security review against brief §10 risks
- UK GDPR paperwork: privacy policy, data-retention policy, DPIA, DPA with Clerk/Supabase/Vercel/Resend
- EAS production builds, App Store + Play Store submission
- Staff rollout plan + training (brief flags this as adoption risk)

---

## Current implementation map

- `apps/web/` — Next.js app with admin, supervisor, parent, registration, post-sign-in, and not-ready shells.
- `apps/mobile/` — Expo app with Clerk provider and placeholder landing; mobile workflow buildout remains in Phase 2/3/4/5 plans.
- `apps/api/src/routers/` — implemented routers for auth context, admin, audit, attendance, behaviour, child log, child notes, email, health, PACE, profile, registration, rota, and student workflows. Routers for clubs, messages, notices, shop, tithe, investment, leaderboards, merit wallet, and reports currently expose typed placeholders and are planned in later phase docs.
- `packages/db/prisma/schema.prisma` — current data model, migrations, RLS policy SQL, user invitation tables, child notes, registration tables, rota/attendance/PACE models, and future economy/comms/clubs/report tables.
- `packages/domain/src/` — RBAC, users, school years, subjects, registration, merit ledger, tithe, investment simulator, shop, leaderboard, clubs, and reports domain helpers with tests.
- `docs/runbook.md` — Supabase, Vercel, Resend, encryption, deploy, and incident procedures.
- `.github/workflows/ci.yml` — lint/typecheck/test, DB/RLS smoke, encryption dump verification, and Vercel deploy jobs.

All FSS quality gates from `BUILD.md` §4 apply: strict TS, no `any`, zod on every input, parameterised queries, HTTPS, audit logs, structured logging, ≥80% unit coverage, e2e on every critical workflow.

---

## Decisions made (resolved via AskUserQuestion)

1. **Mobile strategy**: Expo / React Native with a shared Next.js web — one TS codebase, ships iOS + Android + web.
2. **Auth**: Clerk — TOTP + SMS 2FA, organization-based RBAC, UK/EU residency.
3. **Hosting region**: UK/EU only (eu-west-2 preferred). Required for children's data under UK GDPR.

## Decisions still owed by Director before Phase 4/5 implementation

- Default weekly tithe percentage (10 / 15 / 20 — assume 10 unless told otherwise)
- Investment simulator parameters sign-off: μ = 10% p.a., σ ≈ 15%, withdrawal fee default 5% — confirm or adjust
- Which charities the centre wants to list as giving targets (or free-text note?)
- Minimum age or year-group threshold for issuing a Student login
- Which Head-level users get the `leaderboard-admin` tag (demerit leaderboard access)
- Shop VAT rate default (20% UK standard? or exempt educational?)
- Push-notification defaults (opt-in or opt-out per parent)
- Data retention period for graduated students (5 years? 7?)

## Out of scope for v1 (brief §6 nice-to-haves — defer to v1.1+)

Push notifications for merit/demerit events, automated absence alerts, bulk parent announcements, photo/doc uploads, child-friendly Merit Shop dashboard, calendar, leadership dashboard, bulk PDF export, full ACE sequence integration, and cumulative charity log.

Schema is designed to accommodate all of these without migration pain (e.g. `Guardian` is already many-to-many, `MeritLedger` already tracks charity totals).

---

## Verification plan

**Per feature (automated)**

- Vitest unit: every `packages/domain` function, including merit-split edge cases (rounding, zero balances, negative demerit totals, config changes mid-term)
- Prisma integration: every tRPC router against a disposable Postgres container, with RLS enabled
- Playwright e2e (web): each of brief §4 workflows 1–7, per role
- Maestro e2e (mobile): attendance + behaviour logging + parent view on iOS sim + Android emulator

**Pre-launch manual**

- Security review against BUILD.md §4.3 checklist + brief §10 risks (especially Sensitive enforcement — try to read a Sensitive entry as Supervisor via direct tRPC call and via raw DB client)
- **Encryption proof**: take a `pg_dump` of staging, confirm no names, emails, DOBs, addresses, messages, or report bodies appear in plaintext. Attempt to `SELECT *` every PII column as a raw DB user — must return only ciphertext blobs. Attempt decrypt without the current env-managed master key — must fail.
- Load test: simulate 30 students × 4 staff × a full school day of attendance + behaviour entries on a staging tenant
- Install EAS internal-distribution builds on the Head's and a Supervisor's actual devices, run through a real half-day at the centre
- Parent UAT: invite two parents to preview before general rollout

**Rollout**

- Two-week pilot: 5 students, paper forms in parallel, reconcile daily
- Full switch-over at term start, not mid-term
- Head of Centre trained first and becomes internal super-user for supervisors
