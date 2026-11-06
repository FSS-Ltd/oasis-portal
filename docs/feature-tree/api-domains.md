# API domain subfeatures

Source-backed baseline, 2026-11-05. Each row is an existing procedure, not proof that every promised product behavior is implemented. All entries are `partial` until behavior and all consumers are audited. Each procedure inherits uses/depends_on `INF-auth` and `INF-db`; its used_by relationship is the root appRouter namespace and matching typed clients. Permission boundaries must be read at the referenced procedure. Graph lookup uses the same source path.

## API-accountDeletion

Purpose: owns `accountDeletion.*` in [accountDeletionRouter](../../apps/api/src/routers/accountDeletion.ts). Status: partial. Canonical reuse point: extend this router.

uses / depends_on: `INF-auth`, `INF-db`; shared domains and services must be verified at imports. used_by: `appRouter.accountDeletion` [root](../../apps/api/src/router.ts).

Client consumers: [deletion-requests-panel.tsx](<../../apps/web/src/app/(admin)/admin/staff/_components/deletion-requests-panel.tsx>), [account-deletion-card.tsx](../../apps/mobile/src/components/core/account-deletion-card.tsx)

Tests: [accountDeletion.router.test.ts](../../apps/api/src/__tests__/accountDeletion.router.test.ts)

| Stable subfeature ID | Canonical symbol and entry | Status |
| -------------------- | -------------------------- | ------ |

## API-admin

Purpose: owns `admin.*` in [adminRouter](../../apps/api/src/routers/admin.ts). Status: partial. Canonical reuse point: extend this router.

uses / depends_on: `INF-auth`, `INF-db`; shared domains and services must be verified at imports. used_by: `appRouter.admin` [root](../../apps/api/src/router.ts).

Client consumers: [admin-homework-client.tsx](../../apps/web/src/components/homework/admin-homework-client.tsx), [access-invite-form.tsx](<../../apps/web/src/app/(admin)/admin/access/access-invite-form.tsx>), [access-account-panel.tsx](<../../apps/web/src/app/(admin)/admin/access/access-account-panel.tsx>), [access-management-client.tsx](<../../apps/web/src/app/(admin)/admin/access/access-management-client.tsx>), [academic-settings-client.tsx](<../../apps/web/src/app/(admin)/admin/academic/academic-settings-client.tsx>), [rota-scheduler-client.tsx](<../../apps/web/src/app/(admin)/admin/rota/rota-scheduler-client.tsx>), [pending-invite-resend-action.tsx](<../../apps/web/src/app/(admin)/admin/_components/pending-invite-resend-action.tsx>), [pending-invite-delete-action.tsx](<../../apps/web/src/app/(admin)/admin/_components/pending-invite-delete-action.tsx>), [student-portal-readiness-client.tsx](<../../apps/web/src/app/(admin)/admin/student-portal/student-portal-readiness-client.tsx>), [invite-user-form.tsx](<../../apps/web/src/app/(admin)/admin/staff/invite-user-form.tsx>), [user-tag-manager.tsx](<../../apps/web/src/app/(admin)/admin/staff/user-tag-manager.tsx>), [people-profiles-client.tsx](<../../apps/web/src/app/(admin)/admin/staff/people-profiles-client.tsx>), [account-access-panel.tsx](<../../apps/web/src/app/(admin)/admin/staff/_components/account-access-panel.tsx>), [user-profile-panel.tsx](<../../apps/web/src/app/(admin)/admin/staff/_components/user-profile-panel.tsx>), [student-admin-editor.tsx](<../../apps/web/src/app/(admin)/admin/students/[id]/student-admin-editor.tsx>), [user-access-account-detail.tsx](../../apps/mobile/src/components/access/user-access-account-detail.tsx), [user-access-screen.tsx](../../apps/mobile/src/components/access/user-access-screen.tsx)

Tests: [admin.router.test.ts](../../apps/api/src/__tests__/admin.router.test.ts)

| Stable subfeature ID | Canonical symbol and entry | Status |
| -------------------- | -------------------------- | ------ |

## API-audit

Purpose: owns `audit.*` in [auditRouter](../../apps/api/src/routers/audit.ts). Status: partial. Canonical reuse point: extend this router.

uses / depends_on: `INF-auth`, `INF-db`; shared domains and services must be verified at imports. used_by: `appRouter.audit` [root](../../apps/api/src/router.ts).

Client consumers: [audit-log-viewer.tsx](<../../apps/web/src/app/(admin)/admin/audit/audit-log-viewer.tsx>)

Tests: [audit.router.test.ts](../../apps/api/src/__tests__/audit.router.test.ts)

| Stable subfeature ID | Canonical symbol and entry                                            | Status  |
| -------------------- | --------------------------------------------------------------------- | ------- |
| `API-audit.list`     | `auditRouter.list` in [audit.ts](../../apps/api/src/routers/audit.ts) | partial |

## API-health

Purpose: owns `health.*` in [healthRouter](../../apps/api/src/routers/health.ts). Status: partial. Canonical reuse point: extend this router.

uses / depends_on: `INF-auth`, `INF-db`; shared domains and services must be verified at imports. used_by: `appRouter.health` [root](../../apps/api/src/router.ts).

Client consumers: [supervisor-smoke-screen.tsx](../../apps/mobile/src/components/smoke/supervisor-smoke-screen.tsx), [signed-in-router.tsx](../../apps/mobile/src/components/core/signed-in-router.tsx)

Tests: [health.router.test.ts](../../apps/api/src/__tests__/health.router.test.ts)

| Stable subfeature ID | Canonical symbol and entry                                               | Status  |
| -------------------- | ------------------------------------------------------------------------ | ------- |
| `API-health.ping`    | `healthRouter.ping` in [health.ts](../../apps/api/src/routers/health.ts) | partial |
| `API-health.db`      | `healthRouter.db` in [health.ts](../../apps/api/src/routers/health.ts)   | partial |
| `API-health.me`      | `healthRouter.me` in [health.ts](../../apps/api/src/routers/health.ts)   | partial |

## API-student

Purpose: owns `student.*` in [studentRouter](../../apps/api/src/routers/student.ts). Status: partial. Canonical reuse point: extend this router.

uses / depends_on: `INF-auth`, `INF-db`; shared domains and services must be verified at imports. used_by: `appRouter.student` [root](../../apps/api/src/router.ts).

Client consumers: [student-wallet-client.tsx](../../apps/web/src/components/student/student-wallet-client.tsx), [student-nav.tsx](../../apps/web/src/components/student/student-nav.tsx), [student-home-client.tsx](../../apps/web/src/components/student/student-home-client.tsx), [student-pace-client.tsx](../../apps/web/src/components/student/student-pace-client.tsx), [student-portal-gate.tsx](../../apps/web/src/components/student/student-portal-gate.tsx), [student-shop-client.tsx](../../apps/web/src/components/student/student-shop-client.tsx), [behaviour-log-client.tsx](../../apps/web/src/components/behaviour/behaviour-log-client.tsx), [student-notification-admin-client.tsx](../../apps/web/src/components/student-notifications/student-notification-admin-client.tsx), [incident-staff-workflow.tsx](../../apps/web/src/components/incidents/incident-staff-workflow.tsx), [report-workflow-client.tsx](../../apps/web/src/components/reports/report-workflow-client.tsx), [student-invest-client.tsx](../../apps/web/src/components/student/invest/student-invest-client.tsx), [students-list.tsx](<../../apps/web/src/app/(admin)/admin/students/students-list.tsx>), [people-profiles-client.tsx](<../../apps/web/src/app/(admin)/admin/staff/people-profiles-client.tsx>), [new-student-form.tsx](<../../apps/web/src/app/(admin)/admin/students/new/new-student-form.tsx>), [student-admin-editor.tsx](<../../apps/web/src/app/(admin)/admin/students/[id]/student-admin-editor.tsx>), [student-portal-smoke-screen.tsx](../../apps/mobile/src/components/smoke/student-portal-smoke-screen.tsx), [student-mobile-access-gate.tsx](../../apps/mobile/src/components/student/student-mobile-access-gate.tsx), [student-portal-screen.tsx](../../apps/mobile/src/components/student/student-portal-screen.tsx)

Tests: [student-notifications.test.ts](../../apps/api/src/__tests__/student-notifications.test.ts), [student-report-pdf.test.ts](../../apps/api/src/__tests__/student-report-pdf.test.ts), [student.router.test.ts](../../apps/api/src/__tests__/student.router.test.ts), [studentNotification.router.test.ts](../../apps/api/src/__tests__/studentNotification.router.test.ts), [studentSettings.router.test.ts](../../apps/api/src/__tests__/studentSettings.router.test.ts)

| Stable subfeature ID          | Canonical symbol and entry                                                             | Status  |
| ----------------------------- | -------------------------------------------------------------------------------------- | ------- |
| `API-student.me`              | `studentRouter.me` in [student.ts](../../apps/api/src/routers/student.ts)              | partial |
| `API-student.portalUsage`     | `studentRouter.portalUsage` in [student.ts](../../apps/api/src/routers/student.ts)     | partial |
| `API-student.dashboard`       | `studentRouter.dashboard` in [student.ts](../../apps/api/src/routers/student.ts)       | partial |
| `API-student.wallet`          | `studentRouter.wallet` in [student.ts](../../apps/api/src/routers/student.ts)          | partial |
| `API-student.heartbeat`       | `studentRouter.heartbeat` in [student.ts](../../apps/api/src/routers/student.ts)       | partial |
| `API-student.list`            | `studentRouter.list` in [student.ts](../../apps/api/src/routers/student.ts)            | partial |
| `API-student.byId`            | `studentRouter.byId` in [student.ts](../../apps/api/src/routers/student.ts)            | partial |
| `API-student.create`          | `studentRouter.create` in [student.ts](../../apps/api/src/routers/student.ts)          | partial |
| `API-student.update`          | `studentRouter.update` in [student.ts](../../apps/api/src/routers/student.ts)          | partial |
| `API-student.assignSubject`   | `studentRouter.assignSubject` in [student.ts](../../apps/api/src/routers/student.ts)   | partial |
| `API-student.setCurrentPace`  | `studentRouter.setCurrentPace` in [student.ts](../../apps/api/src/routers/student.ts)  | partial |
| `API-student.unassignSubject` | `studentRouter.unassignSubject` in [student.ts](../../apps/api/src/routers/student.ts) | partial |
| `API-student.deleteArchived`  | `studentRouter.deleteArchived` in [student.ts](../../apps/api/src/routers/student.ts)  | partial |

## API-attendance

Purpose: owns `attendance.*` in [attendanceRouter](../../apps/api/src/routers/attendance.ts). Status: partial. Canonical reuse point: extend this router.

uses / depends_on: `INF-auth`, `INF-db`; shared domains and services must be verified at imports. used_by: `appRouter.attendance` [root](../../apps/api/src/router.ts).

