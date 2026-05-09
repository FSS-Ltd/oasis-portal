# Phase 3 - Parent portal + communications: sprint & PR plan

**Status:** Parent dashboard polish ready for review
**Last updated:** 2026-05-08
**Parent plan:** [`/oasis-platform-plan.md`](/oasis-platform-plan.md) Delivery phases
**Project context:** [`/PROJECT_Oasis_Context.md`](/PROJECT_Oasis_Context.md)

---

## Context

Phase 3 turns the operational staff system into a parent-facing portal with
professional communication boundaries. Some foundation work was pulled forward
to make the centre usable:

- PR #41 added the parent shell and linked-child drill-through view.
- PRs #50-#58 added Resend email infrastructure, branded invite emails,
  deliverability hardening, resend/retry flows, and production diagnostics.
- PR #63 added the parent initial registration flow.
- PR #64 added the child-registration prompt for adult non-parent accounts.

The remaining work is parent dashboard polish, notices, parent-Head messaging,
notification hooks, mobile smoke, and phase verification.

---

## Acceptance criteria

Phase 3 is complete when:

1. Parent users land on a useful `/parent` dashboard after sign-in.
2. Linked parents can see only their own children.
3. Parent child views include attendance, PACE progress, General behaviour,
   visible notes, and current merit balance summary.
4. Parent initial registration is available for Parent accounts and adult staff
   accounts that confirm they have children at Oasis.
5. Duplicate first registration and duplicate linked-child registration are
   blocked.
6. Staff notices can be posted by full-admin users and read by staff users with
   read receipts.
7. Parent-Head messaging supports thread list, open/create, send, and read
   views without leaking messages across parents or children.
8. Email hooks exist for registration confirmation, new messages, and relevant
   staff notices where appropriate.
9. Parent mobile smoke proves the typed API supports sign-in, child overview,
   notices, and messages.
10. End-of-phase checks pass: `pnpm lint`, `pnpm typecheck`, `pnpm test`,
    `pnpm --filter @oasis/web build`, DB/RLS checks, and credentialed
    Playwright where credentials are configured.

---

## Sprint 1 - Retrospective parent foundations

Goal: record already-merged work so future Phase 3 PRs build on it instead of
duplicating it.

### PR-3.0 - `feat(web): parent shell and linked-child view` MERGED

Merged via PR #41 on 2026-05-01.

Scope:

- Added `/parent` and `/parent/children/[id]`.
- Allowed linked parents to view child drill-through data for their own
  children only.
- Included attendance calendar, PACE progress, General behaviour, visible
  notes, and merit balances from the existing child-log read model.
- Preserved Sensitive behaviour restriction on parent surfaces.

Tests:

- Parent linked-child access allowed.
- Unlinked parent access denied.
- Sensitive behaviour remains hidden from parent views.
- Web typecheck/lint/build.

### PR-3.1 - `feat(email): Resend transactional invite foundation` MERGED

Merged across PRs #50-#58 between 2026-05-02 and 2026-05-03.

Scope:

- Added Resend email client and smoke tooling.
- Sent user invites through Resend using Clerk-generated links.
- Added branded React Email templates and text fallbacks.
- Added resend/retry paths for failed invitations.
- Added deliverability runbook notes and sanitized production diagnostics.
- Normalised quoted `RESEND_FROM` values and restored server-side email
  rendering in production.

Tests:

- API email router tests.
- Invite/resend admin router tests.
- `pnpm --filter @oasis/api email:smoke` in environments with production email
  variables.
- Build/typecheck/lint checks from the merged branches.

### PR-3.2 - `feat(web): parent initial registration` MERGED

Merged via PR #63 on 2026-05-05.

Scope:

- Added `/registration` for Parent initial registration.
- Captured guardian contacts, emergency contacts, pickup contacts, student
  profiles, consents, agreement data, and home address.
- Stored registration PII encrypted at rest.
- Created linked Student and Guardian records during first registration.
- Added Head/admin read access for registration details from student records.

