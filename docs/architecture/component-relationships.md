# Oasis Product Module Relationships

This document is the repo-level map for how Oasis Portal product modules fit together. It is designed for future agents before they add a router, workflow, UI surface, helper, or shared component.

Graphify remains the factual source for code relationships. This document adds the human architecture layer: what each module owns, where to look first, and when reuse is required.

## Anti-Duplication Rule

Before creating a new module, route, workflow component, or helper:

1. Search this document for the product area.
2. Run `graphify query "<product area> <intended capability>" --budget 1500`.
3. Check the owning API router, domain helper, and UI surfaces listed below.
4. Extend the existing owner unless the new work has a clearly separate responsibility.
5. If a new owner is needed, add it to this map in the same PR.

Do not create duplicate components because a file was hard to find. The graph and this map are the first lookup path.

## Agent PR Workflow

At PR start:

1. Read this document before planning feature, fix, refactor, or UI work.
2. Identify the affected product module or modules.
3. Run `graphify query "<affected product area> <intended change>" --budget 1500`.
4. Reuse or extend the listed owner unless the new work has a clearly separate responsibility.

Before PR completion:

1. Check whether the PR added, removed, renamed, or moved an API router, domain helper, UI surface, shared component, product workflow, database/RLS/encryption owner, or cross-app client.
2. If product ownership changed, update `PRODUCT_MODULES` in `scripts/generate-component-map.mjs`.
3. Run `pnpm docs:component-map`.
4. Include the regenerated map in the PR.

## Module Boundaries

- Product modules own workflows and business capabilities.
- API routers own request boundaries, input validation, permission checks, and service orchestration.
- `packages/domain` owns pure business rules and reusable domain helpers.
- Web and mobile surfaces should stay thin and call the existing tRPC/domain owners.
- Shared UI primitives live under the shared UI/component paths and should be reused before page-local variants are created.
- Database, RLS, and encryption helpers are infrastructure owners, not feature modules.

<!-- COMPONENT_MAP:START -->

## Generated Module Relationship Map

Generated from `graphify-out/graph.json` with 4072 graph nodes and 6697 graph links.

Graph confidence labels are preserved so agents can distinguish extracted code relationships from inferred relationships.

### Identity, Clerk sync, sessions, and post-sign-in routing

- Owns: Authentication handoff, Clerk webhook sync, session context, MFA flow, and portal routing after sign-in.
- API routers:
  - `apps/api/src/routers/clerkWebhook.ts`
  - `apps/api/src/routers/health.ts`
- Domain helpers:
  - `packages/domain/src/rbac.ts`
  - `packages/domain/src/users.ts`
- Web surfaces:
  - `apps/web/src/app/(auth)/`
  - `apps/web/src/app/children-check/`
  - `apps/web/src/app/not-ready/`
  - `apps/web/src/app/post-sign-in/`
  - `apps/web/src/components/auth/`
  - `apps/web/src/middleware.ts`
- Mobile surfaces:
  - `apps/mobile/app/_layout.tsx`
  - `apps/mobile/app/index.tsx`
  - `apps/mobile/app/sso-callback.tsx`
- Shared or infrastructure surfaces:
  - `apps/api/src/context.ts`
  - `apps/api/src/lib/`
  - `apps/web/src/components/providers/`
- Graphify evidence: 77 nodes, 519 links, communities 0, 1, 5, 8, 9, 10, 30.
- Relationship types: calls: 426, contains: 73, imports_from: 19, method: 1.
- Confidence mix: INFERRED: 334, EXTRACTED: 185.
- Connected modules:
  - Registration, parent, student, supervisor, and admin shells (374)
  - Behaviour, merits, demerits, leaderboard, and child notes (373)
  - Attendance and rota workflows (366)
  - Admin access, users, invitations, audit, and profiles (361)
  - RBAC, permission tags, and access boundaries (359)

### RBAC, permission tags, and access boundaries

- Owns: Role checks, permission tags, workflow gates, access denied handling, and scope decisions.
- API routers:
  - `apps/api/src/routers/admin.ts`
  - `apps/api/src/routers/audit.ts`
- Domain helpers:
  - `packages/domain/src/leaderboard.ts`
  - `packages/domain/src/rbac.ts`
- Web surfaces:
  - `apps/web/src/components/admin/require-full-admin.tsx`