Client consumers: [special-attendance-capture.tsx](../../apps/web/src/components/attendance/special-attendance-capture.tsx), [attendance-capture.tsx](../../apps/web/src/components/attendance/attendance-capture.tsx), [student-attendance-client.tsx](../../apps/web/src/components/student/student-attendance-client.tsx), [staff-attendance-roster.tsx](<../../apps/web/src/app/(admin)/admin/attendance/staff-attendance-roster.tsx>), [attendance-export-centre.tsx](<../../apps/web/src/app/(admin)/admin/attendance/attendance-export-centre.tsx>), [attendance-history-panel.tsx](<../../apps/web/src/app/(admin)/admin/staff/_components/attendance-history-panel.tsx>), [supervisor-dashboard-client.tsx](<../../apps/web/src/app/(supervisor)/supervisor/supervisor-dashboard-client.tsx>), [supervisor-smoke-screen.tsx](../../apps/mobile/src/components/smoke/supervisor-smoke-screen.tsx), [student-portal-screen.tsx](../../apps/mobile/src/components/student/student-portal-screen.tsx), [staff-attendance-screen.tsx](../../apps/mobile/src/components/staff/staff-attendance-screen.tsx), [staff-incident-screen.tsx](../../apps/mobile/src/components/staff/staff-incident-screen.tsx), [staff-behaviour-screen.tsx](../../apps/mobile/src/components/staff/staff-behaviour-screen.tsx)

Tests: [attendance.router.test.ts](../../apps/api/src/__tests__/attendance.router.test.ts)

| Stable subfeature ID                 | Canonical symbol and entry                                                                          | Status  |
| ------------------------------------ | --------------------------------------------------------------------------------------------------- | ------- |
| `API-attendance.listYearGroupBands`  | `attendanceRouter.listYearGroupBands` in [attendance.ts](../../apps/api/src/routers/attendance.ts)  | partial |
| `API-attendance.forDate`             | `attendanceRouter.forDate` in [attendance.ts](../../apps/api/src/routers/attendance.ts)             | partial |
| `API-attendance.mark`                | `attendanceRouter.mark` in [attendance.ts](../../apps/api/src/routers/attendance.ts)                | partial |
| `API-attendance.resetForDate`        | `attendanceRouter.resetForDate` in [attendance.ts](../../apps/api/src/routers/attendance.ts)        | partial |
| `API-attendance.specialForDate`      | `attendanceRouter.specialForDate` in [attendance.ts](../../apps/api/src/routers/attendance.ts)      | partial |
| `API-attendance.saveSpecialSession`  | `attendanceRouter.saveSpecialSession` in [attendance.ts](../../apps/api/src/routers/attendance.ts)  | partial |
| `API-attendance.markSpecial`         | `attendanceRouter.markSpecial` in [attendance.ts](../../apps/api/src/routers/attendance.ts)         | partial |
| `API-attendance.resetSpecialForDate` | `attendanceRouter.resetSpecialForDate` in [attendance.ts](../../apps/api/src/routers/attendance.ts) | partial |
| `API-attendance.listExportOptions`   | `attendanceRouter.listExportOptions` in [attendance.ts](../../apps/api/src/routers/attendance.ts)   | partial |
| `API-attendance.exportStudentsCsv`   | `attendanceRouter.exportStudentsCsv` in [attendance.ts](../../apps/api/src/routers/attendance.ts)   | partial |
| `API-attendance.studentHistory`      | `attendanceRouter.studentHistory` in [attendance.ts](../../apps/api/src/routers/attendance.ts)      | partial |
| `API-attendance.studentSummary`      | `attendanceRouter.studentSummary` in [attendance.ts](../../apps/api/src/routers/attendance.ts)      | partial |
| `API-attendance.staffForDate`        | `attendanceRouter.staffForDate` in [attendance.ts](../../apps/api/src/routers/attendance.ts)        | partial |
| `API-attendance.markStaff`           | `attendanceRouter.markStaff` in [attendance.ts](../../apps/api/src/routers/attendance.ts)           | partial |
| `API-attendance.resetStaffForDate`   | `attendanceRouter.resetStaffForDate` in [attendance.ts](../../apps/api/src/routers/attendance.ts)   | partial |
| `API-attendance.exportStaffCsv`      | `attendanceRouter.exportStaffCsv` in [attendance.ts](../../apps/api/src/routers/attendance.ts)      | partial |
| `API-attendance.staffHistory`        | `attendanceRouter.staffHistory` in [attendance.ts](../../apps/api/src/routers/attendance.ts)        | partial |
| `API-attendance.insights`            | `attendanceRouter.insights` in [attendance.ts](../../apps/api/src/routers/attendance.ts)            | partial |

## API-behaviour

Purpose: owns `behaviour.*` in [behaviourRouter](../../apps/api/src/routers/behaviour.ts). Status: partial. Canonical reuse point: extend this router.

uses / depends_on: `INF-auth`, `INF-db`; shared domains and services must be verified at imports. used_by: `appRouter.behaviour` [root](../../apps/api/src/router.ts).

Client consumers: [clubs-lead-portal-client.tsx](../../apps/web/src/components/clubs/clubs-lead-portal-client.tsx), [student-drillthrough-content.tsx](../../apps/web/src/components/student-drillthrough/student-drillthrough-content.tsx), [daily-demerit-badge.tsx](../../apps/web/src/components/behaviour/daily-demerit-badge.tsx), [behaviour-log-client.tsx](../../apps/web/src/components/behaviour/behaviour-log-client.tsx), [child-snapshot-client.tsx](../../apps/web/src/components/child-log/child-snapshot-client.tsx), [behaviour-report-client.tsx](<../../apps/web/src/app/(admin)/admin/behaviour/behaviour-report-client.tsx>), [supervisor-dashboard-client.tsx](<../../apps/web/src/app/(supervisor)/supervisor/supervisor-dashboard-client.tsx>), [supervisor-smoke-screen.tsx](../../apps/mobile/src/components/smoke/supervisor-smoke-screen.tsx), [staff-club-lead-screen.tsx](../../apps/mobile/src/components/staff/staff-club-lead-screen.tsx), [staff-behaviour-screen.tsx](../../apps/mobile/src/components/staff/staff-behaviour-screen.tsx)

Tests: [behaviour.router.test.ts](../../apps/api/src/__tests__/behaviour.router.test.ts)

| Stable subfeature ID | Canonical symbol and entry | Status |
| -------------------- | -------------------------- | ------ |

## API-childLog

Purpose: owns `childLog.*` in [childLogRouter](../../apps/api/src/routers/childLog.ts). Status: partial. Canonical reuse point: extend this router.

uses / depends_on: `INF-auth`, `INF-db`; shared domains and services must be verified at imports. used_by: `appRouter.childLog` [root](../../apps/api/src/router.ts).

Client consumers: [parent-shop-client.tsx](../../apps/web/src/components/shop/parent-shop-client.tsx), [student-drillthrough-content.tsx](../../apps/web/src/components/student-drillthrough/student-drillthrough-content.tsx), [sensitive-review-client.tsx](../../apps/web/src/components/child-log/sensitive-review-client.tsx), [supervisor-notes-history-client.tsx](../../apps/web/src/components/child-log/supervisor-notes-history-client.tsx), [child-snapshot-client.tsx](../../apps/web/src/components/child-log/child-snapshot-client.tsx), [report-workflow-client.tsx](../../apps/web/src/components/reports/report-workflow-client.tsx), [published-timetable-client.tsx](../../apps/web/src/components/timetable/published-timetable-client.tsx), [students-list.tsx](<../../apps/web/src/app/(admin)/admin/students/students-list.tsx>), [parent-dashboard-client.tsx](<../../apps/web/src/app/(parent)/parent/parent-dashboard-client.tsx>), [parent-children-list.tsx](<../../apps/web/src/app/(parent)/parent/parent-children-list.tsx>), [parent-portal-smoke-screen.tsx](../../apps/mobile/src/components/smoke/parent-portal-smoke-screen.tsx), [parent-portal-screen.tsx](../../apps/mobile/src/components/parent/parent-portal-screen.tsx)

Tests: No matching router test found; other verification unknown.

| Stable subfeature ID                  | Canonical symbol and entry                                                                       | Status  |
| ------------------------------------- | ------------------------------------------------------------------------------------------------ | ------- |
| `API-childLog.listSnapshotStudents`   | `childLogRouter.listSnapshotStudents` in [childLog.ts](../../apps/api/src/routers/childLog.ts)   | partial |
| `API-childLog.centreSnapshot`         | `childLogRouter.centreSnapshot` in [childLog.ts](../../apps/api/src/routers/childLog.ts)         | partial |
| `API-childLog.listAccessibleStudents` | `childLogRouter.listAccessibleStudents` in [childLog.ts](../../apps/api/src/routers/childLog.ts) | partial |
| `API-childLog.parentDashboard`        | `childLogRouter.parentDashboard` in [childLog.ts](../../apps/api/src/routers/childLog.ts)        | partial |
| `API-childLog.drillThrough`           | `childLogRouter.drillThrough` in [childLog.ts](../../apps/api/src/routers/childLog.ts)           | partial |
| `API-childLog.snapshot`               | `childLogRouter.snapshot` in [childLog.ts](../../apps/api/src/routers/childLog.ts)               | partial |
| `API-childLog.sensitiveReviewQueue`   | `childLogRouter.sensitiveReviewQueue` in [childLog.ts](../../apps/api/src/routers/childLog.ts)   | partial |
| `API-childLog.reviewSensitiveItem`    | `childLogRouter.reviewSensitiveItem` in [childLog.ts](../../apps/api/src/routers/childLog.ts)    | partial |
| `API-childLog.supervisorNotesHistory` | `childLogRouter.supervisorNotesHistory` in [childLog.ts](../../apps/api/src/routers/childLog.ts) | partial |

## API-childNotes

Purpose: owns `childNotes.*` in [childNotesRouter](../../apps/api/src/routers/childNotes.ts). Status: partial. Canonical reuse point: extend this router.

uses / depends_on: `INF-auth`, `INF-db`; shared domains and services must be verified at imports. used_by: `appRouter.childNotes` [root](../../apps/api/src/router.ts).

Client consumers: [student-drillthrough-content.tsx](../../apps/web/src/components/student-drillthrough/student-drillthrough-content.tsx), [child-snapshot-client.tsx](../../apps/web/src/components/child-log/child-snapshot-client.tsx)

Tests: [childNotes.router.test.ts](../../apps/api/src/__tests__/childNotes.router.test.ts)

| Stable subfeature ID            | Canonical symbol and entry                                                                     | Status  |
| ------------------------------- | ---------------------------------------------------------------------------------------------- | ------- |
| `API-childNotes.create`         | `childNotesRouter.create` in [childNotes.ts](../../apps/api/src/routers/childNotes.ts)         | partial |
| `API-childNotes.listForStudent` | `childNotesRouter.listForStudent` in [childNotes.ts](../../apps/api/src/routers/childNotes.ts) | partial |
| `API-childNotes.update`         | `childNotesRouter.update` in [childNotes.ts](../../apps/api/src/routers/childNotes.ts)         | partial |
| `API-childNotes.delete`         | `childNotesRouter.delete` in [childNotes.ts](../../apps/api/src/routers/childNotes.ts)         | partial |

## API-pace

Purpose: owns `pace.*` in [paceRouter](../../apps/api/src/routers/pace.ts). Status: partial. Canonical reuse point: extend this router.

uses / depends_on: `INF-auth`, `INF-db`; shared domains and services must be verified at imports. used_by: `appRouter.pace` [root](../../apps/api/src/router.ts).

