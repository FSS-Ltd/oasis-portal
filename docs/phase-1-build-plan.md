# Phase 1 — Core data + auth: sprint & PR plan

**Status:** Sprint 2 in progress (week 3) — PR-1.7 merged; PR-1.7.5 in progress  
**Last updated:** 2026-04-27  
**Parent plan:** [`/oasis-platform-plan.md`](/oasis-platform-plan.md) §Delivery phases  
**Project context:** [`/PROJECT_Oasis_Context.md`](/PROJECT_Oasis_Context.md)

---

## Context

Phase 0 (scaffold) is merged to `main`: monorepo, Prisma schema v1, RLS
SQL, encryption helper, tRPC skeleton routers, ADRs 001–005, mobile/web/api
shells, CI green.

Phase 1 delivers the foundation every subsequent feature depends on:

- Real Clerk auth wired through tRPC context
- PII encryption running on every write to `User`, `Student`, `Guardian`
- Postgres + RLS on Supabase EU Postgres
- Head full-admin can invite staff/parents, create students, link guardians, assign subjects
- Audit log baseline on every mutation and every PII decrypt

**Key decisions made entering Phase 1:**

- **No AWS** — env-variable master key instead of KMS (cost: centre is small, free-tier only). See ADR-0006.
- **2FA scaffolded, not enforced** — hooks and routes ready; enforcement deferred to Phase 5.
- **Two 1-week sprints** with a mid-phase checkpoint.

---

## Pre-work — ADR update (done before Sprint 1)

- `docs/adr/0005-pii-envelope-encryption-kms.md` → marked **Superseded by ADR-0006**.
- `docs/adr/0006-pii-envelope-encryption-env-key.md` → new ADR documenting env-key scheme.
- New wire format: `v1:<keyVersion>:<wrappedDek>:<wrapIv>:<wrapTag>:<iv>:<tag>:<ct>`
- Env vars: `OASIS_MASTER_KEY` (32 bytes base64), `OASIS_MASTER_KEY_VERSION`, `OASIS_BIDX_PEPPER`
- Hosting (free-tier): **Supabase** EU Postgres, **Vercel** hobby, **Expo EAS** free, **Resend** free.

---

## Sprint 1 — Week 2: foundations

Goal: every downstream PR can assume "I have a real authenticated user, RLS is on,
PII writes auto-encrypt, audit log captures everything."

### PR-1.1 — `chore: replace KMS encryption with env-key provider` ✅ MERGED

Branch: `feature/phase-1-pr1.1-env-key-encryption`

- **`packages/db/src/encryption.ts`** — drop `@aws-sdk/client-kms`; in-process
  AES-256-GCM key-wrap with `OASIS_MASTER_KEY`. Wire format updated, versioned.
- **`packages/db/src/__tests__/encryption.test.ts`** — 13 tests: round-trip,
  unicode/empty, nullable, randomness, GCM tamper on data + wrapped DEK,
  key-version rotation, missing/wrong-length key, malformed wire.
- **`packages/db/package.json`** — dropped `@aws-sdk/client-kms`.
- **`docs/adr/0006-pii-envelope-encryption-env-key.md`** — new ADR.
- **`docs/adr/0005-pii-envelope-encryption-kms.md`** — marked Superseded.
- **`.env.example`** — updated with new env var names.

### PR-1.2 — `infra: Supabase Postgres + RLS apply script + CI db job` ✅ MERGED

- Add `packages/db/scripts/apply-rls.ts` — executes `prisma/rls.sql` after
  `prisma migrate deploy` so RLS is never skipped.
- Wire `pnpm db:migrate` = migrate-deploy + RLS apply.
- Document Supabase project setup in `docs/runbook.md`: create project, copy
  `DATABASE_URL` (pooled) + `DIRECT_URL` (direct), configure `oasis_app`
  non-superuser role with `app.user_id`/`app.user_role`/`app.full_admin` session vars.
- CI: add `db-integration` job (Postgres service, migrate + RLS apply + smoke query).

**Tests:** RLS integration — full-admin can SELECT Sensitive `BehaviourEntry`,
Supervisor cannot.

### PR-1.3 — `feat(auth): Clerk integration with 2FA-ready scaffolding` ✅ MERGED

Branch: `feat/phase-1-pr1.3-clerk-auth`

- `@clerk/nextjs` and `@clerk/clerk-expo` are present; `@clerk/backend` and
  `standardwebhooks` are direct API dependencies for webhook verification tests.