- Mobile surfaces:
  - _None configured_
- Shared or infrastructure surfaces:
  - `apps/api/src/context.ts`
  - `docs/adr/0003-sensitive-visibility-rbac-plus-rls.md`
- Graphify evidence: 77 nodes, 427 links, communities 0, 5, 6, 9, 30, 33.
- Relationship types: calls: 347, contains: 71, imports_from: 4, conceptually_related_to: 1, implements: 1, method: 1, rationale_for: 1, references: 1.
- Confidence mix: INFERRED: 277, EXTRACTED: 150.
- Connected modules:
  - Admin access, users, invitations, audit, and profiles (423)
  - Identity, Clerk sync, sessions, and post-sign-in routing (359)
  - Attendance and rota workflows (358)
  - Behaviour, merits, demerits, leaderboard, and child notes (358)
  - Registration, parent, student, supervisor, and admin shells (358)

### Admin access, users, invitations, audit, and profiles

- Owns: Admin shell, user access, invitations, account lifecycle, audit views, and profile administration.
- API routers:
  - `apps/api/src/routers/admin.ts`
  - `apps/api/src/routers/audit.ts`
  - `apps/api/src/routers/profile.ts`
  - `apps/api/src/routers/student.ts`
- Domain helpers:
  - `packages/domain/src/rbac.ts`
  - `packages/domain/src/users.ts`
- Web surfaces:
  - `apps/web/src/app/(admin)/`
  - `apps/web/src/components/admin/`
  - `apps/web/src/components/profile/`
- Mobile surfaces:
  - _None configured_
- Shared or infrastructure surfaces:
  - `apps/web/src/components/ui/`
- Graphify evidence: 95 nodes, 537 links, communities 0, 1, 5, 6, 9, 17, 30.
- Relationship types: calls: 438, contains: 90, imports_from: 8, method: 1.
- Confidence mix: INFERRED: 364, EXTRACTED: 173.
- Connected modules:
  - Registration, parent, student, supervisor, and admin shells (470)
  - RBAC, permission tags, and access boundaries (423)
  - Attendance and rota workflows (363)
  - Behaviour, merits, demerits, leaderboard, and child notes (363)
  - Identity, Clerk sync, sessions, and post-sign-in routing (361)

### Attendance and rota workflows

- Owns: Attendance capture, export, historical attendance, staff rota, and rota validation.
- API routers:
  - `apps/api/src/routers/attendance.ts`
  - `apps/api/src/routers/rota.ts`
- Domain helpers:
  - `packages/domain/src/rbac.ts`
- Web surfaces:
  - `apps/web/src/components/attendance/`
  - `apps/web/src/components/rota/`
  - `apps/web/src/components/student-drillthrough/attendance-calendar.tsx`
- Mobile surfaces:
  - `apps/mobile/src/components/smoke/`
  - `apps/mobile/src/components/staff/staff-attendance-roster.tsx`
  - `apps/mobile/src/components/staff/staff-attendance-screen.tsx`
  - `apps/mobile/src/components/staff/staff-attendance-summary.tsx`
  - `apps/mobile/src/components/staff/staff-attendance-utils.ts`
  - `apps/mobile/src/components/staff/staff-rota-availability-panel.tsx`
  - `apps/mobile/src/components/staff/staff-rota-common.tsx`
  - `apps/mobile/src/components/staff/staff-rota-rota-panel.tsx`
  - `apps/mobile/src/components/staff/staff-rota-screen.tsx`
  - `apps/mobile/src/components/staff/staff-rota-swap-panel.tsx`
  - `apps/mobile/src/components/staff/staff-rota-utils.ts`
- Shared or infrastructure surfaces:
  - `apps/web/src/components/ui/`
- Graphify evidence: 134 nodes, 519 links, communities 0, 1, 3, 5, 6, 9, 24, 30.
- Relationship types: calls: 401, contains: 116, imports_from: 1, method: 1.
- Confidence mix: INFERRED: 317, EXTRACTED: 202.
- Connected modules:
  - Registration, parent, student, supervisor, and admin shells (481)
  - Behaviour, merits, demerits, leaderboard, and child notes (422)
  - Identity, Clerk sync, sessions, and post-sign-in routing (366)
  - Admin access, users, invitations, audit, and profiles (363)
  - RBAC, permission tags, and access boundaries (358)