Client consumers: [student-pace-client.tsx](../../apps/web/src/components/student/student-pace-client.tsx), [student-drillthrough-content.tsx](../../apps/web/src/components/student-drillthrough/student-drillthrough-content.tsx), [pace-workflow-client.tsx](../../apps/web/src/components/pace/pace-workflow-client.tsx), [parent-pace-client.tsx](../../apps/web/src/components/parent/parent-pace-client.tsx), [child-snapshot-client.tsx](../../apps/web/src/components/child-log/child-snapshot-client.tsx), [supervisor-smoke-screen.tsx](../../apps/mobile/src/components/smoke/supervisor-smoke-screen.tsx), [student-portal-smoke-screen.tsx](../../apps/mobile/src/components/smoke/student-portal-smoke-screen.tsx), [student-portal-screen.tsx](../../apps/mobile/src/components/student/student-portal-screen.tsx), [parent-pace-screen.tsx](../../apps/mobile/src/components/parent/parent-pace-screen.tsx), [parent-child-detail-screen.tsx](../../apps/mobile/src/components/parent/parent-child-detail-screen.tsx), [staff-pace-screen.tsx](../../apps/mobile/src/components/staff/staff-pace-screen.tsx)

Tests: [pace-gap-plans.test.ts](../../apps/api/src/__tests__/pace-gap-plans.test.ts), [pace.router.test.ts](../../apps/api/src/__tests__/pace.router.test.ts)

| Stable subfeature ID                     | Canonical symbol and entry                                                                  | Status  |
| ---------------------------------------- | ------------------------------------------------------------------------------------------- | ------- |
| `API-pace.parentCurrent`                 | `paceRouter.parentCurrent` in [pace.ts](../../apps/api/src/routers/pace.ts)                 | partial |
| `API-pace.parentHistory`                 | `paceRouter.parentHistory` in [pace.ts](../../apps/api/src/routers/pace.ts)                 | partial |
| `API-pace.roster`                        | `paceRouter.roster` in [pace.ts](../../apps/api/src/routers/pace.ts)                        | partial |
| `API-pace.forStudent`                    | `paceRouter.forStudent` in [pace.ts](../../apps/api/src/routers/pace.ts)                    | partial |
| `API-pace.record`                        | `paceRouter.record` in [pace.ts](../../apps/api/src/routers/pace.ts)                        | partial |
| `API-pace.updateRecord`                  | `paceRouter.updateRecord` in [pace.ts](../../apps/api/src/routers/pace.ts)                  | partial |
| `API-pace.deleteRecord`                  | `paceRouter.deleteRecord` in [pace.ts](../../apps/api/src/routers/pace.ts)                  | partial |
| `API-pace.approveFailedFinalTestAdvance` | `paceRouter.approveFailedFinalTestAdvance` in [pace.ts](../../apps/api/src/routers/pace.ts) | partial |

## API-meritLedger

Purpose: owns `meritLedger.*` in [meritLedgerRouter](../../apps/api/src/routers/meritLedger.ts). Status: partial. Canonical reuse point: extend this router.

uses / depends_on: `INF-auth`, `INF-db`; shared domains and services must be verified at imports. used_by: `appRouter.meritLedger` [root](../../apps/api/src/router.ts).

Client consumers: [parent-shop-client.tsx](../../apps/web/src/components/shop/parent-shop-client.tsx), [student-wallet-client.tsx](../../apps/web/src/components/student/student-wallet-client.tsx), [parent-portal-smoke-screen.tsx](../../apps/mobile/src/components/smoke/parent-portal-smoke-screen.tsx), [student-portal-smoke-screen.tsx](../../apps/mobile/src/components/smoke/student-portal-smoke-screen.tsx), [student-portal-screen.tsx](../../apps/mobile/src/components/student/student-portal-screen.tsx), [parent-portal-screen.tsx](../../apps/mobile/src/components/parent/parent-portal-screen.tsx)

Tests: [meritLedger.router.test.ts](../../apps/api/src/__tests__/meritLedger.router.test.ts)

| Stable subfeature ID            | Canonical symbol and entry                                                                       | Status  |
| ------------------------------- | ------------------------------------------------------------------------------------------------ | ------- |
| `API-meritLedger.balances`      | `meritLedgerRouter.balances` in [meritLedger.ts](../../apps/api/src/routers/meritLedger.ts)      | partial |
| `API-meritLedger.activity`      | `meritLedgerRouter.activity` in [meritLedger.ts](../../apps/api/src/routers/meritLedger.ts)      | partial |
| `API-meritLedger.transfer`      | `meritLedgerRouter.transfer` in [meritLedger.ts](../../apps/api/src/routers/meritLedger.ts)      | partial |
| `API-meritLedger.giveToCharity` | `meritLedgerRouter.giveToCharity` in [meritLedger.ts](../../apps/api/src/routers/meritLedger.ts) | partial |

## API-tithe

Purpose: owns `tithe.*` in [titheRouter](../../apps/api/src/routers/tithe.ts). Status: partial. Canonical reuse point: extend this router.

uses / depends_on: `INF-auth`, `INF-db`; shared domains and services must be verified at imports. used_by: `appRouter.tithe` [root](../../apps/api/src/router.ts).

Client consumers: [student-wallet-client.tsx](../../apps/web/src/components/student/student-wallet-client.tsx), [student-portal-screen.tsx](../../apps/mobile/src/components/student/student-portal-screen.tsx)

Tests: [tithe.router.test.ts](../../apps/api/src/__tests__/tithe.router.test.ts)

| Stable subfeature ID         | Canonical symbol and entry                                                        | Status  |
| ---------------------------- | --------------------------------------------------------------------------------- | ------- |
| `API-tithe.getStatus`        | `titheRouter.getStatus` in [tithe.ts](../../apps/api/src/routers/tithe.ts)        | partial |
| `API-tithe.updatePreference` | `titheRouter.updatePreference` in [tithe.ts](../../apps/api/src/routers/tithe.ts) | partial |
| `API-tithe.payDue`           | `titheRouter.payDue` in [tithe.ts](../../apps/api/src/routers/tithe.ts)           | partial |

## API-investment

Purpose: owns `investment.*` in [investmentRouter](../../apps/api/src/routers/investment.ts). Status: partial. Canonical reuse point: extend this router.

uses / depends_on: `INF-auth`, `INF-db`; shared domains and services must be verified at imports. used_by: `appRouter.investment` [root](../../apps/api/src/router.ts).

Client consumers: [student-invest-client.tsx](../../apps/web/src/components/student/invest/student-invest-client.tsx), [student-portal-smoke-screen.tsx](../../apps/mobile/src/components/smoke/student-portal-smoke-screen.tsx), [student-portal-screen.tsx](../../apps/mobile/src/components/student/student-portal-screen.tsx)

Tests: [investment-accounting-invariants.test.ts](../../apps/api/src/__tests__/investment-accounting-invariants.test.ts), [investment-market-data-storage.test.ts](../../apps/api/src/__tests__/investment-market-data-storage.test.ts), [investment-market-refresh.test.ts](../../apps/api/src/__tests__/investment-market-refresh.test.ts), [investment.router.test.ts](../../apps/api/src/__tests__/investment.router.test.ts)

| Stable subfeature ID               | Canonical symbol and entry                                                                        | Status  |
| ---------------------------------- | ------------------------------------------------------------------------------------------------- | ------- |
| `API-investment.marketData`        | `investmentRouter.marketData` in [investment.ts](../../apps/api/src/routers/investment.ts)        | partial |
| `API-investment.instrumentDetail`  | `investmentRouter.instrumentDetail` in [investment.ts](../../apps/api/src/routers/investment.ts)  | partial |
| `API-investment.account`           | `investmentRouter.account` in [investment.ts](../../apps/api/src/routers/investment.ts)           | partial |
| `API-investment.navHistory`        | `investmentRouter.navHistory` in [investment.ts](../../apps/api/src/routers/investment.ts)        | partial |
| `API-investment.buy`               | `investmentRouter.buy` in [investment.ts](../../apps/api/src/routers/investment.ts)               | partial |
| `API-investment.fundCash`          | `investmentRouter.fundCash` in [investment.ts](../../apps/api/src/routers/investment.ts)          | partial |
| `API-investment.buyHolding`        | `investmentRouter.buyHolding` in [investment.ts](../../apps/api/src/routers/investment.ts)        | partial |
| `API-investment.sellHolding`       | `investmentRouter.sellHolding` in [investment.ts](../../apps/api/src/routers/investment.ts)       | partial |
| `API-investment.withdrawPortfolio` | `investmentRouter.withdrawPortfolio` in [investment.ts](../../apps/api/src/routers/investment.ts) | partial |
| `API-investment.sell`              | `investmentRouter.sell` in [investment.ts](../../apps/api/src/routers/investment.ts)              | partial |
| `API-investment.tickNav`           | `investmentRouter.tickNav` in [investment.ts](../../apps/api/src/routers/investment.ts)           | partial |
| `API-investment.refreshMarketData` | `investmentRouter.refreshMarketData` in [investment.ts](../../apps/api/src/routers/investment.ts) | partial |

## API-shop

Purpose: owns `shop.*` in [shopRouter](../../apps/api/src/routers/shop.ts). Status: partial. Canonical reuse point: extend this router.

uses / depends_on: `INF-auth`, `INF-db`; shared domains and services must be verified at imports. used_by: `appRouter.shop` [root](../../apps/api/src/router.ts).

Client consumers: [parent-shop-client.tsx](../../apps/web/src/components/shop/parent-shop-client.tsx), [shop-workflow-client.tsx](../../apps/web/src/components/shop/shop-workflow-client.tsx), [student-shop-client.tsx](../../apps/web/src/components/student/student-shop-client.tsx), [student-smoke-shop.tsx](../../apps/mobile/src/components/smoke/student-smoke-shop.tsx), [supervisor-smoke-screen.tsx](../../apps/mobile/src/components/smoke/supervisor-smoke-screen.tsx), [parent-portal-smoke-screen.tsx](../../apps/mobile/src/components/smoke/parent-portal-smoke-screen.tsx), [student-portal-smoke-screen.tsx](../../apps/mobile/src/components/smoke/student-portal-smoke-screen.tsx), [student-portal-screen.tsx](../../apps/mobile/src/components/student/student-portal-screen.tsx), [student-shop-screen.tsx](../../apps/mobile/src/components/student/student-shop-screen.tsx), [parent-shop-reservations-screen.tsx](../../apps/mobile/src/components/parent/parent-shop-reservations-screen.tsx), [parent-portal-screen.tsx](../../apps/mobile/src/components/parent/parent-portal-screen.tsx), [staff-shop-counter-screen.tsx](../../apps/mobile/src/components/staff/staff-shop-counter-screen.tsx)

Tests: [shop.router.test.ts](../../apps/api/src/__tests__/shop.router.test.ts)

