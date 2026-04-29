# Phase 2 - Daily workflows: sprint & PR plan

**Status:** In progress - PR-2.1 attendance workflow
**Last updated:** 2026-04-29
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
- CSV export for staff and student attendance, gated by a Head-assigned
  permission tag.
- Behaviour logging with General/Sensitive enforcement.
- Rota planning, staff availability, and approved shift swaps.
- UK school-year automation and Head-managed year-group bands.
- Head-managed subjects, per-subject starting PACE numbers, PACE progress, and
  test score entry.
- Configurable PACE test-limit rules with supervisor warnings and hard blocks.
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
3. Full-admin users and users with the `attendance-exporter` tag can export
   student and staff attendance records as CSV for a selected date range.
4. Behaviour logging encrypts notes, enforces Sensitive visibility in API and
   RLS, fixes demerits at -5, and creates linked Spend ledger rows.
5. Staff can set weekly availability, view their own rota, and request shift
   swaps; rota changes from swaps are applied only after Head of Centre
   approval.
6. Head of Centre can schedule staff, assign them to configured year-group
   bands, and choose a colour per band so the rota is easy to scan.
7. Student creation/edit defaults the school year from date of birth using the
   England/Wales academic-year cutoff of 31 August, with manual override for
   exceptional cases.
8. Head of Centre can create named year-group bands from standard school years:
   Nursery, Reception, and Year 1 through Year 13.
9. Head of Centre can create/deactivate subjects and set each student's initial
   current PACE number per subject.
10. PACE recording validates assigned subjects, stores self-test and final PACE
   test scores by subject/PACE number, and advances only that subject's
   `StudentSubject.currentPaceNumber` after a passing final PACE test.
11. Configurable PACE test-limit rules block excess daily tests and block a
   self test plus final test for the same student/subject/PACE on the same day
   when enabled; Supervisors see warnings before and at the block.
12. Supervisor cannot read Sensitive behaviour after saving it.
13. Mobile has a minimal daily-workflow smoke surface wired to the typed API
   client.
14. End-of-phase verification passes:
   `pnpm lint`, `pnpm typecheck`, `pnpm test`,
   `pnpm --filter @oasis/web build`, DB/RLS sensitive-behaviour checks, and the
   opt-in Playwright workflow where credentials are available.

---

## Sprint 1 - API daily-workflow foundations

Goal: backend procedures are production-shaped before UI work begins.

### PR-2.0 - `docs: plan Phase 2 daily workflows` ✅ MERGED

Branch: `docs/phase-2-rota-academics-plan`

Scope:

- Create this Phase 2 tracking document.
- Fix stale PR-1.9 wording in Phase 1 docs/context.
- Add Phase 2 as the current phase plan in `oasis-platform-plan.md`.
- Record acceptance criteria and PR order.
- No product code.

Verification:

- `pnpm lint`
- `pnpm typecheck`

### PR-2.1 - `feat(api): attendance workflow` 🚧 IN PROGRESS

Branch: `feat/phase-2-pr2.1-attendance-workflow`

Scope:

- Implement `attendance.forDate` and `attendance.mark`.
- Implement CSV export procedure for student attendance.
- Allow full-admin and Supervisor to read and mark attendance.
- Allow only full-admin and users tagged `attendance-exporter` to export
  student attendance CSV files.
- Defer Parent/Student attendance reads to Phase 3.
- Defer staff attendance CSV export until staff rota and attendance data exist
  after PR-2.4.
- Upsert by `(studentId, date)`.
- Reject inactive or missing students.
- Audit create, update, and export outcomes.

Tests:

- RBAC: full-admin/Supervisor allowed; Parent/Student denied.
- Export RBAC: full-admin and `attendance-exporter` allowed; untagged
  Supervisor, Parent, and Student denied.
- Upsert creates once, then updates status for the same student/date.
- `forDate` returns only active students and their status for the requested date.
- Student CSV exports include the requested date range, attendance status,
  student display name, and recorded timestamp.
