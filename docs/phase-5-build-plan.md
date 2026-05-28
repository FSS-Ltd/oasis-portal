# Phase 5 - QA, hardening, rollout: sprint & PR plan

**Status:** Hardening foundations partially pre-built; launch work planned
**Last updated:** 2026-05-28
**Parent plan:** [`/oasis-platform-plan.md`](/oasis-platform-plan.md) Delivery phases
**Project context:** [`/PROJECT_Oasis_Context.md`](/PROJECT_Oasis_Context.md)

---

## Context

Phase 5 turns the MVP into a launchable service for the centre. Some production
readiness work has already landed because the portal needed to run for the
centre before the remaining sprints resumed:

- PR #44 added Supabase SSR helpers and GitHub Actions/Vercel CI/CD.
- PRs #45-#49 fixed production Prisma/Vercel/Supabase runtime and CI issues.
- PRs #50-#58 added and hardened Resend invite email delivery.
- PR #59 and PR #61 stabilised post-sign-in routing and Clerk handoff.
- PR #60 and PR #62 added/fixed admin lifecycle controls.

The remaining Phase 5 work is enabling the feature-flagged 2FA enforcement
after the Clerk Pro upgrade, observability, GDPR paperwork, backup/restore
drills, web/API e2e coverage, Phase 6 mobile dependency tracking, training,
UAT, and launch closeout.

Phase 6 now owns the production mobile build, mobile e2e harness, production
mobile journeys, and EAS internal build configuration. Phase 5 consumes those
outputs as launch gates instead of adding new mobile screens or smoke-only
coverage here.

---

## Acceptance criteria

Phase 5 is complete when:

1. 2FA is enforced for all roles that can access the portal.
2. Production and preview deploy paths are documented and reproducible.
3. Runtime logs, error reporting, and operational alerts are configured for the
   app's real failure modes.
4. GDPR/privacy documents are ready: privacy notice, data retention policy,
   DPIA, and processor register/DPA tracking for Clerk, Supabase, Vercel, and
   Resend.
5. Backup and restore procedures are tested on non-production data.
6. Security review covers RBAC, RLS, Sensitive behaviour, PII encryption,
   invitation flows, registration, finance/shop paths, and parent scoping.
7. Web e2e coverage exists for critical Head, Supervisor, Parent, ClubsAdmin,
   shopkeeper/shopadmin, and report workflows.
8. Phase 6 mobile production build has either passed closeout or has an
   explicit launch-blocking deferral approved by Jean-Fidele.
9. EAS internal builds from Phase 6 install on target devices.
10. Staff training, UAT, and rollout plan are complete.
11. Final launch gate passes without unresolved P0/P1 risks.

---

## Sprint 1 - Retrospective production hardening

Goal: keep the already-merged hardening work visible so future Phase 5 work
does not repeat it.

### PR-5.0 - `chore: Supabase and Vercel CI/CD foundation` MERGED

Merged via PR #44 on 2026-05-01.

Scope:

- Added Supabase browser/server client helpers.
- Added GitHub Actions Vercel preview/production deploy workflow.
- Added Vercel secret preflight checks.
- Added build-time environment handling for Vercel/Turborepo strict env mode.
- Updated runbook with required GitHub/Vercel/Supabase deployment settings.

Verification:

- `pnpm --filter @oasis/web typecheck`
- `pnpm --filter @oasis/web build`
- `git diff --check`
- Vercel preview/prod deploy dry runs from CI changes.

### PR-5.1 - `fix: production Prisma and Supabase runtime stability` MERGED

Merged via PRs #45-#49 between 2026-05-01 and 2026-05-02.

Scope:

- Included Prisma runtime/query engine assets in Vercel bundles.
- Normalised Supabase transaction-pooler runtime URLs for Prisma.
- Fixed CI service container environment handling.
- Documented production runtime database requirements.

Tests:

- Web build.
- API/domain typecheck where relevant.
- CI DB jobs.

### PR-5.2 - `feat(email): production invite email hardening` MERGED

Merged via PRs #50-#58 between 2026-05-02 and 2026-05-03.

Scope:

- Added Resend smoke tooling, branded invitation templates, retry/resend flows,
  deliverability documentation, sanitized diagnostics, and sender normalisation.
- Restored server-side React Email rendering in production.

Tests:

- API email tests.
- Admin invitation/resend tests.
- Resend smoke checks in configured environments.

