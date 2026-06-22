# Mobile Admin Views — Implementation Plan

Admin-only views that exist on the web portal but have no mobile equivalent yet. Ordered by operational priority.

## Already on mobile (no action needed)

Attendance, behaviour, incidents, PACE, rota, shop, clubs, communications, leaderboard, snapshot, noticeboard, messages.

## Views to build

### High priority

| View | Web route | Notes |
|------|-----------|-------|
| Students list | `/admin/students/` | Core admin lookup — search, filter by year group |
| Student detail | `/admin/students/[id]` | Profile, academic history, behaviour summary |
| Invoices | `/admin/invoices/` | Financial workflow — view, filter, status updates |
| Permission slips | `/admin/permission-slips/` | Approve / reject slips on the go |

### Medium priority

| View | Web route | Notes |
|------|-----------|-------|
| Staff profiles | `/admin/staff/` | View and manage staff accounts |
| User access | `/admin/access/` | Role and permission management |
| Reports | `/admin/reports/` | Extended reporting beyond snapshots |
| Community | `/admin/community/` | Community management |
| Student notifications | `/admin/student-notifications/` | Push comms to students |
| Calendar | `/admin/calendar/` | Admin calendar configuration |

### Low priority

| View | Web route | Notes |
|------|-----------|-------|
| Attendance (centre) | `/admin/attendance/center` | Centre-level attendance overview |
| Attendance (staff) | `/admin/attendance/staff` | Staff attendance tracking |
| Audit log | `/admin/audit/` | Compliance and security audit trail |
| Sensitive review | `/admin/sensitive-review/` | Sensitive behaviour review queue |
| Faith corner | `/admin/faith-corner/` | Content management |
| Homework | `/admin/homework/` | Homework management |
| Academic | `/admin/academic/` | Academic configuration |
| Student portal config | `/admin/student-portal/` | Portal feature flags |
| New student | `/admin/students/new` | Enrolment form |

## Implementation pattern

Add each new view as a route in the `StaffPortalRoute` union type in `apps/mobile/src/components/staff/staff-portal-screen.tsx`, then render it conditionally by active route — the same pattern used for attendance, behaviour, pace, etc.

Admin-gated features (e.g. bulk actions, user management) should check against the `isMobileFullAdmin` helper or extend it to include `TechnicalSupport` if full admin access is required.