- `apps/web/src/middleware.ts` — Clerk middleware protects admin/dashboard/2FA routes
  while leaving tRPC and the Clerk webhook endpoint callable.
- `apps/web/src/app/layout.tsx` — ClerkProvider wrapper with a build-safe fallback
  when CI has no Clerk publishable key.
- `apps/mobile/app/_layout.tsx` — ClerkProvider with Expo SecureStore token cache.
- `apps/api/src/routers/clerkWebhook.ts` — Svix/Standard Webhooks-signed handler for
  `user.created`, `user.updated`, `user.deleted`. On create/update: encrypt
  name/email/phone, compute `emailBidx`, upsert `User` with default role `Parent`.
- `apps/web/src/app/api/clerk/webhook/route.ts` — Next route handler exposing the
  API webhook service.
- `SessionUser.requires2fa: boolean` field added (always `false` in Phase 1;
  Phase 5 flips). 2FA enrolment route present but not gated.
- Sign-in/sign-up pages and `/2fa` scaffold in `apps/web/src/app/(auth)/`.
- `.env.example` documents Clerk web/mobile publishable keys, secret key, and
  `CLERK_WEBHOOK_SIGNING_SECRET`.

**Tests:** webhook signature verification; user upsert with encrypted PII;
default-role assignment. Current local verification: `pnpm lint`, `pnpm typecheck`,
`pnpm test`, and `pnpm --filter @oasis/web build` pass. User confirmed the merged
changes completed with no errors.

### PR-1.4 — `feat(api): tRPC context, RLS session vars, audit-log middleware` ✅ MERGED