- Missing and inactive student cases return typed errors.
- Audit rows are written for create/update/export.

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

### PR-2.3 - `feat(domain): UK school years and centre groups` ⏳ PLANNED

Scope:

- Add a pure domain helper that derives the England/Wales school year from date
  of birth using the 31 August academic-year cutoff.
- Support the standard year labels: Nursery, Reception, and Year 1 through Year
  13.
- Update student create/edit planning so the calculated year is the default,
  while keeping Head override available.
- Add Head-managed year-group bands with `name`, selected standard years,
  active state, sort order, and display colour.
- Seed/default Oasis bands:
  `Lower Primary` = Reception + Year 1,
  `Upper Primary` = Year 2 through Year 6,
  `Secondary` = Year 7 through Year 13.
- Audit create/update/deactivate actions for centre group configuration.

Tests:

- School-year calculation around 31 August and 1 September boundaries.
- Nursery, Reception, Year 1, Year 11, and Year 13 representative cases.
- Full-admin can create/update/deactivate year-group bands; Supervisor cannot.
- Duplicate or empty group names are rejected.
- Group year selections must use standard year labels only.

### PR-2.4 - `feat(api): staff rota and availability workflow` ⏳ PLANNED

Scope:

- Add rota models for staff weekly availability, scheduled shifts, and shift
  swap requests, plus the staff attendance data needed for staff attendance
  export.
- Allow active staff users to set their recurring availability by day of week
  and view their own rota.
- Allow full-admin users to schedule staff for dates/times and assign a shift
  to one configured year-group band.
- Store the selected band colour with the band, not the staff member, so rota
  colour means "where" rather than "who".
- Allow staff to request a shift swap with another staff member.
- Require full-admin approval before a shift swap changes the published rota.
- Audit availability changes, shift creation/update, swap requests, approvals,
  rejections, and staff attendance export once staff attendance records exist.

Tests:

- Staff can manage their own availability and cannot edit someone else's.
- Full-admin can create/update shifts and assign a configured band.
- Supervisor can read own rota but cannot schedule staff.
- Shift swap request does not alter rota before approval.
- Approval atomically updates the affected shifts and marks the request
  approved.
- Rejection leaves shifts unchanged.

### PR-2.5 - `feat(api): subject management and PACE test rules` ⏳ PLANNED

Scope:

- Add Head-managed subject create/update/deactivate procedures.
- Keep subject assignment per student/subject with an initial/current PACE
  number; students may be on different PACE numbers in different subjects.
- Add centre-level PACE policy configuration:
  daily test limit enabled/disabled, maximum tests per student per day,
  same-subject same-PACE self/final same-day block enabled/disabled, and pass
  threshold.
- Split PACE recording semantics into self test and final PACE test, while
  preserving clear mapping to `PaceRecord`.
- Block recording when an enabled policy would be violated.
- Advance only the relevant `StudentSubject.currentPaceNumber` when a passing
  final PACE test is recorded for the current or later PACE number.
- Audit PACE record creation, blocked attempts, policy changes, and current-PACE
  updates.

Tests:

- Full-admin can create/deactivate subjects; Supervisor cannot.
- Score bounds, missing assignment, inactive subject, and inactive student
  validation.
- A passing final PACE test advances only the matching subject.
- Older PACE records and self tests do not move the current assignment
  backward or forward.
- Daily test limit blocks when enabled and does not block when disabled.
- Self test plus final test for the same student/subject/PACE/day blocks when
  enabled and does not block when disabled.
- Audit rows are written for successful records, blocked attempts, policy
  changes, and assignment updates.

### PR-2.6 - `feat(api): PACE progress read model` ⏳ PLANNED

Scope:

- Implement `pace.forStudent` and `pace.record`.
- Allow full-admin and Supervisor to read and record PACE progress.
- Return assigned subjects, current PACE numbers, recent test records, today's
  test count, and policy state needed for UI warnings.
