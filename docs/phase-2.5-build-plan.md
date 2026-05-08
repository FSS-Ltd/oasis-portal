# Phase 2.5 - People records + attendance exports: sprint & PR plan

**Status:** Phase 2.5 verification ready for review
**Last updated:** 2026-05-08
**Parent plan:** [`/oasis-platform-plan.md`](/oasis-platform-plan.md) Delivery phases
**Project context:** [`/PROJECT_Oasis_Context.md`](/PROJECT_Oasis_Context.md)

---

## Context

Phase 2.5 sits between daily workflow capture and the parent/comms phase. Its
purpose is to make the existing staff/admin surfaces operationally useful for
centre management: people records, controlled staff access, lifecycle actions,
and attendance export/history.

Several MVP-readiness branches already landed before this plan was split out:

- PR #40 extracted reusable web UI primitives and feature-local components.
- PR #41 added the student drill-through MVP and parent linked-child view.
- PR #42 added People & Profiles and fixed PACE workflow ID validation.
- PR #51 added the TechnicalSupport account administration role.
- PR #60 and PR #62 added and fixed guarded admin lifecycle controls.

The remaining Phase 2.5 work is focused on attendance exports and individual
attendance history. Parent messaging, noticeboard, clubs, merit economy, shop,
reports, and rollout hardening stay in later phase plans.

---

## Acceptance criteria

Phase 2.5 is complete when:

1. Head/full-admin users can manage student, staff, parent, pending invitation,
   and TechnicalSupport account records from People & Profiles.
2. TechnicalSupport can safely manage only Parent and TechnicalSupport account
   shells.
3. Head/full-admin users can deactivate/reactivate user accounts and
   archive/restore students without hard deletion.
4. Student drill-through is available to full-admin users, linked parents, and
   tagged staff through `student-drillthrough-viewer`.
5. Parent drill-through exposes only linked children and does not leak Sensitive
   behaviour.
6. Attendance export centre supports date-range student and staff exports for
   all records or a selected individual.
7. Student and staff detail pages expose attendance history and scoped export
   actions.
8. Export controls and direct API calls are limited to full-admin users and
   users with `attendance-exporter`.
9. Export attempts, successful exports, lifecycle actions, and sensitive reads
   are audited.
10. End-of-phase checks pass: `pnpm lint`, `pnpm typecheck`, `pnpm test`,
    `pnpm --filter @oasis/web build`, `pnpm db:integration`,
    `pnpm api:smoke-context-rls`, and `pnpm verify:encryption`.

---

## Sprint 1 - Retrospective MVP foundations

Goal: record the already-merged work so future agents do not re-plan or
duplicate it.

### PR-2.5.0 - `refactor(web): reusable UI primitives` MERGED

Merged via PR #40 on 2026-05-01.

Scope:

- Added shared web UI primitives for tables, badges, avatars, empty states,
  panels, stat cards, motion wrappers, and display helpers.
- Replaced repeated table/card markup in admin, attendance, audit, staff, child
  snapshot, academic settings, and rota surfaces.
- Kept tRPC contracts, RBAC, routes, schema, and product behaviour unchanged.

Verification:

- `pnpm --filter @oasis/web typecheck`
- `pnpm lint`
- `pnpm --filter @oasis/web build`
- `pnpm --filter @oasis/web test:e2e -- supervisor-dashboard.spec.ts`
- `git diff --check`

### PR-2.5.1 - `feat(web): student drill-through and parent child view` MERGED

Merged via PR #41 on 2026-05-01.

Scope:

- Added `student-drillthrough-viewer` permission tag and Head-only controls for
  granting/removing it.
- Added child-log drill-through APIs for accessible students, current academic
  year attendance, behaviour, PACE results, and merit balances.
- Replaced the admin student detail route with drill-through first, while
  keeping Head-only edit/profile tools available.
- Added `/parent` and `/parent/children/[id]` for linked-parent viewing.
- Added attendance calendar and Notes tab backed by existing child notes.
- Kept Sensitive behaviour visible only to Head on this surface; linked parents
  and tagged staff receive General behaviour only.

Tests:

- RBAC coverage for `student-drillthrough-viewer` and linked-parent access.
- API coverage for child notes, behaviour, and student drill-through data.
- Web typecheck, lint, and build.

### PR-2.5.2 - `feat(web): People & Profiles` MERGED

Merged via PR #42 on 2026-05-01.

Scope:

- Added People & Profiles surfaces for student, user, parent, pending
  invitation, and profile details.
- Removed user-facing scaffold/build-progress wording.
- Relaxed PACE workflow ID validation to accept non-empty database IDs where
  the seeded/test database does not use CUID-like values.

Tests:

- Web/API typecheck.
- Relevant API router tests for profile/student/PACE behaviour.
- Web build.

### PR-2.5.3 - `feat(auth): TechnicalSupport account administration` MERGED

Merged via PR #51 on 2026-05-02.

Scope:

- Added `TechnicalSupport` role.
- Allowed TechnicalSupport to manage only Parent and TechnicalSupport account
  shells.