### PR-5.3 - `fix(auth): post-sign-in handoff stability` MERGED

Merged via PRs #59 and #61 on 2026-05-04.

Scope:

- Forced Clerk invitation acceptance and home-page authenticated redirects
  through the role-aware `/post-sign-in` flow.
- Split public client handoff from server-side role resolver.
- Preserved admin/supervisor/parent/not-ready routing boundaries.
- Tightened route guards so expected access denials become 404 while unexpected
  failures bubble.

Tests:

- Domain post-sign-in routing tests.
- Web typecheck/lint/build.
- Focused Playwright coverage for unauthenticated and credential-gated paths.

### PR-5.4 - `feat(web): admin lifecycle hardening` MERGED

Merged via PR #60 and PR #62 on 2026-05-04.

Scope:

- Added user deactivate/reactivate and student archive/restore controls.
- Fixed action visibility.
- Preserved audit history and avoided hard deletion.

Tests:

- API lifecycle tests.
- Web typecheck/lint/build.
- Browser smoke for admin route protection.

---

## Sprint 2 - 2FA enforcement and auth security

### PR-5.5 - `security(auth): enforce 2FA for portal access` MERGED

Merged via PR #191 on 2026-05-27.

Scope:

- Reapplied the existing 2FA enforcement path onto current `origin/main`.
- Kept enforcement disabled by default behind `OASIS_ENFORCE_2FA=false` until
  Clerk is upgraded to Pro.
- Parse Clerk second-factor state from `factorVerificationAge` /
  `sessionClaims.fva`.
- Prevent app-route and tRPC access when `OASIS_ENFORCE_2FA=true` and the Clerk
  session has not satisfied 2FA.
- Keep webhook, public auth, and setup routes callable.
- Document recovery and support process for locked-out staff/parents in the
  runbook.

Tests:

- Feature flag defaults off so current portal access remains unchanged before
  the Clerk Pro upgrade.
- With the flag enabled, a user without completed 2FA is redirected to the 2FA
  flow.
- With the flag enabled, a user with completed 2FA reaches role-specific portal.
- With the flag enabled, API tRPC calls reject unsatisfied 2FA sessions.
- Webhook route remains callable.
- TechnicalSupport recovery flow is documented and scoped.

Verification:

- `pnpm --filter @oasis/api test -- trpc.middleware.test.ts`
- `pnpm --filter @oasis/domain test -- rbac.test.ts`
- `pnpm --filter @oasis/web typecheck`
- `pnpm lint`
- `pnpm --filter @oasis/web build`
- Credentialed Clerk smoke in preview after the Clerk Pro upgrade and flag
  enablement.

---

## Sprint 3 - Observability and incident readiness

### PR-5.6 - `chore(obs): runtime logging and error monitoring` READY FOR REVIEW

Scope:

- Configure Sentry error reporting for the Next.js web/API runtime. Phase 6
  remains the owner for production mobile observability.
- Add structured server logs for auth handoff failures, invite failures, email
  sends, tRPC failures, and audit-write failures.
- Add health/runbook links for common production incidents.
- Avoid logging decrypted PII, raw tokens, Clerk secrets, Resend keys, or raw
  email addresses where not needed.
- Add alerting for production error spikes and failed background jobs once jobs
  exist.

Tests:

- Logging helper unit tests if helpers are added.
- API/web typecheck and web build after Sentry instrumentation is wired.
- Manual smoke that a known safe error appears in the selected monitoring tool.
- Secret/PII log scan of changed code.

### PR-5.7 - `docs: incident runbooks and backup restore drill` PLANNED

Scope:

- Expand `docs/runbook.md` for backup restore, invite resend incidents, auth
  lockouts, email deliverability, Prisma/Vercel runtime failures, RLS failures,
  and ledger reconciliation.
- Document restore procedure against non-production data.
- Run and record a non-production backup/restore drill.
- Confirm `verify:encryption` after restore.

Verification:

- `pnpm exec prettier --check docs/runbook.md`
- Non-production restore drill evidence recorded in the runbook or launch notes.
- `pnpm verify:encryption` against restored non-production data where feasible.

---

## Sprint 4 - GDPR and security review

### PR-5.8 - `docs: GDPR launch pack` PLANNED

Scope:

- Draft privacy notice, data retention policy, DPIA, processor register, and DPA
  tracking notes.