### Behaviour, merits, demerits, leaderboard, and child notes

- Owns: Behaviour logging, sensitive behaviour visibility, child notes, merit ledger rows, leaderboards, and the charity pot goal.
- API routers:
  - `apps/api/src/routers/behaviour.ts`
  - `apps/api/src/routers/childLog.ts`
  - `apps/api/src/routers/childNotes.ts`
  - `apps/api/src/routers/leaderboard.ts`
  - `apps/api/src/routers/meritLedger.ts`
- Domain helpers:
  - `packages/domain/src/leaderboard.ts`
  - `packages/domain/src/meritLedger.ts`
  - `packages/domain/src/rbac.ts`
- Web surfaces:
  - `apps/web/src/components/behaviour/`
  - `apps/web/src/components/child-log/`
  - `apps/web/src/components/leaderboard/`
  - `apps/web/src/components/student-drillthrough/notes-list.tsx`
- Mobile surfaces:
  - `apps/mobile/src/components/smoke/`
  - `apps/mobile/src/components/staff/staff-behaviour-form.tsx`
  - `apps/mobile/src/components/staff/staff-behaviour-recent-panel.tsx`
  - `apps/mobile/src/components/staff/staff-behaviour-screen.tsx`
  - `apps/mobile/src/components/staff/staff-behaviour-student-picker.tsx`
  - `apps/mobile/src/components/staff/staff-behaviour-utils.ts`
- Shared or infrastructure surfaces:
  - `apps/web/src/components/ui/`
- Graphify evidence: 167 nodes, 618 links, communities 0, 1, 5, 7, 8, 9, 10, 30.
- Relationship types: calls: 455, contains: 151, imports_from: 11, method: 1.
- Confidence mix: INFERRED: 362, EXTRACTED: 256.
- Connected modules:
  - Registration, parent, student, supervisor, and admin shells (448)
  - Attendance and rota workflows (422)
  - Identity, Clerk sync, sessions, and post-sign-in routing (373)
  - Admin access, users, invitations, audit, and profiles (363)
  - RBAC, permission tags, and access boundaries (358)

### Incident reports, staff review, and parent-safe release

- Owns: Incident recording, head sign-off, escalation review, encrypted parent copies, guardian release, acknowledgements, and PDF downloads.
- API routers:
  - `apps/api/src/routers/incident.ts`
- Domain helpers:
  - `packages/domain/src/incidents.ts`
- Web surfaces:
  - `apps/web/src/app/(admin)/admin/incidents/`
  - `apps/web/src/app/(parent)/parent/incidents/`
  - `apps/web/src/app/(supervisor)/supervisor/incidents/`
  - `apps/web/src/app/api/incidents/`
  - `apps/web/src/components/incidents/`
- Mobile surfaces:
  - `apps/mobile/src/components/parent/parent-incident-reports-screen.tsx`
  - `apps/mobile/src/components/parent/parent-incident-reports-wiring.test.ts`
  - `apps/mobile/src/components/staff/staff-incident-form-controls.tsx`
  - `apps/mobile/src/components/staff/staff-incident-form.tsx`
  - `apps/mobile/src/components/staff/staff-incident-review-panel.tsx`
  - `apps/mobile/src/components/staff/staff-incident-screen.tsx`
  - `apps/mobile/src/components/staff/staff-incident-student-picker.tsx`
  - `apps/mobile/src/components/staff/staff-incident-utils.ts`
- Shared or infrastructure surfaces:
  - `apps/api/src/incidents/`
  - `packages/db/prisma/migrations/20260528160000_incident_reports/`
- Graphify evidence: 33 nodes, 59 links, communities 22, 31, 250, 357, 360, 366, 369.
- Relationship types: calls: 34, contains: 25.
- Confidence mix: EXTRACTED: 31, INFERRED: 28.
- Connected modules:
  - Registration, parent, student, supervisor, and admin shells (41)
  - Shared UI primitives and cross-app tRPC clients (36)
  - Admin access, users, invitations, audit, and profiles (4)
  - Attendance and rota workflows (4)
  - Behaviour, merits, demerits, leaderboard, and child notes (4)

### PACE, subjects, school years, and academic progress

