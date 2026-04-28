# Phase 2 - Daily workflows: sprint & PR plan

**Status:** Planned - PR-2.0 documentation kickoff in progress  
**Last updated:** 2026-04-28  
**Parent plan:** [`/oasis-platform-plan.md`](/oasis-platform-plan.md) §Delivery phases  
**Project context:** [`/PROJECT_Oasis_Context.md`](/PROJECT_Oasis_Context.md)

---

## Context

Phase 1 is complete and merged through PR-1.9. The platform now has real Clerk
auth through tRPC, encrypted student and user PII, Supabase/Postgres RLS,
Head-admin onboarding, guardian linking, subject assignment, an audit viewer,
and encryption dump verification.

Phase 2 turns that foundation into the daily staff workflow:

- Attendance capture for today's students.
- Behaviour logging with General/Sensitive enforcement.
- PACE progress and test score entry.
- Supervisor home screen with quick actions.
- Thin mobile supervisor smoke flow after the web workflow is stable.

The Phase 2 scope deliberately excludes Parent portal, messaging, noticeboard,
clubs UI, shop, reports, leaderboards, and full merit economy UI. Those remain
Phase 3+ unless needed for focused RBAC or verification coverage.

---

## Acceptance criteria

Phase 2 is complete when:

1. Full-admin and Supervisor users can record attendance, behaviour, and PACE
   progress for active students from the web supervisor workflow.
2. Attendance writes are idempotent per student/date and audited.
3. Behaviour logging encrypts notes, enforces Sensitive visibility in API and
   RLS, fixes demerits at -5, and creates linked Spend ledger rows.
4. PACE recording validates assigned subjects, stores test scores, and advances
   `StudentSubject.currentPaceNumber` when appropriate.
5. Supervisor cannot read Sensitive behaviour after saving it.
6. Mobile has a minimal daily-workflow smoke surface wired to the typed API
   client.
7. End-of-phase verification passes:
   `pnpm lint`, `pnpm typecheck`, `pnpm test`,
   `pnpm --filter @oasis/web build`, DB/RLS sensitive-behaviour checks, and the
   opt-in Playwright workflow where credentials are available.

---

## Sprint 1 - API daily-workflow foundations

Goal: backend procedures are production-shaped before UI work begins.

### PR-2.0 - `docs: plan Phase 2 daily workflows` 🚧 IN PROGRESS

Branch: `docs/phase-2-daily-workflows-plan`

Scope:

- Create this Phase 2 tracking document.
- Fix stale PR-1.9 wording in Phase 1 docs/context.
- Add Phase 2 as the current phase plan in `oasis-platform-plan.md`.
- Record acceptance criteria and PR order.
- No product code.

Verification:

- `pnpm lint`
- `pnpm typecheck`

### PR-2.1 - `feat(api): attendance workflow` ⏳ PLANNED

Scope:

- Implement `attendance.forDate` and `attendance.mark`.
- Allow full-admin and Supervisor to read and mark attendance.
- Defer Parent/Student attendance reads to Phase 3.
- Upsert by `(studentId, date)`.
- Reject inactive or missing students.
- Audit create and update outcomes.

Tests:

- RBAC: full-admin/Supervisor allowed; Parent/Student denied.
- Upsert creates once, then updates status for the same student/date.
- `forDate` returns only active students and their status for the requested date.
- Missing and inactive student cases return typed errors.
- Audit rows are written for create/update.

### PR-2.2 - `feat(api): behaviour logging with sensitive enforcement` ⏳ PLANNED

Scope:

- Implement `behaviour.log` and `behaviour.listForStudent`.
- Allow full-admin and Supervisor to create behaviour entries.
- Full-admin reads General and Sensitive entries.
- Supervisor reads General entries only.
- Encrypt `noteEnc`.
- Force Demerit entries to `meritDelta = -5`.
- Require positive Merit amount for Merit entries.
- Create linked Spend `MeritLedger` rows for merit/demerit entries.
- Audit creation, Sensitive reads, PII decrypts, and denied access.

Tests:

- RBAC for create/read.
- Supervisor cannot read Sensitive entries.
- Notes are encrypted at rest and decrypted only after access checks.
- Merit and demerit ledger coupling is correct.
- RLS smoke still proves Sensitive rows are hidden from Supervisor.
- Audit rows cover create, `ReadSensitive`, `DecryptSensitive`, and denied
  access paths.

### PR-2.3 - `feat(api): PACE progress and test scores` ⏳ PLANNED