- Use the PR-2.5 write rules for `pace.record`.
- Keep the response small enough for mobile daily workflow use.

Tests:

- RBAC for read/write.
- Read model includes per-subject current PACE and recent records.
- Read model includes daily test count and enabled policy limits.
- Supervisor can read assigned PACE data for active students.
- Parent and Student access remains deferred.

---

## Sprint 2 - Head-admin configuration workflow

Goal: Head of Centre can configure the daily workflow before Supervisors use it.

### PR-2.7 - `feat(web): Head academic settings` ⏳ PLANNED

Scope:

- Add Head-admin screens for standard school-year review, year-group band
  management, and band colour selection.
- Update student create/edit UI so date of birth defaults the school year using
  the UK helper, while preserving a manual override select.
- Add subject management screens for creating, editing, deactivating subjects,
  and setting a student's initial/current PACE per subject.
- Add PACE policy settings for enabling/disabling daily limits, setting maximum
  tests per day, enabling/disabling same-day self/final block, and setting the
  pass threshold.

Tests:

- Playwright flow calculates a school year from date of birth and allows manual
  override.
- Playwright flow creates/updates a year-group band and colour.
- Playwright flow creates/deactivates a subject.
- Playwright flow configures PACE policy limits.

### PR-2.8 - `feat(web): Head rota scheduler` ⏳ PLANNED

Scope:

- Add Head-admin rota scheduler view by week.
- Show configured year-group band colours in the schedule.
- Allow Head to assign staff to a date/time and year-group band.
- Add staff availability view so scheduling can compare availability with
  assigned shifts.
- Add shift-swap approval queue with approve/reject actions.

Tests:

- Playwright flow schedules staff into a coloured year-group band.
- Playwright flow shows staff availability alongside rota assignment.
- Playwright flow approves a shift swap and sees the rota update.
- Playwright flow rejects a shift swap and sees the rota remain unchanged.

---

## Sprint 3 - Web supervisor workflow

Goal: staff can complete the daily workflow from the browser without touching
Head-admin onboarding screens.

### PR-2.9 - `feat(web): supervisor daily dashboard shell` ⏳ PLANNED

Scope:

- Add `/supervisor` route group.
- Gate it for Supervisor plus full-admin parity.
- Build a dashboard showing today's active students and quick actions for
  attendance, behaviour, PACE, and rota.
- Show the logged-in staff member's schedule for today and this week.
- Allow staff to maintain weekly availability and request shift swaps.
- Reuse the existing staff-portal visual system while labelling the workflow as
  Supervisor.
- Keep future Phase 3/4 modules visible only as disabled or non-routed items if
  needed for layout continuity.

Tests:

- Playwright smoke for allowed route access.
- Non-staff roles cannot access the supervisor shell.
- Dashboard renders active students and empty state.
- Dashboard renders staff rota and availability empty state.
- Staff can submit a shift swap request without changing the published rota.

### PR-2.10 - `feat(web): attendance capture UI` ⏳ PLANNED

Scope:

- Add date selector and roster attendance controls.
- Support Present, Absent, and Late.
- Filter or group students by configured year-group bands.
- Add daily student CSV export controls visible only to full-admin or users with
  the `attendance-exporter` tag.
- Keep row state stable while saving.
- Show save errors without clearing the selected status.

Tests:

- Playwright flow marks attendance for a student.
- Status remains visible after save.
- API error state is surfaced in the row.
- Configured year-group band filter changes the visible student set.
- Tagged export users can download the daily student attendance CSV file.
- Untagged Supervisors do not see export controls and are denied if they call
  the export endpoint directly.

### PR-2.11 - `feat(web): behaviour and PACE entry UI` ⏳ PLANNED

Scope:

- Add behaviour form with General/Sensitive toggle, category, note,
  Merit/Demerit handling, and amount for Merit only.
- Add PACE form with subject, PACE number, test type, score, and completion
  date.