- Preserved full-admin parity for Head, Principal, Pastor, and HeadOfDiscipline.
- Updated account invitation, access management, post-sign-in routing, and tests
  for the new role.

Tests:

- Domain RBAC tests.
- Admin router tests for allowed and denied account-management paths.
- Web typecheck/lint/build.

### PR-2.5.4 - `feat(web): admin lifecycle controls` MERGED

Merged via PR #60 and fixed via PR #62 on 2026-05-04.

Scope:

- Added confirmation-gated user deactivation/reactivation.
- Added student archive/restore actions using soft state, not hard deletion.
- Added Head-only active/archived/all filters for the student directory.
- Ensured lifecycle controls render where admins need them.

Tests:

- Web typecheck, lint, and build.
- API tests for lifecycle mutation and account-management rules.
- Browser smoke for protected admin routes.

---

## Sprint 2 - Attendance export centre

Goal: give Head/full-admin and `attendance-exporter` users one reliable place to
export student and staff attendance.

### PR-2.5.5 - `feat(web): attendance export centre` MERGED

Merged via PR #71 on 2026-05-07.

Scope:

- Add `/admin/attendance/exports` or the existing admin attendance page section
  for date-range export controls.
- Provide separate controls for student attendance and staff attendance.
- Allow "all" or one selected student/staff member for each export kind.
- Reuse existing attendance export procedures where possible; add selector
  inputs only where the API currently supports all-record exports.
- Show export controls only to full-admin users and `attendance-exporter` users.
- Audit successful exports and denied attempts with export kind, date range,
  selected individual/all, row count, and actor.

Tests:

- Full-admin exports all student attendance and one student's attendance.
- Full-admin exports all staff attendance and one staff member's attendance.
- Tagged `attendance-exporter` user can export student and staff attendance.
- Untagged Supervisor does not see controls and direct API calls are denied.
- CSV headers, row counts, and date range filtering match the selected scope.
- Audit rows are written for successful and denied export attempts.

Verification:

- `pnpm --filter @oasis/api test -- attendance.router.test.ts`
- `pnpm --filter @oasis/api typecheck`
- `pnpm --filter @oasis/web typecheck`
- `pnpm lint`
- `pnpm --filter @oasis/web build`

### PR-2.5.6 - `feat(web): individual attendance history` MERGED

Merged via PR #72 on 2026-05-07.

Scope:

- Add attendance history panels to student and staff detail surfaces.
- Support date range filtering and empty states.
- Expose scoped export action from each detail page.
- Do not expose attendance history or attendance export from parent detail
  pages.
- Keep all PII decryption and audit patterns consistent with current
  student/staff/profile code.
- Added focused `attendance.studentHistory` and `attendance.staffHistory`
  queries for export-authorised users without changing existing CSV export
  contracts.

Tests:

- Student detail shows attendance history for the selected range.
- Staff detail shows staff attendance history for the selected range.
- Parent detail does not render attendance history or export controls.
- Scoped export buttons generate the same CSV shape as the export centre.
- Archive/inactive state is represented without losing historical attendance.
- API coverage confirms export-authorised access, denied direct calls, invalid
  ranges, and archived/inactive historical rows.

Verification:

- `pnpm --filter @oasis/api test -- attendance.router.test.ts`
- `pnpm --filter @oasis/web typecheck`
- `pnpm --filter @oasis/api typecheck`
- `pnpm lint`
- `pnpm --filter @oasis/web build`
- `graphify update .`

---

## Sprint 3 - Phase 2.5 verification

Goal: close people/export work without weakening the security baseline.

### PR-2.5.7 - `test: Phase 2.5 access and export verification` READY FOR REVIEW

Working branch: `test-phase-2.5-pr2.5.7-access-export-verification`.

Scope:

- Added focused Playwright coverage for People & Profiles access boundaries and
  attendance export controls where seeded/credentialed state is available.
- Added API tests for export selectors, selected direct-call denial metadata,
  invalid ranges, inactive/archived selected exports, lifecycle audit metadata,
  self-deactivation denial, and archived student profile reads.
- Re-ran DB/RLS smoke and encryption dump verification.
- Carried forward no Phase 2.5 product work; this PR is verification-only.

Verification:

- `pnpm --filter @oasis/api test -- attendance.router.test.ts admin.router.test.ts student.router.test.ts`
- `pnpm --filter @oasis/web test:e2e`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm --filter @oasis/web build`
- `pnpm db:integration`
- `pnpm api:smoke-context-rls`
- `pnpm verify:encryption`
- `graphify update .`

---

## Assumptions and defaults

- Phase 2.5 does not add new product modules.
- Parent-facing communications remain Phase 3.
- Clubs remain Phase 3.5.
- Merit wallet, shop, leaderboards, and reports remain Phase 4.
- `attendance-exporter` grants export only; it does not grant attendance
  editing, account management, lifecycle controls, or Sensitive access.
- Student archive/restore remains a soft state change on existing records.