Scope:

- Implement `pace.forStudent` and `pace.record`.
- Allow full-admin and Supervisor to read and record PACE progress.
- Validate the student has the requested subject assigned.
- Store `PaceRecord` with optional self-test score, PACE test score, and
  completion date.
- Advance `StudentSubject.currentPaceNumber` when a completed/tested PACE is
  equal to or beyond the current assignment.
- Audit PACE record creation and current-PACE updates.

Tests:

- RBAC for read/write.
- Score bounds and missing assignment validation.
- Recording a completed PACE advances current PACE.
- Recording an older PACE does not move the current assignment backward.
- Audit rows are written for records and assignment updates.

---

## Sprint 2 - Web supervisor workflow

Goal: staff can complete the daily workflow from the browser without touching
Head-admin onboarding screens.

### PR-2.4 - `feat(web): supervisor daily dashboard shell` ⏳ PLANNED

Scope:

- Add `/supervisor` route group.
- Gate it for Supervisor plus full-admin parity.
- Build a dashboard showing today's active students and quick actions for
  attendance, behaviour, and PACE.
- Reuse the existing staff-portal visual system while labelling the workflow as
  Supervisor.
- Keep future Phase 3/4 modules visible only as disabled or non-routed items if
  needed for layout continuity.

Tests:

- Playwright smoke for allowed route access.
- Non-staff roles cannot access the supervisor shell.
- Dashboard renders active students and empty state.

### PR-2.5 - `feat(web): attendance capture UI` ⏳ PLANNED

Scope:

- Add date selector and roster attendance controls.
- Support Present, Absent, and Late.
- Keep row state stable while saving.
- Show save errors without clearing the selected status.

Tests:

- Playwright flow marks attendance for a student.
- Status remains visible after save.
- API error state is surfaced in the row.

### PR-2.6 - `feat(web): behaviour and PACE entry UI` ⏳ PLANNED

Scope:

- Add behaviour form with General/Sensitive toggle, category, note,
  Merit/Demerit handling, and amount for Merit only.
- Add PACE form with subject, PACE number, self-test score, PACE test score,
  and completion date.
- Ensure Supervisor never sees Sensitive entries after save.

Tests:

- Playwright flow logs General behaviour and sees it in the student activity.
- Playwright flow logs Sensitive behaviour as Supervisor and does not see the
  Sensitive row afterward.
- Playwright flow records PACE progress and sees the current PACE advance.

---

## Sprint 3 - Mobile smoke and phase verification

Goal: prove the same typed API supports the mobile daily workflow, then close
Phase 2 with an end-to-end verification story.

### PR-2.7 - `feat(mobile): Phase 2 supervisor workflow smoke` ⏳ PLANNED

Scope:

- Wire mobile supervisor screens to the typed API client.
- Add minimal surfaces for attendance, behaviour, and PACE entry.
- Keep styling thin and workflow-focused; deeper mobile polish follows the
  stable web workflow.
- Document manual verification if emulator automation is not ready.

Tests:

- Mobile typecheck passes.
- Smoke test or documented manual check covers attendance, behaviour, and PACE
  calls.

### PR-2.8 - `test: Phase 2 verification suite` ⏳ PLANNED

Scope:

- Add end-to-end daily workflow coverage:
  attendance -> behaviour -> PACE -> audit visibility.
- Re-run DB/RLS checks for Sensitive behaviour.
- Update `PROJECT_Oasis_Context.md` and this plan with completion status,
  verification output, and carry-forward items.
- Run `graphify update .` after code changes.

Verification:

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm --filter @oasis/web build`
- `pnpm db:integration`
- `pnpm api:smoke-context-rls`
- Phase 2 Playwright workflow, opt-in where Clerk credentials are required.

---

## Assumptions and defaults

- Each implementation PR starts from its own named branch and keeps one coherent
  PR scope.
- Existing Prisma schema is sufficient for Phase 2; no migration is expected
  unless implementation reveals a real schema gap.
- Parent and Student reads remain Phase 3+.
- Full-admin roles retain parity with Supervisor daily workflow access.
- Credentialed Clerk Playwright remains opt-in via `E2E_HEAD_EMAIL` and
  `E2E_HEAD_PASSWORD`.
- Centre policy questions about shopkeeper/shopadmin/leaderboard-admin tags,
  tithe default, VAT, and parent behaviour visibility are not blockers for
  Phase 2 API and supervisor workflow work.