Tests:

- Domain registration validation.
- API registration router coverage for happy path, duplicate prevention, PII
  encryption/decryption, and admin lookup.
- Web build/typecheck/lint.

### PR-3.3 - `feat(auth): child-registration prompt for non-parent adults` MERGED

Merged via PR #64 on 2026-05-05.

Scope:

- Added child-registration prompt status to local users.
- Routed eligible non-parent adult accounts through `/children-check`.
- Allowed staff/full-admin style adult accounts to confirm whether they have
  children at Oasis.
- Allowed confirmed adult accounts with children to use initial registration.
- Preserved not-ready routing for unsupported account states.

Tests:

- Domain RBAC tests for prompt eligibility and registration permission.
- API registration/admin tests for prompt answer and registration access.
- Web route guard/build checks.

---

## Sprint 2 - Parent dashboard and profile polish

Goal: make the parent portal an intentional product surface rather than only a
child-detail route.

### PR-3.4 - `feat(web): parent dashboard polish` MERGED

Working branch: `feat/phase-3-pr3.4-parent-dashboard-polish`.

Merged via PR #81 on 2026-05-08.

Scope:

- Replace the basic parent landing page with a dashboard listing linked
  children, recent attendance, recent General behaviour, PACE progress summary,
  and visible notes.
- Added `childLog.parentDashboard` as a focused parent dashboard read model for
  linked active children, General behaviour, visible notes, PACE summaries, and
  merit balances.
- Add clear empty states for no linked children, pending registration, and
  completed registration awaiting centre review.
- Add parent profile access using the existing `profile.me` and
  `profile.updateMe` procedures.
- Keep parent data read-only except for own profile updates and registration.
- Do not add messaging or notices in this PR.

Tests:

- Parent with linked children sees only their children.
- Parent with no linked children sees registration/not-ready state.
- Parent profile update saves allowed fields and audits the update.
- Sensitive behaviour is not rendered.

Verification:

- `pnpm --filter @oasis/api test -- childNotes.router.test.ts profile.router.test.ts registration.router.test.ts`
- `pnpm --filter @oasis/api typecheck`
- `pnpm --filter @oasis/web typecheck`
- `pnpm lint`
- `pnpm --filter @oasis/web build`
- Browser verification on `/parent` with the local Next.js dev server.

---

## Sprint 3 - Staff noticeboard

Goal: create a staff announcement channel with read receipts before parent
messaging expands the communication model.

### PR-3.5 - `feat(api): staff notices and read receipts` MERGED

Working branch: `feat/phase-3-pr3.5-staff-notices`.

Merged via PR #82 on 2026-05-08.

Scope:

- Implement `notice.listForStaff`, `notice.post`, and `notice.markRead`.
- Allow full-admin users to create active staff notices.
- Allow full-admin and Supervisor users to read notices.
- Added active/expiry filtering for staff notices; expired and inactive notices
  are unavailable to list and read-receipt calls.
- Record read receipts per user/notice and make `markRead` idempotent.
- Encrypt notice body in `StaffNotice.bodyEnc`.
- Audit post and read-receipt actions.

Tests:

- Full-admin can post notices; Supervisor cannot post.
- Staff can list active non-expired notices with caller read state.
- Expired or inactive notices are excluded.
- Parent/Student/ClubsAdmin/TechnicalSupport are denied unless later policy
  changes.
- `markRead` is idempotent and scoped to the caller.
- Audit rows are written for post and read receipt.

Verification:

- `pnpm db:generate`
- `pnpm --filter @oasis/api test -- notice.router.test.ts`
- `pnpm --filter @oasis/api typecheck`
- `pnpm --filter @oasis/web typecheck`
- `pnpm lint`
- `pnpm typecheck`
- `graphify update .`
- `pnpm docs:component-map`
- `git diff --check`

### PR-3.6 - `feat(web): staff noticeboard UI` READY FOR REVIEW

