# PROJECT: Oasis Learning Centre Portal — Context

**Last updated:** 2026-04-25  
**Agent:** Technical Agent (Claude)  
**Phase:** 1 — Sprint 1 in progress (auth + encryption foundations).

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

## Current status — Phase 1 Sprint 1 (week 2)

Phase 0 is merged to `main`. Phase 1 is underway; Sprint 1 focuses on
encryption foundations, infra provisioning, and Clerk auth wiring.

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

### Phase 1 Sprint 1 remaining (PRs 1.2 → 1.4)

- **PR-1.2** — Neon EU free-tier Postgres, `apply-rls.ts` script, CI db-integration job
- **PR-1.3** — Clerk integration (`@clerk/nextjs`, webhook → User upsert with encrypted PII, 2FA scaffolded but not enforced)
- **PR-1.4** — tRPC context (Clerk session → SessionUser → RLS session vars), `auditedProcedure`, auth middleware

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

None currently. Phase 1 Sprint 1 in active development.

**Items to confirm with the centre before Phase 2:**

- Exact list of initial permission-tag assignments (who is shopkeeper,
  shopadmin, leaderboard-admin).
- Tithe default (currently 10% with 15/20 as options — confirm).
- Shop VAT rate default (currently configurable per item).
- Whether parents can view non-sensitive behaviour entries for their
  own child (currently yes in RBAC).

## Next steps — Phase 1 Sprint 1 remaining

1. **PR-1.2** — Provision Neon EU free-tier Postgres; add `packages/db/scripts/apply-rls.ts`
   that runs RLS SQL after migrate; wire `pnpm db:migrate`; add CI db-integration job.
2. **PR-1.3** — Install `@clerk/nextjs` + `@clerk/clerk-expo`; add Clerk middleware;
   implement Svix-signed webhook handler (`user.created/updated/deleted` → encrypted
   User upsert); scaffold 2FA route (not enforced); add sign-in/sign-up pages.
3. **PR-1.4** — Rewrite `apps/api/src/context.ts` to verify Clerk session → load User
   → hydrate `SessionUser` → `SET LOCAL` Postgres session vars per request;
   add `auditedProcedure` + `requireAuth`/`requireRole` tRPC middlewares.

## Who's working on it

Technical Agent (Claude). No Strategic Agent work needed until we hit
shop pricing policy and tithe/investment comms copy in Phase 2.