- Owns: PACE workflow, academic year rules, subject helpers, score entry, and progress display.
- API routers:
  - `apps/api/src/routers/pace.ts`
- Domain helpers:
  - `packages/domain/src/schoolYears.ts`
  - `packages/domain/src/subjects.ts`
- Web surfaces:
  - `apps/web/src/components/pace/`
- Mobile surfaces:
  - `apps/mobile/src/components/smoke/`
  - `apps/mobile/src/components/staff/staff-pace-form.tsx`
  - `apps/mobile/src/components/staff/staff-pace-screen.tsx`
  - `apps/mobile/src/components/staff/staff-pace-student-picker.tsx`
  - `apps/mobile/src/components/staff/staff-pace-subject-panel.tsx`
  - `apps/mobile/src/components/staff/staff-pace-utils.ts`
- Shared or infrastructure surfaces:
  - `apps/web/src/components/ui/`
- Graphify evidence: 93 nodes, 190 links, communities 0, 1, 10, 39, 40, 53, 96, 97.
- Relationship types: calls: 106, contains: 81, imports_from: 3.
- Confidence mix: EXTRACTED: 114, INFERRED: 76.
- Connected modules:
  - Registration, parent, student, supervisor, and admin shells (107)
  - Shared UI primitives and cross-app tRPC clients (99)
  - Attendance and rota workflows (73)
  - Behaviour, merits, demerits, leaderboard, and child notes (73)
  - Shop, invoices, clubs, calendar, tithe, savings, investment, reports, notices, messages, and email (41)

### Registration, parent, student, supervisor, and admin shells

- Owns: Portal shells, registration form flow, role-specific navigation, and cross-role dashboard entry points.
- API routers:
  - `apps/api/src/routers/profile.ts`
  - `apps/api/src/routers/registration.ts`
  - `apps/api/src/routers/staffHome.ts`
  - `apps/api/src/routers/student.ts`
  - `apps/api/src/routers/studentSettings.ts`
- Domain helpers:
  - `packages/domain/src/rbac.ts`
  - `packages/domain/src/registration.ts`
  - `packages/domain/src/studentPortalSettings.ts`
  - `packages/domain/src/users.ts`
- Web surfaces:
  - `apps/web/src/app/(admin)/`
  - `apps/web/src/app/(clubs-lead)/`
  - `apps/web/src/app/(parent)/`
  - `apps/web/src/app/(student)/`
  - `apps/web/src/app/(supervisor)/`
  - `apps/web/src/app/registration/`
  - `apps/web/src/components/navigation/`
  - `apps/web/src/components/student/`
  - `apps/web/src/components/supervisor/`
- Mobile surfaces:
  - `apps/mobile/app/`
  - `apps/mobile/src/components/`
  - `apps/mobile/src/components/staff/`
  - `apps/mobile/src/components/student/`
- Shared or infrastructure surfaces:
  - `apps/api/src/lib/student-portal-access.ts`
  - `apps/web/src/components/ui/`
  - `packages/db/prisma/migrations/20260603211500_student_portal_usage_minutes/`
- Graphify evidence: 632 nodes, 1333 links, communities 0, 1, 3, 5, 6, 9, 10, 17.
- Relationship types: calls: 840, contains: 484, imports_from: 8, method: 1.
- Confidence mix: INFERRED: 685, EXTRACTED: 648.
- Connected modules:
  - Shared UI primitives and cross-app tRPC clients (737)
  - Shop, invoices, clubs, calendar, tithe, savings, investment, reports, notices, messages, and email (538)
  - Attendance and rota workflows (481)
  - Admin access, users, invitations, audit, and profiles (470)
  - Behaviour, merits, demerits, leaderboard, and child notes (448)

### Faith Corner managed student content

- Owns: Managed weekly Scripture memory, reflection prompts, optional verse-of-day content, and read-only student Faith Corner views.
- API routers:
  - `apps/api/src/routers/faithCorner.ts`
- Domain helpers:
  - _None configured_
- Web surfaces:
  - `apps/web/src/app/(admin)/admin/faith-corner/`
  - `apps/web/src/app/(student)/student/faith/`
  - `apps/web/src/components/faith-corner/`
  - `apps/web/src/components/student/`
- Mobile surfaces:
  - _None configured_