| Stable subfeature ID              | Canonical symbol and entry                                                           | Status  |
| --------------------------------- | ------------------------------------------------------------------------------------ | ------- |
| `API-shop.listItems`              | `shopRouter.listItems` in [shop.ts](../../apps/api/src/routers/shop.ts)              | partial |
| `API-shop.listPurchasers`         | `shopRouter.listPurchasers` in [shop.ts](../../apps/api/src/routers/shop.ts)         | partial |
| `API-shop.listReservations`       | `shopRouter.listReservations` in [shop.ts](../../apps/api/src/routers/shop.ts)       | partial |
| `API-shop.studentHistory`         | `shopRouter.studentHistory` in [shop.ts](../../apps/api/src/routers/shop.ts)         | partial |
| `API-shop.createItem`             | `shopRouter.createItem` in [shop.ts](../../apps/api/src/routers/shop.ts)             | partial |
| `API-shop.updateItem`             | `shopRouter.updateItem` in [shop.ts](../../apps/api/src/routers/shop.ts)             | partial |
| `API-shop.prepareItemPhotoUpload` | `shopRouter.prepareItemPhotoUpload` in [shop.ts](../../apps/api/src/routers/shop.ts) | partial |
| `API-shop.updateItemPhoto`        | `shopRouter.updateItemPhoto` in [shop.ts](../../apps/api/src/routers/shop.ts)        | partial |
| `API-shop.reserve`                | `shopRouter.reserve` in [shop.ts](../../apps/api/src/routers/shop.ts)                | partial |
| `API-shop.collectReservation`     | `shopRouter.collectReservation` in [shop.ts](../../apps/api/src/routers/shop.ts)     | partial |
| `API-shop.cancelReservation`      | `shopRouter.cancelReservation` in [shop.ts](../../apps/api/src/routers/shop.ts)      | partial |
| `API-shop.purchase`               | `shopRouter.purchase` in [shop.ts](../../apps/api/src/routers/shop.ts)               | partial |

## API-leaderboard

Purpose: owns `leaderboard.*` in [leaderboardRouter](../../apps/api/src/routers/leaderboard.ts). Status: partial. Canonical reuse point: extend this router.

uses / depends_on: `INF-auth`, `INF-db`; shared domains and services must be verified at imports. used_by: `appRouter.leaderboard` [root](../../apps/api/src/router.ts).

Client consumers: [leaderboard-client.tsx](../../apps/web/src/components/leaderboard/leaderboard-client.tsx), [student-portal-smoke-screen.tsx](../../apps/mobile/src/components/smoke/student-portal-smoke-screen.tsx), [student-portal-screen.tsx](../../apps/mobile/src/components/student/student-portal-screen.tsx), [parent-reports-ranks-screen.tsx](../../apps/mobile/src/components/parent/parent-reports-ranks-screen.tsx)

Tests: [leaderboard.router.test.ts](../../apps/api/src/__tests__/leaderboard.router.test.ts)

| Stable subfeature ID  | Canonical symbol and entry                                                             | Status  |
| --------------------- | -------------------------------------------------------------------------------------- | ------- |
| `API-leaderboard.get` | `leaderboardRouter.get` in [leaderboard.ts](../../apps/api/src/routers/leaderboard.ts) | partial |

## API-club

Purpose: owns `club.*` in [clubRouter](../../apps/api/src/routers/club.ts). Status: partial. Canonical reuse point: extend this router.

uses / depends_on: `INF-auth`, `INF-db`; shared domains and services must be verified at imports. used_by: `appRouter.club` [root](../../apps/api/src/router.ts).

Client consumers: [linked-child-club-detail-client.tsx](../../apps/web/src/components/clubs/linked-child-club-detail-client.tsx), [parent-my-clubs-client.tsx](../../apps/web/src/components/clubs/parent-my-clubs-client.tsx), [club-rota-panel.tsx](../../apps/web/src/components/clubs/club-rota-panel.tsx), [clubs-lead-portal-client.tsx](../../apps/web/src/components/clubs/clubs-lead-portal-client.tsx), [my-club-rota-panel.tsx](../../apps/web/src/components/clubs/my-club-rota-panel.tsx), [club-attendance-panel.tsx](../../apps/web/src/components/clubs/club-attendance-panel.tsx), [clubs-management-client.tsx](../../apps/web/src/components/clubs/clubs-management-client.tsx), [club-availability-editor.tsx](../../apps/web/src/components/clubs/club-availability-editor.tsx), [club-assignment-panels.tsx](../../apps/web/src/components/clubs/club-assignment-panels.tsx), [student-clubs-client.tsx](../../apps/web/src/components/student/student-clubs-client.tsx), [supervisor-smoke-screen.tsx](../../apps/mobile/src/components/smoke/supervisor-smoke-screen.tsx), [parent-portal-smoke-screen.tsx](../../apps/mobile/src/components/smoke/parent-portal-smoke-screen.tsx), [student-clubs-panel.tsx](../../apps/mobile/src/components/student/student-clubs-panel.tsx), [student-clubs-faith-screen.tsx](../../apps/mobile/src/components/student/student-clubs-faith-screen.tsx), [parent-clubs-screen.tsx](../../apps/mobile/src/components/parent/parent-clubs-screen.tsx), [parent-home-screen.tsx](../../apps/mobile/src/components/parent/parent-home-screen.tsx), [parent-portal-screen.tsx](../../apps/mobile/src/components/parent/parent-portal-screen.tsx), [staff-club-lead-screen.tsx](../../apps/mobile/src/components/staff/staff-club-lead-screen.tsx), [staff-club-manager-screen.tsx](../../apps/mobile/src/components/staff/staff-club-manager-screen.tsx)

Tests: [club.router.test.ts](../../apps/api/src/__tests__/club.router.test.ts)

| Stable subfeature ID | Canonical symbol and entry | Status |
| -------------------- | -------------------------- | ------ |

## API-calendar

Purpose: owns `calendar.*` in [calendarRouter](../../apps/api/src/routers/calendar.ts). Status: partial. Canonical reuse point: extend this router.

uses / depends_on: `INF-auth`, `INF-db`; shared domains and services must be verified at imports. used_by: `appRouter.calendar` [root](../../apps/api/src/router.ts).

Client consumers: [special-attendance-capture.tsx](../../apps/web/src/components/attendance/special-attendance-capture.tsx), [attendance-capture.tsx](../../apps/web/src/components/attendance/attendance-capture.tsx), [club-rota-panel.tsx](../../apps/web/src/components/clubs/club-rota-panel.tsx), [club-attendance-panel.tsx](../../apps/web/src/components/clubs/club-attendance-panel.tsx), [shared-calendar.tsx](../../apps/web/src/components/calendar/shared-calendar.tsx), [staff-attendance-roster.tsx](<../../apps/web/src/app/(admin)/admin/attendance/staff-attendance-roster.tsx>), [rota-scheduler-client.tsx](<../../apps/web/src/app/(admin)/admin/rota/rota-scheduler-client.tsx>), [technical-support-portal-screen.tsx](../../apps/mobile/src/components/support/technical-support-portal-screen.tsx), [parent-portal-screen.tsx](../../apps/mobile/src/components/parent/parent-portal-screen.tsx), [staff-attendance-screen.tsx](../../apps/mobile/src/components/staff/staff-attendance-screen.tsx)

Tests: [calendar.router.test.ts](../../apps/api/src/__tests__/calendar.router.test.ts)

| Stable subfeature ID                        | Canonical symbol and entry                                                                             | Status  |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------- |
| `API-calendar.operationalDates`             | `calendarRouter.operationalDates` in [calendar.ts](../../apps/api/src/routers/calendar.ts)             | partial |
| `API-calendar.listForAdmin`                 | `calendarRouter.listForAdmin` in [calendar.ts](../../apps/api/src/routers/calendar.ts)                 | partial |
| `API-calendar.listForStaff`                 | `calendarRouter.listForStaff` in [calendar.ts](../../apps/api/src/routers/calendar.ts)                 | partial |
| `API-calendar.listForParents`               | `calendarRouter.listForParents` in [calendar.ts](../../apps/api/src/routers/calendar.ts)               | partial |
| `API-calendar.listVisible`                  | `calendarRouter.listVisible` in [calendar.ts](../../apps/api/src/routers/calendar.ts)                  | partial |
| `API-calendar.listRequiredPersonCandidates` | `calendarRouter.listRequiredPersonCandidates` in [calendar.ts](../../apps/api/src/routers/calendar.ts) | partial |
| `API-calendar.create`                       | `calendarRouter.create` in [calendar.ts](../../apps/api/src/routers/calendar.ts)                       | partial |
| `API-calendar.update`                       | `calendarRouter.update` in [calendar.ts](../../apps/api/src/routers/calendar.ts)                       | partial |
| `API-calendar.archive`                      | `calendarRouter.archive` in [calendar.ts](../../apps/api/src/routers/calendar.ts)                      | partial |
| `API-calendar.delete`                       | `calendarRouter.delete` in [calendar.ts](../../apps/api/src/routers/calendar.ts)                       | partial |

## API-notice

Purpose: owns `notice.*` in [noticeRouter](../../apps/api/src/routers/notice.ts). Status: partial. Canonical reuse point: extend this router.

uses / depends_on: `INF-auth`, `INF-db`; shared domains and services must be verified at imports. used_by: `appRouter.notice` [root](../../apps/api/src/router.ts).

Client consumers: [staff-noticeboard.tsx](../../apps/web/src/components/noticeboard/staff-noticeboard.tsx), [supervisor-dashboard-client.tsx](<../../apps/web/src/app/(supervisor)/supervisor/supervisor-dashboard-client.tsx>), [parent-smoke-notices.tsx](../../apps/mobile/src/components/smoke/parent-smoke-notices.tsx), [parent-portal-smoke-screen.tsx](../../apps/mobile/src/components/smoke/parent-portal-smoke-screen.tsx), [parent-home-screen.tsx](../../apps/mobile/src/components/parent/parent-home-screen.tsx), [parent-notices-screen.tsx](../../apps/mobile/src/components/parent/parent-notices-screen.tsx), [parent-portal-screen.tsx](../../apps/mobile/src/components/parent/parent-portal-screen.tsx), [staff-communications-screen.tsx](../../apps/mobile/src/components/staff/staff-communications-screen.tsx), [staff-notices-panel.tsx](../../apps/mobile/src/components/staff/staff-notices-panel.tsx)

Tests: [notice.router.test.ts](../../apps/api/src/__tests__/notice.router.test.ts)

| Stable subfeature ID | Canonical symbol and entry | Status |
| -------------------- | -------------------------- | ------ |

## API-message

Purpose: owns `message.*` in [messageRouter](../../apps/api/src/routers/message.ts). Status: partial. Canonical reuse point: extend this router.

uses / depends_on: `INF-auth`, `INF-db`; shared domains and services must be verified at imports. used_by: `appRouter.message` [root](../../apps/api/src/router.ts).

Client consumers: [message-centre.tsx](../../apps/web/src/components/messages/message-centre.tsx), [message-conversation-panel.tsx](../../apps/web/src/components/messages/message-conversation-panel.tsx), [student-community-contacts.tsx](../../apps/web/src/components/community/student-community-contacts.tsx), [parent-portal-smoke-screen.tsx](../../apps/mobile/src/components/smoke/parent-portal-smoke-screen.tsx), [student-portal-smoke-screen.tsx](../../apps/mobile/src/components/smoke/student-portal-smoke-screen.tsx), [mobile-messages-panel.tsx](../../apps/mobile/src/components/messages/mobile-messages-panel.tsx), [parent-home-screen.tsx](../../apps/mobile/src/components/parent/parent-home-screen.tsx), [parent-portal-screen.tsx](../../apps/mobile/src/components/parent/parent-portal-screen.tsx), [staff-communications-screen.tsx](../../apps/mobile/src/components/staff/staff-communications-screen.tsx)

