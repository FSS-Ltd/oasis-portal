# PROJECT: Oasis Learning Centre Portal — Context

**Last updated:** 2026-04-23  
**Agent:** Technical Agent (Claude)  
**Phase:** 0 — Scaffold complete, ready for Phase 1.

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

## Current status — Phase 0 complete

The monorepo scaffold, data model, domain rules, and API shape are in
place. Nothing is user-facing yet (no auth, no real UI), but every
business rule that matters is codified and unit-tested.

**What exists:**

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
5. **Per-record envelope encryption with AWS KMS** — PII stored as
   `v1:<kmsKeyId>:<wrappedDek>:<iv>:<tag>:<ct>` base64. Sibling
   `*_bidx` columns (HMAC-SHA256 with externally-stored pepper) support
   equality search without decryption.
6. **Deterministic investment sim** — Mulberry32 PRNG + FNV-1a seed
   hashing; seed persisted per student on first buy; GBM with regime
   switches so students occasionally lose money.

## Blockers / escalations

None. All Phase 0 exit criteria met.

**Items to confirm with the centre before Phase 1:**

- Exact list of initial permission-tag assignments (who is shopkeeper,
  shopadmin, leaderboard-admin).
- Tithe default (currently 10% with 15/20 as options — confirm).
- Shop VAT rate default (currently configurable per item).
- Whether parents can view non-sensitive behaviour entries for their
  own child (currently yes in RBAC).

## Next steps — Phase 1 (Auth + Identity + PII live path)

1. Wire Clerk middleware into `apps/web` and Clerk Expo into
   `apps/mobile`. Enforce 2FA-required at the Clerk dashboard.
2. Extend `apps/api/src/context.ts` to verify the Clerk session, load
   the `User` row by `clerkUserId`, hydrate `SessionUser` with role +
   tags, and set Postgres session vars (`app.user_id`,
   `app.user_role`, `app.full_admin`) so RLS policies fire.
3. Implement real `encryptField` / `decryptField` against AWS KMS
   (currently skeleton); add per-request DEK cache.
4. Implement `student.*` and `user.*` tRPC procedures so we can
   actually create a user, onboard students, and list them decrypted.
5. First Playwright e2e: sign-in with 2FA, view students list, see
   decrypted names as Head role; same list as Supervisor should hide
   sensitive flags.

## Who's working on it

Technical Agent (Claude). No Strategic Agent work needed until we hit
shop pricing policy and tithe/investment comms copy in Phase 2.