- Shared or infrastructure surfaces:
  - `apps/api/src/services/faith-corner.ts`
  - `packages/db/prisma/migrations/20260604034500_faith_corner_content/`
- Graphify evidence: 0 nodes, 13 links, communities none.
- Relationship types: calls: 13.
- Confidence mix: INFERRED: 13.
- Connected modules:
  - Registration, parent, student, supervisor, and admin shells (11)
  - Student notification centre and announcements (10)
  - Admin access, users, invitations, audit, and profiles (1)
  - Homework assignments, submissions, and review (1)
  - Shop, invoices, clubs, calendar, tithe, savings, investment, reports, notices, messages, and email (1)

### Student notification centre and announcements

- Owns: Student-targeted in-app notifications, unread state, manager announcements, and event-created student updates.
- API routers:
  - `apps/api/src/routers/studentNotification.ts`
- Domain helpers:
  - _None configured_
- Web surfaces:
  - `apps/web/src/app/(admin)/admin/student-notifications/`
  - `apps/web/src/app/(student)/student/notifications/`
  - `apps/web/src/components/student-notifications/`
  - `apps/web/src/components/student/`
- Mobile surfaces:
  - `apps/mobile/src/components/student/student-notifications-*.tsx`
- Shared or infrastructure surfaces:
  - `apps/api/src/services/student-notifications.ts`
  - `packages/db/prisma/migrations/20260604052000_student_notifications/`
- Graphify evidence: 0 nodes, 14 links, communities none.
- Relationship types: calls: 14.
- Confidence mix: INFERRED: 14.
- Connected modules:
  - Registration, parent, student, supervisor, and admin shells (11)
  - Faith Corner managed student content (10)
  - Admin access, users, invitations, audit, and profiles (1)
  - Homework assignments, submissions, and review (1)
  - Shop, invoices, clubs, calendar, tithe, savings, investment, reports, notices, messages, and email (1)

### Homework assignments, submissions, and review

- Owns: Head-created homework assignments, age-band targeting, student image submissions, in-person evidence uploads, review comments, scores, and linked homework merit awards.
- API routers:
  - `apps/api/src/routers/homework.ts`
- Domain helpers:
  - `packages/domain/src/meritLedger.ts`
  - `packages/domain/src/schoolYears.ts`
- Web surfaces:
  - `apps/web/src/app/(admin)/admin/homework/`
  - `apps/web/src/app/(student)/student/homework/`
  - `apps/web/src/app/api/homework/`
  - `apps/web/src/components/admin/admin-nav.tsx`
  - `apps/web/src/components/homework/`
  - `apps/web/src/components/student/student-nav.tsx`
- Mobile surfaces:
  - _None configured_
- Shared or infrastructure surfaces:
  - `apps/api/src/services/homework-submission-storage.ts`
  - `packages/db/prisma/migrations/20260609111500_homework_portal/`
- Graphify evidence: 0 nodes, 28 links, communities none.
- Relationship types: calls: 28.
- Confidence mix: INFERRED: 28.
- Connected modules:
  - PACE, subjects, school years, and academic progress (13)
  - Shop, invoices, clubs, calendar, tithe, savings, investment, reports, notices, messages, and email (6)
  - Admin access, users, invitations, audit, and profiles (3)
  - Student community messaging and moderation (3)
  - Registration, parent, student, supervisor, and admin shells (2)

### Student community messaging and moderation

- Owns: Student community groups, central all-student chat, text-only messages, read receipts, group membership, and full-admin moderation controls.
- API routers:
  - `apps/api/src/routers/community.ts`
- Domain helpers:
  - `packages/domain/src/rbac.ts`
- Web surfaces:
  - `apps/web/src/app/(admin)/admin/community/`
  - `apps/web/src/app/(student)/student/community/`
  - `apps/web/src/components/admin/admin-nav.tsx`
  - `apps/web/src/components/community/`
  - `apps/web/src/components/student/student-nav.tsx`
- Mobile surfaces:
  - _None configured_
- Shared or infrastructure surfaces:
  - `apps/web/src/components/providers/realtime-provider.tsx`
  - `apps/web/src/lib/realtime/events.ts`
  - `packages/db/prisma/migrations/20260612180000_student_community/`