Tests: [message.router.test.ts](../../apps/api/src/__tests__/message.router.test.ts)

| Stable subfeature ID | Canonical symbol and entry | Status |
| -------------------- | -------------------------- | ------ |

## API-community

Purpose: owns `community.*` in [communityRouter](../../apps/api/src/routers/community.ts). Status: partial. Canonical reuse point: extend this router.

uses / depends_on: `INF-auth`, `INF-db`; shared domains and services must be verified at imports. used_by: `appRouter.community` [root](../../apps/api/src/router.ts).

Client consumers: [admin-community-client.tsx](../../apps/web/src/components/community/admin-community-client.tsx), [student-community-client.tsx](../../apps/web/src/components/community/student-community-client.tsx), [student-community-screen.tsx](../../apps/mobile/src/components/student/student-community-screen.tsx)

Tests: [community.router.test.ts](../../apps/api/src/__tests__/community.router.test.ts)

| Stable subfeature ID | Canonical symbol and entry | Status |
| -------------------- | -------------------------- | ------ |

## API-profile

Purpose: owns `profile.*` in [profileRouter](../../apps/api/src/routers/profile.ts). Status: partial. Canonical reuse point: extend this router.

uses / depends_on: `INF-auth`, `INF-db`; shared domains and services must be verified at imports. used_by: `appRouter.profile` [root](../../apps/api/src/router.ts).

Client consumers: [self-profile-client.tsx](../../apps/web/src/components/profile/self-profile-client.tsx), [spouse-invite-panel.tsx](../../apps/web/src/components/profile/spouse-invite-panel.tsx), [profile-portal-menu.tsx](../../apps/web/src/components/profile/profile-portal-menu.tsx), [profile-badge-link.tsx](../../apps/web/src/components/profile/profile-badge-link.tsx), [parent-pace-client.tsx](../../apps/web/src/components/parent/parent-pace-client.tsx), [incident-parent-portal.tsx](../../apps/web/src/components/incidents/incident-parent-portal.tsx), [parent-dashboard-client.tsx](<../../apps/web/src/app/(parent)/parent/parent-dashboard-client.tsx>), [parent-profile-registration-screen.tsx](../../apps/mobile/src/components/parent/parent-profile-registration-screen.tsx), [parent-portal-screen.tsx](../../apps/mobile/src/components/parent/parent-portal-screen.tsx)

Tests: [profile.router.test.ts](../../apps/api/src/__tests__/profile.router.test.ts)

| Stable subfeature ID | Canonical symbol and entry | Status |
| -------------------- | -------------------------- | ------ |

## API-report

Purpose: owns `report.*` in [reportRouter](../../apps/api/src/routers/report.ts). Status: partial. Canonical reuse point: extend this router.

uses / depends_on: `INF-auth`, `INF-db`; shared domains and services must be verified at imports. used_by: `appRouter.report` [root](../../apps/api/src/router.ts).

Client consumers: [active-score-keys-report.tsx](../../apps/web/src/components/reports/active-score-keys-report.tsx), [report-workflow-client.tsx](../../apps/web/src/components/reports/report-workflow-client.tsx), [parent-reports-ranks-screen.tsx](../../apps/mobile/src/components/parent/parent-reports-ranks-screen.tsx), [parent-child-detail-screen.tsx](../../apps/mobile/src/components/parent/parent-child-detail-screen.tsx), [staff-score-key-report-screen.tsx](../../apps/mobile/src/components/reports/staff-score-key-report-screen.tsx)

Tests: [report.router.test.ts](../../apps/api/src/__tests__/report.router.test.ts)

| Stable subfeature ID | Canonical symbol and entry | Status |
| -------------------- | -------------------------- | ------ |

## API-rota

Purpose: owns `rota.*` in [rotaRouter](../../apps/api/src/routers/rota.ts). Status: partial. Canonical reuse point: extend this router.

uses / depends_on: `INF-auth`, `INF-db`; shared domains and services must be verified at imports. used_by: `appRouter.rota` [root](../../apps/api/src/router.ts).

Client consumers: [my-availability-editor.tsx](../../apps/web/src/components/rota/my-availability-editor.tsx), [monthly-availability-editor.tsx](../../apps/web/src/components/rota/monthly-availability-editor.tsx), [staff-rota-workspace.tsx](../../apps/web/src/components/rota/staff-rota-workspace.tsx), [parent-volunteer-client.tsx](../../apps/web/src/components/parent/parent-volunteer-client.tsx), [rota-scheduler-client.tsx](<../../apps/web/src/app/(admin)/admin/rota/rota-scheduler-client.tsx>), [rota-volunteer-access.tsx](<../../apps/web/src/app/(admin)/admin/rota/_components/rota-volunteer-access.tsx>), [supervisor-dashboard-client.tsx](<../../apps/web/src/app/(supervisor)/supervisor/supervisor-dashboard-client.tsx>), [supervisor-smoke-screen.tsx](../../apps/mobile/src/components/smoke/supervisor-smoke-screen.tsx), [parent-volunteer-screen.tsx](../../apps/mobile/src/components/parent/parent-volunteer-screen.tsx), [parent-portal-screen.tsx](../../apps/mobile/src/components/parent/parent-portal-screen.tsx), [staff-rota-screen.tsx](../../apps/mobile/src/components/staff/staff-rota-screen.tsx)

Tests: [rota.router.test.ts](../../apps/api/src/__tests__/rota.router.test.ts)

| Stable subfeature ID                      | Canonical symbol and entry                                                                   | Status  |
| ----------------------------------------- | -------------------------------------------------------------------------------------------- | ------- |
| `API-rota.myAvailability`                 | `rotaRouter.myAvailability` in [rota.ts](../../apps/api/src/routers/rota.ts)                 | partial |
| `API-rota.setMyAvailability`              | `rotaRouter.setMyAvailability` in [rota.ts](../../apps/api/src/routers/rota.ts)              | partial |
| `API-rota.myMonthlyAvailability`          | `rotaRouter.myMonthlyAvailability` in [rota.ts](../../apps/api/src/routers/rota.ts)          | partial |
| `API-rota.setMyMonthlyAvailability`       | `rotaRouter.setMyMonthlyAvailability` in [rota.ts](../../apps/api/src/routers/rota.ts)       | partial |
| `API-rota.listStaffParentVolunteerAccess` | `rotaRouter.listStaffParentVolunteerAccess` in [rota.ts](../../apps/api/src/routers/rota.ts) | partial |
| `API-rota.setStaffParentVolunteerAccess`  | `rotaRouter.setStaffParentVolunteerAccess` in [rota.ts](../../apps/api/src/routers/rota.ts)  | partial |
| `API-rota.parentVolunteerSlots`           | `rotaRouter.parentVolunteerSlots` in [rota.ts](../../apps/api/src/routers/rota.ts)           | partial |
| `API-rota.setMyParentVolunteerDays`       | `rotaRouter.setMyParentVolunteerDays` in [rota.ts](../../apps/api/src/routers/rota.ts)       | partial |
| `API-rota.parentVolunteerSchedule`        | `rotaRouter.parentVolunteerSchedule` in [rota.ts](../../apps/api/src/routers/rota.ts)        | partial |
| `API-rota.myRota`                         | `rotaRouter.myRota` in [rota.ts](../../apps/api/src/routers/rota.ts)                         | partial |
| `API-rota.myCombinedSchedule`             | `rotaRouter.myCombinedSchedule` in [rota.ts](../../apps/api/src/routers/rota.ts)             | partial |
| `API-rota.swapCandidates`                 | `rotaRouter.swapCandidates` in [rota.ts](../../apps/api/src/routers/rota.ts)                 | partial |
| `API-rota.teamSchedule`                   | `rotaRouter.teamSchedule` in [rota.ts](../../apps/api/src/routers/rota.ts)                   | partial |
| `API-rota.weekSchedule`                   | `rotaRouter.weekSchedule` in [rota.ts](../../apps/api/src/routers/rota.ts)                   | partial |
| `API-rota.combinedSchedule`               | `rotaRouter.combinedSchedule` in [rota.ts](../../apps/api/src/routers/rota.ts)               | partial |
| `API-rota.listStaff`                      | `rotaRouter.listStaff` in [rota.ts](../../apps/api/src/routers/rota.ts)                      | partial |
| `API-rota.staffAvailability`              | `rotaRouter.staffAvailability` in [rota.ts](../../apps/api/src/routers/rota.ts)              | partial |
| `API-rota.staffMonthlyAvailability`       | `rotaRouter.staffMonthlyAvailability` in [rota.ts](../../apps/api/src/routers/rota.ts)       | partial |
| `API-rota.createShiftBatch`               | `rotaRouter.createShiftBatch` in [rota.ts](../../apps/api/src/routers/rota.ts)               | partial |
| `API-rota.createShift`                    | `rotaRouter.createShift` in [rota.ts](../../apps/api/src/routers/rota.ts)                    | partial |
| `API-rota.updateShift`                    | `rotaRouter.updateShift` in [rota.ts](../../apps/api/src/routers/rota.ts)                    | partial |
| `API-rota.deleteShift`                    | `rotaRouter.deleteShift` in [rota.ts](../../apps/api/src/routers/rota.ts)                    | partial |
| `API-rota.bulkReassignShifts`             | `rotaRouter.bulkReassignShifts` in [rota.ts](../../apps/api/src/routers/rota.ts)             | partial |
| `API-rota.bulkDeleteShifts`               | `rotaRouter.bulkDeleteShifts` in [rota.ts](../../apps/api/src/routers/rota.ts)               | partial |
| `API-rota.pendingSwapRequests`            | `rotaRouter.pendingSwapRequests` in [rota.ts](../../apps/api/src/routers/rota.ts)            | partial |
| `API-rota.mySwapRequests`                 | `rotaRouter.mySwapRequests` in [rota.ts](../../apps/api/src/routers/rota.ts)                 | partial |
| `API-rota.requestSwap`                    | `rotaRouter.requestSwap` in [rota.ts](../../apps/api/src/routers/rota.ts)                    | partial |
| `API-rota.approveSwap`                    | `rotaRouter.approveSwap` in [rota.ts](../../apps/api/src/routers/rota.ts)                    | partial |
| `API-rota.rejectSwap`                     | `rotaRouter.rejectSwap` in [rota.ts](../../apps/api/src/routers/rota.ts)                     | partial |

## API-email

Purpose: owns `email.*` in [emailRouter](../../apps/api/src/routers/email.ts). Status: partial. Canonical reuse point: extend this router.

uses / depends_on: `INF-auth`, `INF-db`; shared domains and services must be verified at imports. used_by: `appRouter.email` [root](../../apps/api/src/router.ts).

Client consumers: No direct TSX consumer found; other clients unknown.

Tests: [email.router.test.ts](../../apps/api/src/__tests__/email.router.test.ts)

| Stable subfeature ID | Canonical symbol and entry | Status |
| -------------------- | -------------------------- | ------ |

## API-registration

Purpose: owns `registration.*` in [registrationRouter](../../apps/api/src/routers/registration.ts). Status: partial. Canonical reuse point: extend this router.

uses / depends_on: `INF-auth`, `INF-db`; shared domains and services must be verified at imports. used_by: `appRouter.registration` [root](../../apps/api/src/router.ts).