Branch: `feat/phase-1-pr1.4-trpc-context-rls` → [PR #10](https://github.com/jntagengwa/oasis-portal/pull/10)

- **`apps/api/src/context.ts`** — rewrites `createContext` to verify Clerk session
  → load `User` by `clerkId` → hydrate `SessionUser`; exposes `withRls()` which
  opens a Prisma `$transaction` and calls `SET LOCAL app.user_id`, `app.user_role`,
  `app.full_admin` so RLS policies in `rls.sql` fire. Core extracted as `applyRlsTx`
  for reuse by the integration smoke.
- **`apps/api/src/trpc.ts`** — adds `authedProcedure`, `fullAdminProcedure`,
  `roleProcedure(...roles)`, and `auditedProcedure`. RBAC guards delegate to
  `requireFullAdmin` / `requireRole` from `@oasis/domain` — no duplication.
  `auditedProcedure` writes `Update` `AuditLog` on successful mutations and
  `PermissionDenied` on `AccessDeniedError`, rethrowing as `FORBIDDEN`.
- **`apps/api/src/routers/health.ts`** — `health.me` returns `{ user: SessionUser | null }`.
- **`apps/web/src/app/api/trpc/[trpc]/route.ts`** — calls `auth()` from
  `@clerk/nextjs/server`; falls back to anonymous when Clerk secrets are absent.
- **`apps/api/scripts/smoke-context-rls.ts`** — integration smoke asserting
  Head=2 / Supervisor=1 (General only) / anonymous=0 `BehaviourEntry` rows
  via `applyRlsTx` + runtime `oasis_app` role; wired to `db-integration` CI.
- **`packages/db/src/index.ts`** — re-exports `Prisma` namespace.
- **`apps/api/src/index.ts`** — re-exports new procedures + `RlsTx` type.

**Tests (15 passing):** 7 new unit middleware tests (`authedProcedure`,
`fullAdminProcedure`, `auditedProcedure` success/query/access-denied paths) +
8 existing webhook tests.

**Sprint 1 demo checkpoint:** ✅ Clerk sign-in → webhook upserts encrypted `User` →
`health.me` returns hydrated `SessionUser` → context RLS smoke green in CI.

---

## Sprint 2 — Week 3: Head admin surface

Goal: Head can run an entire onboarding session — invite staff/parents, create
students, link guardians, assign subjects, and see a full audit trail.

### PR-1.5 — `feat(domain): user invite + guardian linking` ✅ MERGED

Branch: `feat/phase-1-pr1.5-user-invite-guardian`

- `packages/domain/src/users.ts` — `inviteUserInput` / `linkGuardianInput` zod schemas
  (role + tag whitelists from `ROLES`/`PERMISSION_TAGS`); `resolveInviteMetadata`
  for safe webhook parsing with fallback-to-defaults.
- `apps/api/src/lib/clerk.ts` — `ClerkInvitationClient` injectable interface +
  `createDefaultClerkInvitationClient()` (mirrors `ClerkUserStore` pattern).
- `apps/api/src/routers/admin.ts` — `admin.inviteUser` (`fullAdminProcedure`):
  calls Clerk API with `publicMetadata: { role, tags }`, writes `Create`/`Invitation`
  audit row, returns `{ invitationId, status, url }`.
  `admin.linkGuardian` (`fullAdminProcedure`): validates user is `Parent`, idempotent
  via `create` + P2002 catch; audit row only on actual creation.
- `apps/api/src/routers/clerkWebhook.ts` — extended to read pre-stamped role/tags
  from `public_metadata` via `resolveInviteMetadata`. Find-then-branch replaces
  upsert: role/tags set on first sync only; re-syncs touch PII only.

**Tests (23 new):** 14 domain (`inviteUserInput`/`linkGuardianInput`/`resolveInviteMetadata`);
9 admin router (FORBIDDEN, BAD_REQUEST zod, happy path with audit, idempotent no-op,
NOT_FOUND, non-Parent). Webhook tests updated for find-then-branch + 4 new metadata cases.

### PR-1.6 — `feat(domain): student CRUD + subject assignment` ✅ MERGED

- `apps/api/src/routers/student.ts` — `student.create`, `student.update`,
  `student.list`, `student.byId`, `student.assignSubject`, `student.setCurrentPace`.
- Full-admin only for writes; Supervisor can list and read by id.
- PII fields (`fullName`, `dob`, `address`) encrypted on write; `nameBidx` computed.
- `student.list` / `student.byId` decrypt in-request; write one `DecryptPii`
  `AuditLog` row per request (not per row) to avoid log spam.
- Subject assignment validates active subject, is idempotent on duplicate assignment,
  and writes audit rows only for actual create/update operations.

**Tests (4 new):** create → list round-trip with encrypted storage + decryption;
Supervisor read allowed / write denied; audit rows for create + decrypt batch;
subject assignment idempotency, inactive/missing subject, missing student, and
missing PACE assignment errors.

### PR-1.7 — `feat(web): Head admin screens` ✅ MERGED

- `apps/web/src/app/(admin)/students/page.tsx` — list + name search.
- `apps/web/src/app/(admin)/students/new/page.tsx` — create form (react-hook-form + zod + shadcn).
- `apps/web/src/app/(admin)/students/[id]/page.tsx` — edit + assign subjects + link guardian.
- `apps/web/src/app/(admin)/staff/page.tsx` — invite staff/parent form.
- `<RequireFullAdmin>` server component gates all admin routes (404 for non-admins).

**Tests (Playwright):** Head logs in → creates student → assigns Maths →
invites parent → links guardian.

### PR-1.7.5 — `feat(web): align Head admin screens with design handoff` 🚧 IN PROGRESS

Branch: `feat/phase-1-pr1.7.5-design-conversion`

Scope: convert the screens built in PR-1.7 to the UI system supplied in
`design/Oasis Learning Center-handoff.zip`, without changing the Phase 1 data
flow or adding unrelated features.

- `apps/web/src/app/(admin)/admin/layout.tsx` — use the handoff's staff-portal
  shell: navy sidebar on desktop, mobile header and bottom nav, Oasis logo, and
  staff role context.
- `apps/web/src/app/(admin)/admin/admin.css` — replace the interim green admin
  theme with the handoff palette: navy, blue, crimson, pale blue background,
  tighter cards, badges, tables, inputs, and buttons.
- `apps/web/src/app/(admin)/admin/page.tsx` — add a small dashboard landing
  surface matching the prototype instead of redirecting to `/admin/students`.
- `apps/web/src/app/(admin)/admin/students/...` — update student list/detail
  treatment with avatars, status badges, profile heading, and design-aligned
  form controls.
- `apps/web/src/app/(admin)/admin/staff/...` — align account invitation screen
  headers and forms with the same design language.

**Verification target:** `pnpm lint`, `pnpm typecheck`, `pnpm test`,
`pnpm --filter @oasis/web build`, then `graphify update .`.

### PR-1.8 — `feat(audit): audit-log viewer + Phase 1 verification suite`

- `apps/web/src/app/(admin)/audit/page.tsx` — paginated, filterable audit log (full-admin only).
- `apps/api/src/routers/audit.ts` — read-only, full-admin only.
- `pnpm verify:encryption` script — runs `pg_dump --data-only` on the test DB and
  asserts no plaintext name/email/dob appears. Wired into CI as a final job.
- E2E test of full Sprint-2 flow against Supabase preview database.

**Sprint 2 demo checkpoint:** Head invites parent → parent accepts via Clerk →
Head creates student, links guardian, assigns 6 ACE subjects → audit log shows
every step → `pnpm verify:encryption` green.

---

## Critical files

### Modified in Phase 1

| File                                           | PR     | Change                                                    |
| ---------------------------------------------- | ------ | --------------------------------------------------------- |
| `packages/db/src/encryption.ts`                | 1.1    | env-key provider, versioned format                        |
| `packages/db/package.json`                     | 1.1    | drop `@aws-sdk/client-kms`                                |
| `.env.example`                                 | 1.1    | new env var names                                         |
| `apps/api/src/context.ts`                      | 1.4 ✅ | Clerk session + RLS session vars, `applyRlsTx`            |
| `apps/api/src/trpc.ts`                         | 1.4 ✅ | `auditedProcedure`, `fullAdminProcedure`, `roleProcedure` |
| `apps/api/src/routers/student.ts`              | 1.6 ✅ | student CRUD + subject assignment                         |
| `apps/api/src/routers/health.ts`               | 1.4 ✅ | `me` endpoint                                             |
| `docs/runbook.md`                              | 1.2    | Supabase setup, env-key rotation procedure                |
| `docs/adr/0005-pii-envelope-encryption-kms.md` | 1.1    | marked Superseded                                         |

### Created in Phase 1

| File                                               | PR     |
| -------------------------------------------------- | ------ |
| `docs/adr/0006-pii-envelope-encryption-env-key.md` | 1.1    |
| `packages/db/src/__tests__/encryption.test.ts`     | 1.1    |
| `packages/db/scripts/apply-rls.ts`                 | 1.2    |
| `packages/domain/src/users.ts`                     | 1.5 ✅ |
| `apps/api/src/routers/admin.ts`                    | 1.5 ✅ |
| `apps/api/src/routers/clerkWebhook.ts`             | 1.3    |
| `apps/api/src/routers/audit.ts`                    | 1.8    |
| `apps/web/src/middleware.ts`                       | 1.3    |
| `apps/web/src/app/(auth)/...`                      | 1.3    |
| `apps/web/src/app/(admin)/students/...`            | 1.7    |
| `apps/web/src/app/(admin)/staff/page.tsx`          | 1.7    |
| `apps/web/src/app/(admin)/audit/page.tsx`          | 1.8    |
| `apps/api/src/__tests__/trpc.middleware.test.ts`   | 1.4 ✅ |
| `apps/api/scripts/smoke-context-rls.ts`            | 1.4 ✅ |
| `apps/api/src/__tests__/student.router.test.ts`    | 1.6 ✅ |

### Reused without modification (do not duplicate)

- `packages/domain/src/rbac.ts` — `isFullAdmin`, `requireFullAdmin`, `requireRole`,
  `requireOwnChild`, `requireSelfStudent`, `AccessDeniedError`
- `packages/db/prisma/schema.prisma` — schema v1, unchanged in Phase 1
- `packages/db/prisma/rls.sql` — RLS policies, applied by the new script

---

## Verification

### Per PR (CI gates)

- `pnpm lint && pnpm typecheck && pnpm test` — must pass on every PR.
- `pnpm db:integration` (PR-1.2 onward) — Postgres + RLS smoke.

### End of Phase 1

1. `pnpm verify:encryption` — `pg_dump` of Supabase preview shows zero plaintext names/emails/DOBs.
2. RLS proof — Supervisor session tRPC call for Sensitive `BehaviourEntry` returns empty.
3. Playwright e2e — Sprint-2 Head onboarding flow green on Supabase preview database.
4. Audit log — webhook upsert, student create, subject assign, guardian link, PII decrypt all recorded.
5. 2FA scaffolding present (route + `requires2fa` field) but login without TOTP still reaches `/admin`.

---

## Out of scope for Phase 1

- Attendance, behaviour, PACE, merit ledger (Phase 2)
- 2FA enforcement (Phase 5)
- Mobile auth screens beyond a smoke check (Phase 2)
- KMS promotion — revisit only if centre outgrows free-tier limits
