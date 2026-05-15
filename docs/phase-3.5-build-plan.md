# Phase 3.5 - Clubs module: sprint & PR plan

**Status:** PR-3.5.6 verification suite in progress
**Last updated:** 2026-05-15
**Parent plan:** [`/oasis-platform-plan.md`](/oasis-platform-plan.md) Delivery phases
**Project context:** [`/PROJECT_Oasis_Context.md`](/PROJECT_Oasis_Context.md)

---

## Context

Phase 3.5 delivers the deliberately minimal clubs module requested for v1:
tracking clubs, parent signups, rosters, and notifications. The Prisma schema
and typed placeholder router already exist, but the `club` API currently returns
`NOT_IMPLEMENTED`.

This phase is intentionally narrow. It does not include club payments, club
attendance, shop integration, automated waiting lists, or advanced scheduling.

---

## Acceptance criteria

Phase 3.5 is complete when:

1. Full-admin users, including Head, and ClubsAdmin users can create, update,
   deactivate, and list clubs.
2. Parents can sign up and withdraw only their own linked children.
3. Full-admin users, including Head, and ClubsAdmin users can view signup rosters.
4. Club capacity is enforced when configured.
5. Duplicate active signups are prevented.
6. Club notifications can be sent to guardians of signed-up students.
7. Notification bodies are encrypted if stored, and notification send actions
   are audited.
8. ClubsAdmin has no access to academic, behaviour, PACE, attendance, or
   financial data outside the club module.
9. Mobile smoke proves parent signup and ClubsAdmin/staff roster reads use the
   same typed API.
10. End-of-phase checks pass: `pnpm lint`, `pnpm typecheck`, `pnpm test`,
    `pnpm --filter @oasis/web build`, DB/RLS smoke, and encryption verification.

---

## Sprint 1 - Clubs API

Goal: implement the backend contract first with strict RBAC and tests.

### PR-3.5.0 - `feat(api): club management and signups` MERGED

Merged via PR #96 on 2026-05-11.

Scope:

- Implement `club.list`, `club.create`, `club.update`, `club.signUp`,
  `club.withdraw`, and any roster read needed by the web UI.
- Use `requireClubsAdminOrFullAdmin` for club management.
- Allow Parent signups only for linked children; full-admin can sign up any
  active student if needed for centre admin correction.
- Enforce active club, active student, optional capacity, and one active signup
  per student/club.
- Preserve historical withdrawn signup records instead of hard deleting.
- Audit create/update/deactivate/signup/withdraw actions.

Tests:

- Full-admin users, including Head, and ClubsAdmin can create/update/deactivate
  clubs.
- Supervisor/Parent/Student cannot manage clubs.
- Parent can sign up own linked child and cannot sign up another child.
- Full-admin can sign up any active student.
- Duplicate active signup and full club are rejected.
- Withdraw is idempotent for an active signup and denied for unrelated parents.
- Audit rows are written.

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

- `pnpm --filter @oasis/api test -- club.router.test.ts` ran the full API suite
  because of the package script's argument handling; all 18 API files and 317
  tests passed, then Vitest reported an unrelated Prisma native-engine load
  error from `audit.router.test.ts`.

---

## Sprint 2 - Clubs web surfaces

Goal: expose the module to ClubsAdmin/full-admin users and parents without
crossing data boundaries.

### PR-3.5.1 - `feat(web): ClubsAdmin club management` MERGED

Merged via PR #103 on 2026-05-11.

Scope:

- Add Head/full-admin and ClubsAdmin-accessible route group or admin-shell route
  for club management.
- Route ClubsAdmin users to `/admin/clubs` after sign-in.
- List active/inactive clubs with schedule, capacity, and signup count.
- Add create/update/deactivate controls with validation and pending/error
  states.
- Add roster view showing signed-up students with minimal required display data.
- Do not show academic, behaviour, PACE, attendance, or financial detail on
  club roster rows.

Tests:

- Head/full-admin and ClubsAdmin can access the club management route.
- Head/full-admin and ClubsAdmin can create/update/deactivate a club.
- Supervisor/Parent cannot access club management routes.
- Roster displays signup count and minimal student identity.

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

### PR-3.5.2 - `feat(web): parent club signup` MERGED

Merged via PR #105 on 2026-05-11.

Scope:

- Add parent clubs page listing active clubs.
- Add linked-child club signup pages for Parent, Supervisor, and full-admin
  users with linked children.
- Allow Parents and linked-child staff/admin guardians to sign up and withdraw
  only their own linked children.
- Preserve full-admin correction access for direct API signup of any active
  student.
- Show capacity/full states, already-signed-up states, and empty linked-child
  states.
- Add one per-family spouse invite from the self-profile surface. The spouse is
  invited as a Parent account and is automatically linked to the inviting
  user's active linked children when the Clerk invite is accepted, bypassing the
  initial registration flow.
- Keep signup flow simple: no payments, attendance, or document uploads.

Tests:

- Parent signs up a linked child.
- Supervisor with linked children signs up a linked child.
- Parent withdraws a linked child from a club.
- Supervisor with linked children withdraws a linked child from a club.
- Parent/Supervisor cannot sign up another parent's child by direct route/API
  call.