Client consumers: [registration-form.tsx](../../apps/web/src/app/registration/registration-form.tsx), [parent-link-requests-client.tsx](../../apps/web/src/app/parent-link-requests/parent-link-requests-client.tsx), [children-check-client.tsx](../../apps/web/src/app/children-check/children-check-client.tsx), [student-registration-panel.tsx](<../../apps/web/src/app/(admin)/admin/students/[id]/student-registration-panel.tsx>), [parent-dashboard-client.tsx](<../../apps/web/src/app/(parent)/parent/parent-dashboard-client.tsx>), [sibling-add-modal.tsx](<../../apps/web/src/app/(parent)/parent/registration/sibling-add-modal.tsx>), [parent-profile-registration-screen.tsx](../../apps/mobile/src/components/parent/parent-profile-registration-screen.tsx), [parent-portal-screen.tsx](../../apps/mobile/src/components/parent/parent-portal-screen.tsx)

Tests: [registration.router.test.ts](../../apps/api/src/__tests__/registration.router.test.ts)

| Stable subfeature ID | Canonical symbol and entry | Status |
| -------------------- | -------------------------- | ------ |

## API-invoice

Purpose: owns `invoice.*` in [invoiceRouter](../../apps/api/src/routers/invoice.ts). Status: partial. Canonical reuse point: extend this router.

uses / depends_on: `INF-auth`, `INF-db`; shared domains and services must be verified at imports. used_by: `appRouter.invoice` [root](../../apps/api/src/router.ts).

Client consumers: [admin-invoices-client.tsx](../../apps/web/src/components/invoices/admin-invoices-client.tsx), [parent-fees-client.tsx](../../apps/web/src/components/invoices/parent-fees-client.tsx), [student-drillthrough-content.tsx](../../apps/web/src/components/student-drillthrough/student-drillthrough-content.tsx), [parent-home-screen.tsx](../../apps/mobile/src/components/parent/parent-home-screen.tsx), [parent-fees-invoices-detail.tsx](../../apps/mobile/src/components/parent/parent-fees-invoices-detail.tsx), [parent-portal-screen.tsx](../../apps/mobile/src/components/parent/parent-portal-screen.tsx)

Tests: [invoice-past-due-reminders.test.ts](../../apps/api/src/__tests__/invoice-past-due-reminders.test.ts), [invoice.router.test.ts](../../apps/api/src/__tests__/invoice.router.test.ts)

| Stable subfeature ID | Canonical symbol and entry | Status |
| -------------------- | -------------------------- | ------ |

## API-permissionSlip

Purpose: owns `permissionSlip.*` in [permissionSlipRouter](../../apps/api/src/routers/permissionSlip.ts). Status: partial. Canonical reuse point: extend this router.

uses / depends_on: `INF-auth`, `INF-db`; shared domains and services must be verified at imports. used_by: `appRouter.permissionSlip` [root](../../apps/api/src/router.ts).

Client consumers: [admin-permission-slips-client.tsx](../../apps/web/src/components/permission-slips/admin-permission-slips-client.tsx), [parent-permission-slips-client.tsx](../../apps/web/src/components/permission-slips/parent-permission-slips-client.tsx), [parent-home-screen.tsx](../../apps/mobile/src/components/parent/parent-home-screen.tsx), [parent-portal-screen.tsx](../../apps/mobile/src/components/parent/parent-portal-screen.tsx), [parent-permission-slips-detail.tsx](../../apps/mobile/src/components/parent/parent-permission-slips-detail.tsx)

Tests: [permissionSlip.router.test.ts](../../apps/api/src/__tests__/permissionSlip.router.test.ts)

| Stable subfeature ID                       | Canonical symbol and entry                                                                                        | Status  |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- | ------- |
| `API-permissionSlip.listStudentCandidates` | `permissionSlipRouter.listStudentCandidates` in [permissionSlip.ts](../../apps/api/src/routers/permissionSlip.ts) | partial |
| `API-permissionSlip.listAdmin`             | `permissionSlipRouter.listAdmin` in [permissionSlip.ts](../../apps/api/src/routers/permissionSlip.ts)             | partial |
| `API-permissionSlip.listParent`            | `permissionSlipRouter.listParent` in [permissionSlip.ts](../../apps/api/src/routers/permissionSlip.ts)            | partial |
| `API-permissionSlip.create`                | `permissionSlipRouter.create` in [permissionSlip.ts](../../apps/api/src/routers/permissionSlip.ts)                | partial |
| `API-permissionSlip.update`                | `permissionSlipRouter.update` in [permissionSlip.ts](../../apps/api/src/routers/permissionSlip.ts)                | partial |
| `API-permissionSlip.archive`               | `permissionSlipRouter.archive` in [permissionSlip.ts](../../apps/api/src/routers/permissionSlip.ts)               | partial |
| `API-permissionSlip.submitParentResponse`  | `permissionSlipRouter.submitParentResponse` in [permissionSlip.ts](../../apps/api/src/routers/permissionSlip.ts)  | partial |
| `API-permissionSlip.parentMarkPaid`        | `permissionSlipRouter.parentMarkPaid` in [permissionSlip.ts](../../apps/api/src/routers/permissionSlip.ts)        | partial |
| `API-permissionSlip.markPhysicalSigned`    | `permissionSlipRouter.markPhysicalSigned` in [permissionSlip.ts](../../apps/api/src/routers/permissionSlip.ts)    | partial |
| `API-permissionSlip.confirmPayment`        | `permissionSlipRouter.confirmPayment` in [permissionSlip.ts](../../apps/api/src/routers/permissionSlip.ts)        | partial |
| `API-permissionSlip.rejectPayment`         | `permissionSlipRouter.rejectPayment` in [permissionSlip.ts](../../apps/api/src/routers/permissionSlip.ts)         | partial |

## API-incident

Purpose: owns `incident.*` in [incidentRouter](../../apps/api/src/routers/incident.ts). Status: partial. Canonical reuse point: extend this router.

uses / depends_on: `INF-auth`, `INF-db`; shared domains and services must be verified at imports. used_by: `appRouter.incident` [root](../../apps/api/src/router.ts).

Client consumers: [incident-parent-portal.tsx](../../apps/web/src/components/incidents/incident-parent-portal.tsx), [incident-staff-workflow.tsx](../../apps/web/src/components/incidents/incident-staff-workflow.tsx), [incident-safeguarding-notes.tsx](../../apps/web/src/components/incidents/incident-safeguarding-notes.tsx), [parent-incident-reports-screen.tsx](../../apps/mobile/src/components/parent/parent-incident-reports-screen.tsx), [staff-incident-screen.tsx](../../apps/mobile/src/components/staff/staff-incident-screen.tsx)

Tests: [incident-safeguarding-notes.test.ts](../../apps/api/src/__tests__/incident-safeguarding-notes.test.ts), [incident.router.test.ts](../../apps/api/src/__tests__/incident.router.test.ts)

| Stable subfeature ID                 | Canonical symbol and entry                                                                      | Status  |
| ------------------------------------ | ----------------------------------------------------------------------------------------------- | ------- |
| `API-incident.actor`                 | `incidentRouter.actor` in [incident.ts](../../apps/api/src/routers/incident.ts)                 | partial |
| `API-incident.listStudentOptions`    | `incidentRouter.listStudentOptions` in [incident.ts](../../apps/api/src/routers/incident.ts)    | partial |
| `API-incident.listStaffOptions`      | `incidentRouter.listStaffOptions` in [incident.ts](../../apps/api/src/routers/incident.ts)      | partial |
| `API-incident.listStaff`             | `incidentRouter.listStaff` in [incident.ts](../../apps/api/src/routers/incident.ts)             | partial |
| `API-incident.getStaff`              | `incidentRouter.getStaff` in [incident.ts](../../apps/api/src/routers/incident.ts)              | partial |
| `API-incident.createDraft`           | `incidentRouter.createDraft` in [incident.ts](../../apps/api/src/routers/incident.ts)           | partial |
| `API-incident.updateDraft`           | `incidentRouter.updateDraft` in [incident.ts](../../apps/api/src/routers/incident.ts)           | partial |
| `API-incident.submitForHeadReview`   | `incidentRouter.submitForHeadReview` in [incident.ts](../../apps/api/src/routers/incident.ts)   | partial |
| `API-incident.deleteDraft`           | `incidentRouter.deleteDraft` in [incident.ts](../../apps/api/src/routers/incident.ts)           | partial |
| `API-incident.signOff`               | `incidentRouter.signOff` in [incident.ts](../../apps/api/src/routers/incident.ts)               | partial |
| `API-incident.escalate`              | `incidentRouter.escalate` in [incident.ts](../../apps/api/src/routers/incident.ts)              | partial |
| `API-incident.generateParentCopy`    | `incidentRouter.generateParentCopy` in [incident.ts](../../apps/api/src/routers/incident.ts)    | partial |
| `API-incident.shareParentCopy`       | `incidentRouter.shareParentCopy` in [incident.ts](../../apps/api/src/routers/incident.ts)       | partial |
| `API-incident.listParent`            | `incidentRouter.listParent` in [incident.ts](../../apps/api/src/routers/incident.ts)            | partial |
| `API-incident.getParentCopy`         | `incidentRouter.getParentCopy` in [incident.ts](../../apps/api/src/routers/incident.ts)         | partial |
| `API-incident.acknowledgeParentCopy` | `incidentRouter.acknowledgeParentCopy` in [incident.ts](../../apps/api/src/routers/incident.ts) | partial |
| `API-incident.downloadParentPdf`     | `incidentRouter.downloadParentPdf` in [incident.ts](../../apps/api/src/routers/incident.ts)     | partial |
| `API-incident.prepareAttachments`    | `incidentRouter.prepareAttachments` in [incident.ts](../../apps/api/src/routers/incident.ts)    | partial |
| `API-incident.downloadAttachment`    | `incidentRouter.downloadAttachment` in [incident.ts](../../apps/api/src/routers/incident.ts)    | partial |

## API-studentSettings

Purpose: owns `studentSettings.*` in [studentSettingsRouter](../../apps/api/src/routers/studentSettings.ts). Status: partial. Canonical reuse point: extend this router.

uses / depends_on: `INF-auth`, `INF-db`; shared domains and services must be verified at imports. used_by: `appRouter.studentSettings` [root](../../apps/api/src/router.ts).

Client consumers: [parent-student-settings-client.tsx](../../apps/web/src/components/parent/parent-student-settings-client.tsx), [student-portal-readiness-client.tsx](<../../apps/web/src/app/(admin)/admin/student-portal/student-portal-readiness-client.tsx>), [parent-student-settings-screen.tsx](../../apps/mobile/src/components/parent/parent-student-settings-screen.tsx)

Tests: [studentSettings.router.test.ts](../../apps/api/src/__tests__/studentSettings.router.test.ts)

| Stable subfeature ID | Canonical symbol and entry | Status |
| -------------------- | -------------------------- | ------ |

## API-faithCorner

Purpose: owns `faithCorner.*` in [faithCornerRouter](../../apps/api/src/routers/faithCorner.ts). Status: partial. Canonical reuse point: extend this router.

uses / depends_on: `INF-auth`, `INF-db`; shared domains and services must be verified at imports. used_by: `appRouter.faithCorner` [root](../../apps/api/src/router.ts).