- Show current PACE independently per subject.
- Show warnings when a student is near or at the configured daily test limit.
- Show hard-block messages when an enabled policy prevents recording.
- Ensure Supervisor never sees Sensitive entries after save.

Tests:

- Playwright flow logs General behaviour and sees it in the student activity.
- Playwright flow logs Sensitive behaviour as Supervisor and does not see the
  Sensitive row afterward.
- Playwright flow records a passing final PACE test and sees only the matching
  subject advance.
- Playwright flow shows daily-limit warnings and blocked-state messages.

---

## Sprint 4 - Mobile smoke, attendance export, and phase verification

Goal: prove the same typed API supports the mobile daily workflow, then close
Phase 2 with an end-to-end verification story.

### PR-2.12 - `feat(mobile): Phase 2 supervisor workflow smoke` ⏳ PLANNED

Scope:

- Wire mobile supervisor screens to the typed API client.
- Add minimal surfaces for rota view, attendance, behaviour, and PACE entry.
- Surface PACE policy warning/block responses from the API.
- Keep styling thin and workflow-focused; deeper mobile polish follows the
  stable web workflow.
- Document manual verification if emulator automation is not ready.

Tests:

- Mobile typecheck passes.
- Smoke test or documented manual check covers rota, attendance, behaviour, and
  PACE calls.

### PR-2.13 - `test: Phase 2 verification suite` ⏳ PLANNED

Scope:

- Add end-to-end daily workflow coverage:
  rota -> attendance -> behaviour -> PACE -> audit visibility.
- Add end-to-end Head-admin coverage for year-group bands, subject management,
  PACE policy settings, and rota scheduling.
- Add export coverage for student attendance CSV, staff attendance CSV, and
  `attendance-exporter` tag enforcement. Staff attendance CSV coverage belongs
  here after the PR-2.4 staff rota/attendance model exists.
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

### PR-2.14 - `feat(web): attendance export centre` ⏳ PLANNED

Scope:

- Add a Head-admin attendance export page for date-range exports.
- Provide separate export controls for student attendance and staff attendance.
- Each export control has a dropdown to choose all individuals or one
  individual.
- Student export supports all students or one selected student.
- Staff export supports all staff or one selected staff member once staff
  attendance data exists.
- Show export controls only to full-admin users and users with the
  `attendance-exporter` tag.
- Audit export attempts and successful exports with date range, export kind,
  selected individual/all, and row count.

Tests:

- Full-admin can export all student attendance for a date range.
- Full-admin can export one selected student's attendance for a date range.
- Tagged `attendance-exporter` user can export student and staff attendance.
- Untagged Supervisor cannot see export controls and direct calls are denied.
- Staff export supports all staff and one selected staff member after staff
  attendance records exist.
- CSV headers and row counts match the selected date range and individual/all
  filter.
- Audit rows are written for successful exports and denied attempts.

---

## Assumptions and defaults

- Each implementation PR starts from its own named branch and keeps one coherent
  PR scope.
- The expanded rota, year-group band, subject-management, and PACE policy scope
  requires Prisma schema migrations during Phase 2.
- "UK standard grades" means England/Wales school years: Nursery, Reception,
  and Year 1 through Year 13.
- School-year calculation uses the academic year starting 1 September and the
  child's age on 31 August.
- Parent and Student reads remain Phase 3+.
- Full-admin roles retain parity with Supervisor daily workflow access.
- The `attendance-exporter` tag grants CSV export access only; it does not grant
  broader attendance editing, student management, rota scheduling, or Sensitive
  behaviour access.
- Rota colours belong to configured year-group bands, not individual staff
  members.
- Test-limit rules apply only to recorded PACE tests, not attendance or
  behaviour entries.
- Credentialed Clerk Playwright remains opt-in via `E2E_HEAD_EMAIL` and
  `E2E_HEAD_PASSWORD`.
- Centre policy questions about shopkeeper/shopadmin/leaderboard-admin tags,
  tithe default, VAT, and parent behaviour visibility are not blockers for
  Phase 2 API and supervisor workflow work.