- Full club disables signup and direct API call is rejected.
- Spouse invite rejects an existing linked second Parent for the family.
- Spouse invite rejects an already-pending family invite or existing user email.
- Clerk webhook acceptance creates spouse guardian links.

Verification:

- `pnpm --filter @oasis/db generate` - pass.
- `pnpm with-env pnpm --filter @oasis/db exec prisma validate` - pass.
- `pnpm --filter @oasis/db typecheck` - pass.
- `pnpm --filter @oasis/domain test -- rbac.test.ts clubs.test.ts` - pass,
  ran all domain tests because of package-script argument handling: 12 files /
  145 tests.
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

- Paddle is treated as a normal active club record surfaced through
  `club.linkedChildSignupContext`; no club is hard-coded in the web UI.
- The spouse invite limit is enforced across the inviting adult's active linked
  child IDs. Existing linked Parent guardians and pending spouse invitations
  block another invite for the same family.
- Clerk invite acceptance now creates missing guardian links for the accepted
  Parent user so post-sign-in can use the existing linked-child bypass.

---

## Sprint 3 - Club notifications

Goal: let club admins send simple notifications to guardians of signed-up
students.

### PR-3.5.3 - `feat(api): club notifications` MERGED

Merged via PR #110 on 2026-05-12.

Scope:

- Implement `club.notify`.
- Allow full-admin and ClubsAdmin users to send notifications for active clubs.
- Resolve recipients from active club signups and guardian links.
- Store notification title/body and sent metadata; encrypt body if stored as
  free text.
- Send email through existing Resend infrastructure when recipient email is
  available.
- Audit send attempt, recipient count, and delivery failures without logging
  plaintext recipient PII.

Tests:

- ClubsAdmin can send to guardians for active signups.
- Inactive club notification is rejected.
- Empty recipient list returns a typed no-recipient response or typed error.
- Parent/Supervisor cannot send club notifications.
- Email failure is surfaced and audited without leaking PII.

### PR-3.5.4 - `feat(web): club notification UI` MERGED

Merged via PR #112 on 2026-05-12.

Scope:

- Add `club.notifications` history query for club managers, returning title,
  sent time, and sender display only.
- Add notification composer to club management detail/roster view.
- Show recipient count, pending state, success state, and error state.
- Show sent notification history without exposing recipient PII beyond allowed
  roster context.

Tests:

- ClubsAdmin sends a notification.
- Empty/no-recipient state is visible.
- Delivery error is shown without raw provider details.

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

---

## Sprint 4 - Mobile smoke and phase verification

### PR-3.5.5 - `feat(mobile): clubs smoke` MERGED

Merged via PR #121 on 2026-05-13.

Scope:

- Add minimal mobile surfaces for parent club list/signup and ClubsAdmin/staff
  roster read smoke.
- Keep styling minimal and use the typed API client.
- Stick to design guidelines set in Oasis Learning Center.zip
- Use the existing parent and staff smoke shells; do not add new backend
  endpoints or mobile dependencies.

Tests:

- Mobile typecheck.
- Mobile lint.
- Expo iOS export.
- Manual or automated smoke for listing clubs, parent signup, withdrawal, and
  roster read.

Verification:

- `pnpm --filter @oasis/mobile typecheck` - pass.
- `pnpm --filter @oasis/mobile lint` - pass.
- `pnpm --filter @oasis/mobile exec expo export --platform ios --output-dir /tmp/oasis-mobile-clubs-smoke-export` -
  pass.
- `git diff --check` - pass.
- `graphify update .` - pass.

Notes:

- Manual live-account mobile smoke was not run because local Parent and
  ClubsAdmin mobile credentials were not configured in this environment.
- Follow-up mobile admin visibility fix merged via PR #128 on 2026-05-14. It
  surfaced club-manager access from the staff mobile dashboard while keeping
  Supervisor dashboard data loading out of the club-manager path.

### PR-3.5.6 - `test: Phase 3.5 verification suite` IN PROGRESS

Scope:

- Add end-to-end web checks for club management, parent signup, withdrawal, and
  notification flow where credentials are configured.
- Re-run API/domain tests for clubs, users, RBAC, email, and parent linked-child
  access.
- Re-run DB/RLS and encryption verification.
- Update this plan with merged status and carry-forward items.

Verification:

- `pnpm --filter @oasis/web test:e2e -- phase-3-5-clubs.spec.ts` - pass
  after sandbox escalation for the local web server bind; 6 credential-gated
  tests skipped because local E2E account variables are not configured.
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

- Run credential-gated web club management, parent signup/withdrawal, and
  notification paths in an environment with `E2E_HEAD_EMAIL`,
  `E2E_HEAD_PASSWORD`, `E2E_CLUBS_ADMIN_EMAIL`,
  `E2E_CLUBS_ADMIN_PASSWORD`, `E2E_SUPERVISOR_EMAIL`,
  `E2E_SUPERVISOR_PASSWORD`, `E2E_PARENT_EMAIL`, and
  `E2E_PARENT_PASSWORD` configured.

---

## Assumptions and defaults

- ClubsAdmin is limited to clubs. Do not grant academic, attendance, behaviour,
  PACE, parent messaging, or finance access through this module.
- Club signup is tracking only for v1.
- Club payments, attendance, waitlists, and calendar sync are out of scope.
- Existing Resend infrastructure is reused for notification email.