Client consumers: [faith-corner-admin-client.tsx](../../apps/web/src/components/faith-corner/faith-corner-admin-client.tsx), [student-faith-client.tsx](../../apps/web/src/components/student/student-faith-client.tsx), [student-faith-comments-panel.tsx](../../apps/mobile/src/components/student/student-faith-comments-panel.tsx), [student-clubs-faith-screen.tsx](../../apps/mobile/src/components/student/student-clubs-faith-screen.tsx), [student-faith-corner-screen.tsx](../../apps/mobile/src/components/student/student-faith-corner-screen.tsx)

Tests: [faithCorner.router.test.ts](../../apps/api/src/__tests__/faithCorner.router.test.ts)

| Stable subfeature ID                      | Canonical symbol and entry                                                                                 | Status  |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------- |
| `API-faithCorner.currentForAdmin`         | `faithCornerRouter.currentForAdmin` in [faithCorner.ts](../../apps/api/src/routers/faithCorner.ts)         | partial |
| `API-faithCorner.currentForStudent`       | `faithCornerRouter.currentForStudent` in [faithCorner.ts](../../apps/api/src/routers/faithCorner.ts)       | partial |
| `API-faithCorner.listComments`            | `faithCornerRouter.listComments` in [faithCorner.ts](../../apps/api/src/routers/faithCorner.ts)            | partial |
| `API-faithCorner.toggleCurrentLike`       | `faithCornerRouter.toggleCurrentLike` in [faithCorner.ts](../../apps/api/src/routers/faithCorner.ts)       | partial |
| `API-faithCorner.submitComment`           | `faithCornerRouter.submitComment` in [faithCorner.ts](../../apps/api/src/routers/faithCorner.ts)           | partial |
| `API-faithCorner.toggleCommentLike`       | `faithCornerRouter.toggleCommentLike` in [faithCorner.ts](../../apps/api/src/routers/faithCorner.ts)       | partial |
| `API-faithCorner.pendingCommentsForAdmin` | `faithCornerRouter.pendingCommentsForAdmin` in [faithCorner.ts](../../apps/api/src/routers/faithCorner.ts) | partial |
| `API-faithCorner.reviewComment`           | `faithCornerRouter.reviewComment` in [faithCorner.ts](../../apps/api/src/routers/faithCorner.ts)           | partial |
| `API-faithCorner.publish`                 | `faithCornerRouter.publish` in [faithCorner.ts](../../apps/api/src/routers/faithCorner.ts)                 | partial |

## API-studentNotification

Purpose: owns `studentNotification.*` in [studentNotificationRouter](../../apps/api/src/routers/studentNotification.ts). Status: partial. Canonical reuse point: extend this router.

uses / depends_on: `INF-auth`, `INF-db`; shared domains and services must be verified at imports. used_by: `appRouter.studentNotification` [root](../../apps/api/src/router.ts).

Client consumers: [student-notifications-client.tsx](../../apps/web/src/components/student/student-notifications-client.tsx), [student-nav.tsx](../../apps/web/src/components/student/student-nav.tsx), [student-notification-admin-client.tsx](../../apps/web/src/components/student-notifications/student-notification-admin-client.tsx), [student-portal-screen.tsx](../../apps/mobile/src/components/student/student-portal-screen.tsx)

Tests: [studentNotification.router.test.ts](../../apps/api/src/__tests__/studentNotification.router.test.ts)

| Stable subfeature ID                  | Canonical symbol and entry                                                                                             | Status  |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------- |
| `API-studentNotification.list`        | `studentNotificationRouter.list` in [studentNotification.ts](../../apps/api/src/routers/studentNotification.ts)        | partial |
| `API-studentNotification.unreadCount` | `studentNotificationRouter.unreadCount` in [studentNotification.ts](../../apps/api/src/routers/studentNotification.ts) | partial |
| `API-studentNotification.markRead`    | `studentNotificationRouter.markRead` in [studentNotification.ts](../../apps/api/src/routers/studentNotification.ts)    | partial |
| `API-studentNotification.announce`    | `studentNotificationRouter.announce` in [studentNotification.ts](../../apps/api/src/routers/studentNotification.ts)    | partial |

## API-homework

Purpose: owns `homework.*` in [homeworkRouter](../../apps/api/src/routers/homework.ts). Status: partial. Canonical reuse point: extend this router.

uses / depends_on: `INF-auth`, `INF-db`; shared domains and services must be verified at imports. used_by: `appRouter.homework` [root](../../apps/api/src/router.ts).

Client consumers: [admin-homework-client.tsx](../../apps/web/src/components/homework/admin-homework-client.tsx), [student-homework-client.tsx](../../apps/web/src/components/homework/student-homework-client.tsx), [student-homework-activity-submit-panel.tsx](../../apps/mobile/src/components/student/student-homework-activity-submit-panel.tsx), [student-portal-screen.tsx](../../apps/mobile/src/components/student/student-portal-screen.tsx)

Tests: [homework.router.test.ts](../../apps/api/src/__tests__/homework.router.test.ts)

| Stable subfeature ID                        | Canonical symbol and entry                                                                             | Status  |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------- |
| `API-homework.createAssignment`             | `homeworkRouter.createAssignment` in [homework.ts](../../apps/api/src/routers/homework.ts)             | partial |
| `API-homework.updateAssignment`             | `homeworkRouter.updateAssignment` in [homework.ts](../../apps/api/src/routers/homework.ts)             | partial |
| `API-homework.adminAssignments`             | `homeworkRouter.adminAssignments` in [homework.ts](../../apps/api/src/routers/homework.ts)             | partial |
| `API-homework.reviewQueue`                  | `homeworkRouter.reviewQueue` in [homework.ts](../../apps/api/src/routers/homework.ts)                  | partial |
| `API-homework.studentDue`                   | `homeworkRouter.studentDue` in [homework.ts](../../apps/api/src/routers/homework.ts)                   | partial |
| `API-homework.studentGraded`                | `homeworkRouter.studentGraded` in [homework.ts](../../apps/api/src/routers/homework.ts)                | partial |
| `API-homework.prepareUpload`                | `homeworkRouter.prepareUpload` in [homework.ts](../../apps/api/src/routers/homework.ts)                | partial |
| `API-homework.submitUpload`                 | `homeworkRouter.submitUpload` in [homework.ts](../../apps/api/src/routers/homework.ts)                 | partial |
| `API-homework.reviewSubmission`             | `homeworkRouter.reviewSubmission` in [homework.ts](../../apps/api/src/routers/homework.ts)             | partial |
| `API-homework.prepareAssignmentImageUpload` | `homeworkRouter.prepareAssignmentImageUpload` in [homework.ts](../../apps/api/src/routers/homework.ts) | partial |
| `API-homework.attachAssignmentImage`        | `homeworkRouter.attachAssignmentImage` in [homework.ts](../../apps/api/src/routers/homework.ts)        | partial |
| `API-homework.downloadAssignmentImage`      | `homeworkRouter.downloadAssignmentImage` in [homework.ts](../../apps/api/src/routers/homework.ts)      | partial |
| `API-homework.downloadImage`                | `homeworkRouter.downloadImage` in [homework.ts](../../apps/api/src/routers/homework.ts)                | partial |

## API-staffHome

Purpose: owns `staffHome.*` in [staffHomeRouter](../../apps/api/src/routers/staffHome.ts). Status: partial. Canonical reuse point: extend this router.

uses / depends_on: `INF-auth`, `INF-db`; shared domains and services must be verified at imports. used_by: `appRouter.staffHome` [root](../../apps/api/src/router.ts).

Client consumers: [staff-home-screen.tsx](../../apps/mobile/src/components/staff/staff-home-screen.tsx)

Tests: [staffHome.router.test.ts](../../apps/api/src/__tests__/staffHome.router.test.ts)

| Stable subfeature ID    | Canonical symbol and entry                                                           | Status  |
| ----------------------- | ------------------------------------------------------------------------------------ | ------- |
| `API-staffHome.summary` | `staffHomeRouter.summary` in [staffHome.ts](../../apps/api/src/routers/staffHome.ts) | partial |

## API-academicInventory

Purpose: owns `academicInventory.*` in [academicInventoryRouter](../../apps/api/src/routers/academicInventory.ts). Status: partial. Canonical reuse point: extend this router.

uses / depends_on: `INF-auth`, `INF-db`; shared domains and services must be verified at imports. used_by: `appRouter.academicInventory` [root](../../apps/api/src/router.ts).

Client consumers: [pace-gap-plan-panel.tsx](../../apps/web/src/components/pace/pace-gap-plan-panel.tsx), [pace-inventory-orders.tsx](../../apps/web/src/components/pace/pace-inventory-orders.tsx), [pace-inventory-client.tsx](../../apps/web/src/components/pace/pace-inventory-client.tsx), [staff-academic-inventory-screen.tsx](../../apps/mobile/src/components/staff/staff-academic-inventory-screen.tsx), [staff-academic-inventory-history.tsx](../../apps/mobile/src/components/staff/staff-academic-inventory-history.tsx), [staff-academic-inventory-order-list.tsx](../../apps/mobile/src/components/staff/staff-academic-inventory-order-list.tsx), [staff-academic-gap-plan.tsx](../../apps/mobile/src/components/staff/staff-academic-gap-plan.tsx)

Tests: [academicInventory.router.test.ts](../../apps/api/src/__tests__/academicInventory.router.test.ts)

| Stable subfeature ID                          | Canonical symbol and entry                                                                                                 | Status  |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------- |
| `API-academicInventory.summary`               | `academicInventoryRouter.summary` in [academicInventory.ts](../../apps/api/src/routers/academicInventory.ts)               | partial |
| `API-academicInventory.ordersForStudent`      | `academicInventoryRouter.ordersForStudent` in [academicInventory.ts](../../apps/api/src/routers/academicInventory.ts)      | partial |
| `API-academicInventory.diagnosticsHistory`    | `academicInventoryRouter.diagnosticsHistory` in [academicInventory.ts](../../apps/api/src/routers/academicInventory.ts)    | partial |
| `API-academicInventory.gapPlansForAssignment` | `academicInventoryRouter.gapPlansForAssignment` in [academicInventory.ts](../../apps/api/src/routers/academicInventory.ts) | partial |
| `API-academicInventory.createGapPlan`         | `academicInventoryRouter.createGapPlan` in [academicInventory.ts](../../apps/api/src/routers/academicInventory.ts)         | partial |
| `API-academicInventory.updateGapPlan`         | `academicInventoryRouter.updateGapPlan` in [academicInventory.ts](../../apps/api/src/routers/academicInventory.ts)         | partial |
| `API-academicInventory.cancelGapPlan`         | `academicInventoryRouter.cancelGapPlan` in [academicInventory.ts](../../apps/api/src/routers/academicInventory.ts)         | partial |
| `API-academicInventory.reviewGapPlan`         | `academicInventoryRouter.reviewGapPlan` in [academicInventory.ts](../../apps/api/src/routers/academicInventory.ts)         | partial |
| `API-academicInventory.createOrder`           | `academicInventoryRouter.createOrder` in [academicInventory.ts](../../apps/api/src/routers/academicInventory.ts)           | partial |
| `API-academicInventory.addCurrentSupply`      | `academicInventoryRouter.addCurrentSupply` in [academicInventory.ts](../../apps/api/src/routers/academicInventory.ts)      | partial |
| `API-academicInventory.createOrders`          | `academicInventoryRouter.createOrders` in [academicInventory.ts](../../apps/api/src/routers/academicInventory.ts)          | partial |
| `API-academicInventory.updateOrderStatus`     | `academicInventoryRouter.updateOrderStatus` in [academicInventory.ts](../../apps/api/src/routers/academicInventory.ts)     | partial |
| `API-academicInventory.markOrdersInTransit`   | `academicInventoryRouter.markOrdersInTransit` in [academicInventory.ts](../../apps/api/src/routers/academicInventory.ts)   | partial |
| `API-academicInventory.markOrdersDelivered`   | `academicInventoryRouter.markOrdersDelivered` in [academicInventory.ts](../../apps/api/src/routers/academicInventory.ts)   | partial |
| `API-academicInventory.recordDiagnostic`      | `academicInventoryRouter.recordDiagnostic` in [academicInventory.ts](../../apps/api/src/routers/academicInventory.ts)      | partial |
| `API-academicInventory.deleteDiagnostic`      | `academicInventoryRouter.deleteDiagnostic` in [academicInventory.ts](../../apps/api/src/routers/academicInventory.ts)      | partial |