Working branch: `feat/phase-3-pr3.6-staff-noticeboard-ui`.

Scope:

- Add noticeboard views to admin and supervisor shells.
- Show unread/read state and a mark-read action.
- Add Head/admin notice composer with title/body validation and pending state.
- Surface a notice summary on the Supervisor dashboard where useful.
- Keep parent notices out of scope until parent communication policy is
  explicitly expanded.

Tests:

- Admin can compose and publish a notice.
- Supervisor sees notices and can mark them read.
- Read state persists after refresh.
- Unsupported roles cannot access staff notice pages.

Verification:

- `pnpm --filter @oasis/api test -- notice.router.test.ts`
- `pnpm --filter @oasis/web typecheck`
- `pnpm lint`
- `pnpm --filter @oasis/web build`
- `pnpm --filter @oasis/web test:e2e`
- `graphify update .`
- `pnpm docs:component-map`
- `git diff --check`

---

## Sprint 4 - Parent-Head messaging

Goal: move parent communication out of WhatsApp and into audited portal threads.

### PR-3.7 - `feat(api): parent messaging threads` PLANNED

Scope:

- Implement `message.listThreads`, `message.openThread`, `message.send`, and
  `message.listInThread`.
- Allow parents to open/send/list only their own threads.
- Allow full-admin users to view and respond to parent threads.
- Encrypt message body.
- Audit thread creation and message sends.
- Keep group announcements and file attachments out of scope.

Tests:

- Parent opens a thread and sends a message.
- Full-admin can respond.
- Parent cannot read or send into another parent's thread.
- Supervisor/ClubsAdmin/Student are denied unless future policy changes.
- Message body is encrypted at rest.
- Audit rows are written.

### PR-3.8 - `feat(web): parent and admin messaging UI` PLANNED

Scope:

- Add parent inbox/thread UI under `/parent`.
- Add admin inbox/thread UI under `/admin`.
- Show empty, loading, error, and pending-send states.
- Add email notification hook for new parent/admin replies using the Resend
  infrastructure.
- Keep push notifications deferred until Phase 5 or a dedicated notifications
  phase.

Tests:

- Parent creates a thread and sends a message.
- Admin sees the thread and replies.
- Parent sees the reply.
- Cross-parent thread URLs are denied.
- Email notification path is covered by focused API/template tests.

Verification:

- `pnpm --filter @oasis/api test -- message.router.test.ts email.router.test.ts`
- `pnpm --filter @oasis/web typecheck`
- `pnpm lint`
- `pnpm --filter @oasis/web build`

---

## Sprint 5 - Mobile smoke and phase verification

### PR-3.9 - `feat(mobile): parent portal smoke` PLANNED

Scope:

- Add minimal mobile parent surface using the typed tRPC client.
- Cover child list, child overview, notices, and messages.
- Keep styling thin and workflow-focused; production mobile polish remains Phase 5.

Tests:

- Mobile typecheck.
- Manual or automated smoke for parent sign-in, child list, child detail,
  notices, and messages.

### PR-3.10 - `test: Phase 3 verification suite` PLANNED

Scope:

- Add or update Playwright coverage for parent dashboard, registration,
  notices, and messaging.
- Re-run API/domain tests for registration, notices, messages, child log,
  profile, email, and RBAC.
- Re-run DB/RLS and encryption verification.
- Update this plan with merged status and carry-forward items.

Verification:

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm --filter @oasis/web build`
- `pnpm db:integration`
- `pnpm api:smoke-context-rls`
- `pnpm verify:encryption`
- Credentialed Playwright where local/preview credentials are available.

---

## Assumptions and defaults

- Parent portal remains read-only for child academic/attendance/behaviour data.
- Parents can update only their own profile and registration data during
  registration workflows.
- Sensitive behaviour remains hidden from parents.
- Message attachments, bulk announcements, and push notifications stay deferred.
- Existing Resend infrastructure is reused; no new email provider is added.