- Cover children's data, parent/guardian data, staff data, encrypted database
  dumps, audit logs, retention, deletion/archive policy, and subprocessors.
- Link operational controls in `docs/runbook.md`.

Verification:

- Markdown formatting check.
- Human review required before external publication.

### PR-5.9 - `security: launch security review fixes` PLANNED

Scope:

- Run a targeted security review against RBAC, RLS, Sensitive behaviour, PII
  encryption, registration, invitation, parent scoping, clubs, shop, finance,
  reports, and file/email paths.
- Fix issues found in review on focused branches or explicitly defer with risk
  notes.
- Re-run DB/RLS and encryption verification.

Tests:

- Focused regression tests for every fixed issue.
- Direct-call API denial tests for permission boundaries.
- RLS smoke confirms Sensitive behaviour protection.

Verification:

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm db:integration`
- `pnpm api:smoke-context-rls`
- `pnpm verify:encryption`

---

## Sprint 5 - Full automated verification

### PR-5.10 - `test: launch e2e coverage` PLANNED

Scope:

- Add or complete credentialed Playwright coverage for:
  Head onboarding/configuration, Supervisor daily workflow, parent registration,
  parent child view, notices, messaging, clubs, shop, leaderboards, reports, and
  lifecycle controls.
- Keep credential-gated tests skipped cleanly when env vars are missing.
- Add seeded state helpers where needed to avoid brittle UI setup.
- Confirm Phase 6 owns mobile automation and record the Phase 6 dependency in
  launch notes rather than adding new smoke-only mobile coverage here.

Verification:

- `pnpm --filter @oasis/web test:e2e`
- `pnpm --filter @oasis/mobile typecheck`
- Phase 6 mobile e2e or UAT status recorded as a launch dependency.

### PR-5.11 - `test: launch quality gate` PLANNED

Scope:

- Run the complete launch quality gate and fix failures.
- Confirm no changed files show editor red lines.
- Confirm no unresolved scaffold copy remains in production routes.
- Confirm no app route exposes `NOT_IMPLEMENTED` for in-scope v1 workflows.

Verification:

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm --filter @oasis/web build`
- `pnpm --filter @oasis/mobile typecheck`
- `pnpm db:integration`
- `pnpm api:smoke-context-rls`
- `pnpm verify:encryption`
- `git diff --check`

---

## Sprint 6 - Mobile verification, UAT, and launch

### PR-5.12 - `chore(mobile): verify Phase 6 internal builds for launch` PLANNED

Scope:

- Do not configure EAS here; Phase 6 PR-6.21 owns EAS profiles and build
  commands.
- Verify the Phase 6 iOS TestFlight/internal and Android internal artifacts.
- Install on Head and Supervisor target devices.
- Record device smoke checklist results and known limitations in launch notes.

Tests:

- Phase 6 mobile typecheck/lint status reviewed.
- Manual install and login smoke on target devices.
- Supervisor, Parent, and Student smoke paths as applicable.

### PR-5.13 - `docs: staff training and UAT plan` PLANNED

Scope:

- Create staff training checklist for Head, Supervisor, TechnicalSupport,
  ClubsAdmin, shopkeeper/shopadmin, and parent onboarding.
- Create UAT script for a centre half-day workflow.
- Define paper-parallel reconciliation period and sign-off criteria.
- Record how defects are triaged during pilot.

Verification:

- Human review by Jean-Fidele and centre owner.
- UAT script dry-run against preview or staging.

### PR-5.14 - `chore: launch closeout` PLANNED

Scope:

- Confirm all phase plans reflect final launch state.
- Confirm production env values, domains, Clerk redirects, Resend sender, and
  Supabase connection roles.
- Confirm backup/restore, encryption dump verification, and RLS smoke.
- Confirm final known risks and deferred work.
- Prepare release notes and rollback plan.

Verification:

- Full launch quality gate from PR-5.11.
- Production smoke after deployment.
- Human approval before full switch-over.

---

## Assumptions and defaults

- 2FA is mandatory for every portal role at launch.
- Production deployment remains GitHub Actions plus Vercel prebuilt deploy.
- Supabase runtime connection must use a non-owner, non-`BYPASSRLS` role.
- Production PII keys and peppers remain in secret storage only.
- Human review is required before publishing GDPR documents or sending launch
  communications externally.