## API-personalTask

Purpose: owns `personalTask.*` in [personalTaskRouter](../../apps/api/src/routers/personalTask.ts). Status: partial. Canonical reuse point: extend this router.

uses / depends_on: `INF-auth`, `INF-db`; shared domains and services must be verified at imports. used_by: `appRouter.personalTask` [root](../../apps/api/src/router.ts).

Client consumers: [personal-tasks-client.tsx](../../apps/web/src/components/personal-tasks/personal-tasks-client.tsx)

Tests: No matching router test found; other verification unknown.

| Stable subfeature ID | Canonical symbol and entry | Status |
| -------------------- | -------------------------- | ------ |

## API-timetable

Purpose: owns `timetable.*` in [timetableRouter](../../apps/api/src/routers/timetable.ts). Status: partial. Canonical reuse point: extend this router.

uses / depends_on: `INF-auth`, `INF-db`; shared domains and services must be verified at imports. used_by: `appRouter.timetable` [root](../../apps/api/src/router.ts).

Client consumers: [published-timetable-client.tsx](../../apps/web/src/components/timetable/published-timetable-client.tsx), [head-timetable-client.tsx](../../apps/web/src/components/timetable/head-timetable-client.tsx), [student-portal-screen.tsx](../../apps/mobile/src/components/student/student-portal-screen.tsx), [parent-portal-screen.tsx](../../apps/mobile/src/components/parent/parent-portal-screen.tsx), [mobile-head-timetable-screen.tsx](../../apps/mobile/src/components/timetable/mobile-head-timetable-screen.tsx)

Tests: [timetable-data.test.ts](../../apps/api/src/__tests__/timetable-data.test.ts), [timetable-pdf.test.ts](../../apps/api/src/__tests__/timetable-pdf.test.ts), [timetable-publications.test.ts](../../apps/api/src/__tests__/timetable-publications.test.ts), [timetable-tasks.test.ts](../../apps/api/src/__tests__/timetable-tasks.test.ts), [timetable-terms.test.ts](../../apps/api/src/__tests__/timetable-terms.test.ts), [timetable.router.test.ts](../../apps/api/src/__tests__/timetable.router.test.ts)

| Stable subfeature ID | Canonical symbol and entry | Status |
| -------------------- | -------------------------- | ------ |

## API-library

Purpose: owns `library.*` in [libraryRouter](../../apps/api/src/routers/library.ts). Status: partial. Canonical reuse point: extend this router.

uses / depends_on: `INF-auth`, `INF-db`; shared domains and services must be verified at imports. used_by: `appRouter.library` [root](../../apps/api/src/router.ts).

Client consumers: [library-book-editor.tsx](../../apps/web/src/components/library/library-book-editor.tsx), [parent-library-client.tsx](../../apps/web/src/components/library/parent-library-client.tsx), [library-workflow-client.tsx](../../apps/web/src/components/library/library-workflow-client.tsx), [library-book-editor.tsx](../../apps/mobile/src/components/library/library-book-editor.tsx), [parent-library-screen.tsx](../../apps/mobile/src/components/parent/parent-library-screen.tsx), [parent-portal-screen.tsx](../../apps/mobile/src/components/parent/parent-portal-screen.tsx), [staff-library-screen.tsx](../../apps/mobile/src/components/staff/staff-library-screen.tsx)

Tests: [library-cover-storage.test.ts](../../apps/api/src/__tests__/library-cover-storage.test.ts), [library.router.test.ts](../../apps/api/src/__tests__/library.router.test.ts)

| Stable subfeature ID             | Canonical symbol and entry                                                                | Status  |
| -------------------------------- | ----------------------------------------------------------------------------------------- | ------- |
| `API-library.canManage`          | `libraryRouter.canManage` in [library.ts](../../apps/api/src/routers/library.ts)          | partial |
| `API-library.catalogue`          | `libraryRouter.catalogue` in [library.ts](../../apps/api/src/routers/library.ts)          | partial |
| `API-library.cataloguePage`      | `libraryRouter.cataloguePage` in [library.ts](../../apps/api/src/routers/library.ts)      | partial |
| `API-library.parentCatalogue`    | `libraryRouter.parentCatalogue` in [library.ts](../../apps/api/src/routers/library.ts)    | partial |
| `API-library.lookupBarcode`      | `libraryRouter.lookupBarcode` in [library.ts](../../apps/api/src/routers/library.ts)      | partial |
| `API-library.borrowers`          | `libraryRouter.borrowers` in [library.ts](../../apps/api/src/routers/library.ts)          | partial |
| `API-library.loans`              | `libraryRouter.loans` in [library.ts](../../apps/api/src/routers/library.ts)              | partial |
| `API-library.prepareCoverUpload` | `libraryRouter.prepareCoverUpload` in [library.ts](../../apps/api/src/routers/library.ts) | partial |
| `API-library.createBook`         | `libraryRouter.createBook` in [library.ts](../../apps/api/src/routers/library.ts)         | partial |
| `API-library.updateBook`         | `libraryRouter.updateBook` in [library.ts](../../apps/api/src/routers/library.ts)         | partial |
| `API-library.retireBook`         | `libraryRouter.retireBook` in [library.ts](../../apps/api/src/routers/library.ts)         | partial |
| `API-library.checkout`           | `libraryRouter.checkout` in [library.ts](../../apps/api/src/routers/library.ts)           | partial |
| `API-library.checkin`            | `libraryRouter.checkin` in [library.ts](../../apps/api/src/routers/library.ts)            | partial |
| `API-library.parentSummary`      | `libraryRouter.parentSummary` in [library.ts](../../apps/api/src/routers/library.ts)      | partial |

New verified library read subfeatures (see [Library](library.md)):

| Stable ID                         | Entry / connections                                                                                                                                        | Status      |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| `API-library.circulationPage`     | `libraryRouter.circulationPage` uses `readCirculationPage`, `LIB-circulation`, `INF-db`, `INF-auth`; used_by staff loan tables and exact-book return lists | implemented |
| `API-library.borrowerHistoryPage` | `libraryRouter.borrowerHistoryPage` uses `readBorrowerHistoryPage`, Student.libraryLoans, `INF-db`, `INF-auth`; used_by web/native student accordions      | implemented |

## API-compliance

Purpose: owns `compliance.*` in [complianceRouter](../../apps/api/src/routers/compliance.ts). Status: partial. Canonical reuse point: extend this router.

uses / depends_on: `INF-auth`, `INF-db`; shared domains and services must be verified at imports. used_by: `appRouter.compliance` [root](../../apps/api/src/router.ts).

Client consumers: [adult-name-badges.tsx](../../apps/web/src/components/compliance/adult-name-badges.tsx), [update-compliance-modal.tsx](../../apps/web/src/app/compliance/update-compliance-modal.tsx), [register-client.tsx](../../apps/web/src/app/compliance/register-client.tsx), [medtab-client.tsx](../../apps/web/src/app/compliance/medtab-client.tsx)

Tests: [compliance.router.test.ts](../../apps/api/src/__tests__/compliance.router.test.ts)

| Stable subfeature ID               | Canonical symbol and entry                                                                        | Status  |
| ---------------------------------- | ------------------------------------------------------------------------------------------------- | ------- |
| `API-compliance.peopleOptions`     | `complianceRouter.peopleOptions` in [compliance.ts](../../apps/api/src/routers/compliance.ts)     | partial |
| `API-compliance.register`          | `complianceRouter.register` in [compliance.ts](../../apps/api/src/routers/compliance.ts)          | partial |
| `API-compliance.person`            | `complianceRouter.person` in [compliance.ts](../../apps/api/src/routers/compliance.ts)            | partial |
| `API-compliance.update`            | `complianceRouter.update` in [compliance.ts](../../apps/api/src/routers/compliance.ts)            | partial |
| `API-compliance.medTab`            | `complianceRouter.medTab` in [compliance.ts](../../apps/api/src/routers/compliance.ts)            | partial |
| `API-compliance.badgeSummaries`    | `complianceRouter.badgeSummaries` in [compliance.ts](../../apps/api/src/routers/compliance.ts)    | partial |
| `API-compliance.allBadgeSummaries` | `complianceRouter.allBadgeSummaries` in [compliance.ts](../../apps/api/src/routers/compliance.ts) | partial |

## API-userAgreement

Purpose: owns `userAgreement.*` in [userAgreementRouter](../../apps/api/src/routers/userAgreement.ts). Status: partial. Canonical reuse point: extend this router.

uses / depends_on: `INF-auth`, `INF-db`; shared domains and services must be verified at imports. used_by: `appRouter.userAgreement` [root](../../apps/api/src/router.ts).

Client consumers: [signing-register-entry.tsx](../../apps/web/src/components/agreements/signing-register-entry.tsx), [head-upload.tsx](../../apps/web/src/components/agreements/head-upload.tsx), [manage-agreements.tsx](../../apps/web/src/components/agreements/manage-agreements.tsx), [my-agreements.tsx](../../apps/web/src/components/agreements/my-agreements.tsx), [mobile-agreements.tsx](../../apps/mobile/src/components/agreements/mobile-agreements.tsx), [technical-support-portal-screen.tsx](../../apps/mobile/src/components/support/technical-support-portal-screen.tsx), [parent-portal-screen.tsx](../../apps/mobile/src/components/parent/parent-portal-screen.tsx), [staff-home-screen.tsx](../../apps/mobile/src/components/staff/staff-home-screen.tsx)

Tests: [userAgreement.router.test.ts](../../apps/api/src/__tests__/userAgreement.router.test.ts)

| Stable subfeature ID | Canonical symbol and entry | Status |
| -------------------- | -------------------------- | ------ |

## API-pushNotification

Status: partial. Canonical owner: [pushNotificationRouter](../../apps/api/src/routers/pushNotification.ts), registered at `appRouter.pushNotification`. Device registration and revocation procedures use `INF-auth`, `INF-db`; consumers include mobile push registration and existing push-notification tests. This domain was added on current GitHub main and was absent from the older local checkout. Exact procedure permissions and runtime delivery remain outside this task's audit.