- Graphify evidence: 49 nodes, 370 links, communities 0, 5, 9, 30.
- Relationship types: calls: 321, contains: 47, imports_from: 1, method: 1.
- Confidence mix: INFERRED: 261, EXTRACTED: 109.
- Connected modules:
  - Admin access, users, invitations, audit, and profiles (360)
  - Registration, parent, student, supervisor, and admin shells (359)
  - Attendance and rota workflows (358)
  - Behaviour, merits, demerits, leaderboard, and child notes (358)
  - Identity, Clerk sync, sessions, and post-sign-in routing (358)

### Shop, invoices, clubs, calendar, tithe, savings, investment, reports, notices, messages, and email

- Owns: Commercial, wallet, finance, calendar, and communication workflows that hang off student, parent, staff, and admin experiences.
- API routers:
  - `apps/api/src/routers/calendar.ts`
  - `apps/api/src/routers/club.ts`
  - `apps/api/src/routers/email.ts`
  - `apps/api/src/routers/investment.ts`
  - `apps/api/src/routers/invoice.ts`
  - `apps/api/src/routers/message.ts`
  - `apps/api/src/routers/notice.ts`
  - `apps/api/src/routers/permissionSlip.ts`
  - `apps/api/src/routers/report.ts`
  - `apps/api/src/routers/shop.ts`
  - `apps/api/src/routers/tithe.ts`
- Domain helpers:
  - `packages/domain/src/clubs.ts`
  - `packages/domain/src/investmentMarketData.ts`
  - `packages/domain/src/investmentSim.ts`
  - `packages/domain/src/investmentTransactions.ts`
  - `packages/domain/src/invoice.ts`
  - `packages/domain/src/permissionSlips.ts`
  - `packages/domain/src/report.ts`
  - `packages/domain/src/savings.ts`
  - `packages/domain/src/shop.ts`
  - `packages/domain/src/tithe.ts`
- Web surfaces:
  - `apps/web/src/app/(admin)/`
  - `apps/web/src/app/(clubs-lead)/`
  - `apps/web/src/app/(parent)/`
  - `apps/web/src/app/(student)/student/messages/`
  - `apps/web/src/app/(supervisor)/supervisor/shop/`
  - `apps/web/src/components/calendar/`
  - `apps/web/src/components/clubs/`
  - `apps/web/src/components/invoices/`
  - `apps/web/src/components/messages/`
  - `apps/web/src/components/noticeboard/`
  - `apps/web/src/components/permission-slips/`
  - `apps/web/src/components/reports/`
  - `apps/web/src/components/shop/`
  - `apps/web/src/components/ui/`
