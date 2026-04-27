# PROJECT: Oasis Learning Centre Portal — Context

**Last updated:** 2026-04-27
**Agent:** Technical Agent (Codex)
**Phase:** 1 — Sprint 2 in progress; PR-1.7.5 merged; PR-1.8 in progress.

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

## Current status — Phase 1 Sprint 2 (week 3)

Phase 0, all four Sprint 1 PRs (PR-1.1 → PR-1.4), and Sprint 2 PR-1.5 →
PR-1.7.5 are merged to `main`. PR-1.8 is now the focused follow-up branch
for the full-admin audit viewer, encryption dump verification, and Phase 1
Sprint 2 verification suite.

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

### PR-1.8 in progress — `feat(audit): audit-log viewer + Phase 1 verification suite`

**PR scope:** Add the full-admin audit log read API and `/admin/audit` viewer,
remove plaintext PII from invitation audit metadata, add `pnpm verify:encryption`
using `pg_dump --data-only` through `DIRECT_URL`, and wire the encryption
verification job into CI.

### Sprint 2 (week 3) — Head admin surface

PRs 1.5–1.8: user invite + guardian linking, student CRUD, Head admin web screens, audit log viewer + encryption-proof script.

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

No product blockers currently. Sprint 1 (PR-1.1 → PR-1.4) is fully merged.

**Items to confirm with the centre before Phase 2:**

- Exact list of initial permission-tag assignments (who is shopkeeper,
  shopadmin, leaderboard-admin).
- Tithe default (currently 10% with 15/20 as options — confirm).
- Shop VAT rate default (currently configurable per item).
- Whether parents can view non-sensitive behaviour entries for their
  own child (currently yes in RBAC).

## Next steps — Phase 1 Sprint 2

1. Complete **PR-1.8** — audit-log viewer + `pnpm verify:encryption` script
   (pg_dump check) + CI verification suite.

## Who's working on it

Technical Agent (Codex). No Strategic Agent work needed until we hit
shop pricing policy and tithe/investment comms copy in Phase 2.