- Mobile surfaces:
  - `apps/mobile/src/components/messages/`
  - `apps/mobile/src/components/parent/parent-calendar-detail.tsx`
  - `apps/mobile/src/components/parent/parent-calendar-list.tsx`
  - `apps/mobile/src/components/parent/parent-calendar-screen.tsx`
  - `apps/mobile/src/components/parent/parent-calendar-utils.ts`
  - `apps/mobile/src/components/parent/parent-calendar-wiring.test.ts`
  - `apps/mobile/src/components/parent/parent-clubs-notices-wiring.test.ts`
  - `apps/mobile/src/components/parent/parent-clubs-screen.tsx`
  - `apps/mobile/src/components/parent/parent-fees-invoices-detail.tsx`
  - `apps/mobile/src/components/parent/parent-fees-invoices-list.tsx`
  - `apps/mobile/src/components/parent/parent-fees-invoices-screen.tsx`
  - `apps/mobile/src/components/parent/parent-fees-invoices-utils.ts`
  - `apps/mobile/src/components/parent/parent-fees-invoices-wiring.test.ts`
  - `apps/mobile/src/components/parent/parent-messages-screen.tsx`
  - `apps/mobile/src/components/parent/parent-messages-wiring.test.ts`
  - `apps/mobile/src/components/parent/parent-notices-screen.tsx`
  - `apps/mobile/src/components/parent/parent-permission-slips-detail.tsx`
  - `apps/mobile/src/components/parent/parent-permission-slips-list.tsx`
  - `apps/mobile/src/components/parent/parent-permission-slips-screen.tsx`
  - `apps/mobile/src/components/parent/parent-permission-slips-utils.ts`
  - `apps/mobile/src/components/parent/parent-permission-slips-wiring.test.ts`
  - `apps/mobile/src/components/parent/parent-shop-cart.tsx`
  - `apps/mobile/src/components/parent/parent-shop-catalog.tsx`
  - `apps/mobile/src/components/parent/parent-shop-reservations-list.tsx`
  - `apps/mobile/src/components/parent/parent-shop-reservations-screen.tsx`
  - `apps/mobile/src/components/parent/parent-shop-reservations-utils.ts`
  - `apps/mobile/src/components/parent/parent-shop-reservations-wiring.test.ts`
  - `apps/mobile/src/components/parent/parent-shop-tile.tsx`
  - `apps/mobile/src/components/smoke/parent-portal-smoke-screen.tsx`
  - `apps/mobile/src/components/smoke/parent-smoke-notices.tsx`
  - `apps/mobile/src/components/smoke/student-portal-smoke-screen.tsx`
  - `apps/mobile/src/components/staff/staff-club-lead-attendance.tsx`
  - `apps/mobile/src/components/staff/staff-club-lead-behaviour.tsx`
  - `apps/mobile/src/components/staff/staff-club-lead-noticeboard.tsx`
  - `apps/mobile/src/components/staff/staff-club-lead-overview.tsx`
  - `apps/mobile/src/components/staff/staff-club-lead-screen.tsx`
  - `apps/mobile/src/components/staff/staff-club-lead-switcher.tsx`
  - `apps/mobile/src/components/staff/staff-club-lead-utils.ts`
  - `apps/mobile/src/components/staff/staff-club-manager-attendance.tsx`
  - `apps/mobile/src/components/staff/staff-club-manager-club-list.tsx`
  - `apps/mobile/src/components/staff/staff-club-manager-notices.tsx`
  - `apps/mobile/src/components/staff/staff-club-manager-overview.tsx`
  - `apps/mobile/src/components/staff/staff-club-manager-roster.tsx`
  - `apps/mobile/src/components/staff/staff-club-manager-rota.tsx`
  - `apps/mobile/src/components/staff/staff-club-manager-screen.tsx`
  - `apps/mobile/src/components/staff/staff-club-manager-utils.ts`
  - `apps/mobile/src/components/staff/staff-communications-screen.tsx`
  - `apps/mobile/src/components/staff/staff-notices-panel.tsx`
  - `apps/mobile/src/components/student/student-access-gate-wiring.test.ts`
  - `apps/mobile/src/components/student/student-club-detail-panel.tsx`
  - `apps/mobile/src/components/student/student-clubs-faith-screen.tsx`
  - `apps/mobile/src/components/student/student-clubs-faith-utils.ts`
  - `apps/mobile/src/components/student/student-clubs-faith-wiring.test.ts`
  - `apps/mobile/src/components/student/student-clubs-panel.tsx`
  - `apps/mobile/src/components/student/student-faith-comments-panel.tsx`
  - `apps/mobile/src/components/student/student-faith-corner-panel.tsx`
  - `apps/mobile/src/components/student/student-home-screen.tsx`
  - `apps/mobile/src/components/student/student-home-wallet-wiring.test.ts`
  - `apps/mobile/src/components/student/student-homework-activity-detail.tsx`
  - `apps/mobile/src/components/student/student-homework-activity-list.tsx`
  - `apps/mobile/src/components/student/student-homework-activity-screen.tsx`
  - `apps/mobile/src/components/student/student-homework-activity-submit-panel.tsx`
  - `apps/mobile/src/components/student/student-homework-activity-utils.ts`
  - `apps/mobile/src/components/student/student-homework-activity-wiring.test.ts`
  - `apps/mobile/src/components/student/student-learning-attendance-panel.tsx`
  - `apps/mobile/src/components/student/student-learning-pace-panel.tsx`
  - `apps/mobile/src/components/student/student-learning-ranks-panel.tsx`
  - `apps/mobile/src/components/student/student-learning-screen.tsx`
  - `apps/mobile/src/components/student/student-learning-status-wiring.test.ts`
  - `apps/mobile/src/components/student/student-learning-utils.ts`
  - `apps/mobile/src/components/student/student-messages-screen.tsx`
  - `apps/mobile/src/components/student/student-messages-utils.ts`
  - `apps/mobile/src/components/student/student-messages-wiring.test.ts`
  - `apps/mobile/src/components/student/student-mobile-access-gate.tsx`
  - `apps/mobile/src/components/student/student-portal-screen.tsx`
  - `apps/mobile/src/components/student/student-wallet-actions-wiring.test.ts`
  - `apps/mobile/src/components/student/student-wallet-screen.tsx`
  - `apps/mobile/src/components/student/student-wallet-utils.ts`
- Shared or infrastructure surfaces:
  - `apps/api/src/emails/`
  - `apps/api/src/services/market-data/`
  - `apps/api/src/services/savings-interest.ts`
  - `packages/db/prisma/migrations/20260606160000_investment_market_snapshots/`
  - `packages/db/prisma/migrations/20260606163000_add_requested_lse_etfs/`
  - `packages/db/prisma/migrations/20260616120000_student_direct_messages/`
- Graphify evidence: 422 nodes, 1119 links, communities 0, 1, 8, 14, 19, 24, 26, 35.
- Relationship types: calls: 776, contains: 337, imports_from: 6.
- Confidence mix: INFERRED: 661, EXTRACTED: 458.
- Connected modules:
  - Registration, parent, student, supervisor, and admin shells (538)
  - Shared UI primitives and cross-app tRPC clients (321)
  - Admin access, users, invitations, audit, and profiles (185)
  - Behaviour, merits, demerits, leaderboard, and child notes (155)
  - Attendance and rota workflows (149)

### Shared UI primitives and cross-app tRPC clients

- Owns: Reusable UI primitives, tRPC providers, typed clients, mobile smoke primitives, and cross-app client plumbing.
- API routers:
  - _None configured_
- Domain helpers:
  - `packages/ui/src/index.ts`
- Web surfaces:
  - `apps/web/src/components/providers/`
  - `apps/web/src/components/ui/`
  - `apps/web/src/lib/`
- Mobile surfaces:
  - `apps/mobile/src/components/`
  - `apps/mobile/src/lib/`
  - `apps/mobile/src/types/`
- Shared or infrastructure surfaces:
  - `apps/api/src/router.ts`
  - `apps/api/src/trpc.ts`
- Graphify evidence: 564 nodes, 757 links, communities 1, 3, 6, 10, 19, 22, 24, 31.
- Relationship types: contains: 418, calls: 330, imports_from: 9.
- Confidence mix: EXTRACTED: 518, INFERRED: 239.
- Connected modules:
  - Registration, parent, student, supervisor, and admin shells (737)
  - Shop, invoices, clubs, calendar, tithe, savings, investment, reports, notices, messages, and email (321)
  - Attendance and rota workflows (126)
  - PACE, subjects, school years, and academic progress (99)
  - Behaviour, merits, demerits, leaderboard, and child notes (96)

### Database, RLS, encryption, and Supabase/Postgres support

- Owns: Database connection setup, Prisma helpers, RLS smoke checks, encryption, blind indexes, and migration support scripts.
- API routers:
  - _None configured_
- Domain helpers:
  - _None configured_
- Web surfaces:
  - `apps/web/src/lib/supabase/`
- Mobile surfaces:
  - _None configured_
- Shared or infrastructure surfaces:
  - `docs/adr/0006-pii-envelope-encryption-env-key.md`
  - `packages/db/prisma/`
  - `packages/db/scripts/`
  - `packages/db/src/`
- Graphify evidence: 4 nodes, 81 links, communities 33.
- Relationship types: calls: 75, rationale_for: 2, references: 2, conceptually_related_to: 1, implements: 1.
- Confidence mix: INFERRED: 76, EXTRACTED: 5.
- Connected modules:
  - Shop, invoices, clubs, calendar, tithe, savings, investment, reports, notices, messages, and email (14)
  - Shared UI primitives and cross-app tRPC clients (3)
  - Identity, Clerk sync, sessions, and post-sign-in routing (2)
  - RBAC, permission tags, and access boundaries (1)

<!-- COMPONENT_MAP:END -->

## Maintenance

- Regenerate this document after running `graphify update .`.
- Keep the human sections short and stable.
- Keep generated evidence factual. Do not hand-edit the generated section.
- When a product module gains a new router, domain file, or UI surface, update `scripts/generate-component-map.mjs` in the same PR.
