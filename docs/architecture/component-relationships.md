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

Generated from `graphify-out/graph.json` with 4233 graph nodes and 6843 graph links.

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
- Graphify evidence: 84 nodes, 524 links, communities 1, 2, 6, 8, 231, 233, 317, 358.
- Relationship types: calls: 426, contains: 75, imports_from: 22, method: 1.
- Confidence mix: INFERRED: 334, EXTRACTED: 190.
- Connected modules:
  - Registration, parent, student, supervisor, and admin shells (377)
  - Behaviour, merits, demerits, leaderboard, and child notes (374)
  - Attendance and rota workflows (367)
  - Admin access, users, invitations, audit, and profiles (362)
  - RBAC, permission tags, and access boundaries (360)

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
- Graphify evidence: 77 nodes, 428 links, communities 1, 2, 6, 11, 34.
- Relationship types: calls: 347, contains: 71, imports_from: 5, conceptually_related_to: 1, implements: 1, method: 1, rationale_for: 1, references: 1.
- Confidence mix: INFERRED: 277, EXTRACTED: 151.
- Connected modules:
  - Admin access, users, invitations, audit, and profiles (424)
  - Identity, Clerk sync, sessions, and post-sign-in routing (360)
  - Attendance and rota workflows (359)
  - Behaviour, merits, demerits, leaderboard, and child notes (359)
  - Registration, parent, student, supervisor, and admin shells (359)

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
- Graphify evidence: 111 nodes, 553 links, communities 0, 1, 2, 6, 10, 11, 12, 85.
- Relationship types: calls: 440, contains: 102, imports_from: 10, method: 1.
- Confidence mix: INFERRED: 365, EXTRACTED: 188.
- Connected modules:
  - Registration, parent, student, supervisor, and admin shells (481)
  - RBAC, permission tags, and access boundaries (424)
  - Student community messaging and moderation (367)
  - Attendance and rota workflows (364)
  - Behaviour, merits, demerits, leaderboard, and child notes (364)

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
  - `apps/mobile/src/components/staff/staff-special-attendance-roster.tsx`
- Shared or infrastructure surfaces:
  - `apps/web/src/components/ui/`
- Graphify evidence: 125 nodes, 497 links, communities 0, 1, 2, 4, 6, 26, 40, 47.
- Relationship types: calls: 385, contains: 109, imports_from: 2, method: 1.
- Confidence mix: INFERRED: 309, EXTRACTED: 188.
- Connected modules:
  - Registration, parent, student, supervisor, and admin shells (432)
  - Identity, Clerk sync, sessions, and post-sign-in routing (367)
  - Admin access, users, invitations, audit, and profiles (364)
  - Behaviour, merits, demerits, leaderboard, and child notes (364)
  - RBAC, permission tags, and access boundaries (359)

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
  - `apps/mobile/src/components/staff/staff-behaviour-form.tsx`
  - `apps/mobile/src/components/staff/staff-behaviour-recent-panel.tsx`
  - `apps/mobile/src/components/staff/staff-behaviour-screen.tsx`
  - `apps/mobile/src/components/staff/staff-behaviour-student-picker.tsx`
  - `apps/mobile/src/components/staff/staff-behaviour-utils.ts`
- Shared or infrastructure surfaces:
  - `apps/web/src/components/ui/`
- Graphify evidence: 139 nodes, 578 links, communities 0, 1, 2, 6, 8, 14, 297, 389.
- Relationship types: calls: 437, contains: 128, imports_from: 12, method: 1.
- Confidence mix: INFERRED: 352, EXTRACTED: 226.
- Connected modules:
  - Registration, parent, student, supervisor, and admin shells (408)
  - Identity, Clerk sync, sessions, and post-sign-in routing (374)
  - Admin access, users, invitations, audit, and profiles (364)
  - Attendance and rota workflows (364)
  - RBAC, permission tags, and access boundaries (359)

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
- Graphify evidence: 33 nodes, 59 links, communities 21, 32, 270, 388, 391, 396, 400.
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
  - `apps/mobile/src/components/staff/staff-pace-form.tsx`
  - `apps/mobile/src/components/staff/staff-pace-screen.tsx`
  - `apps/mobile/src/components/staff/staff-pace-student-picker.tsx`
  - `apps/mobile/src/components/staff/staff-pace-subject-panel.tsx`
  - `apps/mobile/src/components/staff/staff-pace-utils.ts`
- Shared or infrastructure surfaces:
  - `apps/web/src/components/ui/`
- Graphify evidence: 65 nodes, 160 links, communities 0, 1, 2, 41, 295, 296, 392.
- Relationship types: calls: 100, contains: 57, imports_from: 3.
- Confidence mix: EXTRACTED: 86, INFERRED: 74.
- Connected modules:
  - Registration, parent, student, supervisor, and admin shells (54)
  - Shared UI primitives and cross-app tRPC clients (46)
  - Homework assignments, submissions, and review (45)
  - Identity, Clerk sync, sessions, and post-sign-in routing (16)
  - Shop, invoices, clubs, calendar, tithe, savings, investment, reports, notices, messages, and email (16)

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
- Graphify evidence: 908 nodes, 1612 links, communities 0, 1, 2, 4, 6, 10, 12, 14.
- Relationship types: calls: 902, contains: 699, imports_from: 10, method: 1.
- Confidence mix: EXTRACTED: 902, INFERRED: 710.
- Connected modules:
  - Shared UI primitives and cross-app tRPC clients (918)
  - Shop, invoices, clubs, calendar, tithe, savings, investment, reports, notices, messages, and email (581)
  - Admin access, users, invitations, audit, and profiles (481)
  - Attendance and rota workflows (432)
  - Behaviour, merits, demerits, leaderboard, and child notes (408)

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
  - `apps/mobile/src/components/student/student-faith-comments-panel.tsx`
  - `apps/mobile/src/components/student/student-faith-corner-panel.tsx`
  - `apps/mobile/src/components/student/student-faith-corner-screen.tsx`
  - `apps/mobile/src/components/student/student-faith-corner-wiring.test.ts`
- Shared or infrastructure surfaces:
  - `apps/api/src/services/faith-corner.ts`
  - `packages/db/prisma/migrations/20260604034500_faith_corner_content/`
- Graphify evidence: 84 nodes, 106 links, communities 0, 17, 60, 66, 139, 140, 263, 264.
- Relationship types: contains: 71, calls: 35.
- Confidence mix: EXTRACTED: 90, INFERRED: 16.
- Connected modules:
  - Registration, parent, student, supervisor, and admin shells (104)
  - Student notification centre and announcements (94)
  - Shared UI primitives and cross-app tRPC clients (12)
  - Homework assignments, submissions, and review (9)
  - Student community messaging and moderation (9)

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
- Graphify evidence: 74 nodes, 98 links, communities 0, 17, 66, 139, 140.
- Relationship types: contains: 65, calls: 33.
- Confidence mix: EXTRACTED: 82, INFERRED: 16.
- Connected modules:
  - Registration, parent, student, supervisor, and admin shells (95)
  - Faith Corner managed student content (94)
  - Homework assignments, submissions, and review (10)
  - Student community messaging and moderation (9)
  - Shared UI primitives and cross-app tRPC clients (3)

### Parent notification centre and invoice alerts

- Owns: Parent-targeted in-app notifications, unread state, invoice-issued alerts, and parent notification links.
- API routers:
  - `apps/api/src/routers/invoice.ts`
  - `apps/api/src/routers/parentNotification.ts`
- Domain helpers:
  - `packages/domain/src/invoice.ts`
- Web surfaces:
  - `apps/web/src/app/(parent)/parent/notifications/`
  - `apps/web/src/components/invoices/parent-fees-client.tsx`
  - `apps/web/src/components/parent/parent-nav.tsx`
  - `apps/web/src/components/parent/parent-notifications-client.tsx`
- Mobile surfaces:
  - `apps/mobile/src/components/parent/parent-fees-invoices-screen.tsx`
  - `apps/mobile/src/components/parent/parent-notifications-screen.tsx`
  - `apps/mobile/src/components/parent/parent-notifications-wiring.test.ts`
  - `apps/mobile/src/components/parent/parent-portal-screen.tsx`
- Shared or infrastructure surfaces:
  - `apps/api/src/services/parent-notifications.ts`
  - `packages/db/prisma/migrations/20260828160000_parent_notifications/`
- Graphify evidence: 10 nodes, 47 links, communities 0, 275, 289.
- Relationship types: calls: 40, contains: 7.
- Confidence mix: INFERRED: 39, EXTRACTED: 8.
- Connected modules:
  - Shop, invoices, clubs, calendar, tithe, savings, investment, reports, notices, messages, and email (38)
  - Registration, parent, student, supervisor, and admin shells (8)
  - Identity, Clerk sync, sessions, and post-sign-in routing (6)
  - Admin access, users, invitations, audit, and profiles (5)
  - Attendance and rota workflows (5)

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
- Graphify evidence: 28 nodes, 77 links, communities 0, 98.
- Relationship types: calls: 53, contains: 24.
- Confidence mix: INFERRED: 44, EXTRACTED: 33.
- Connected modules:
  - PACE, subjects, school years, and academic progress (45)
  - Registration, parent, student, supervisor, and admin shells (17)
  - Student community messaging and moderation (17)
  - Admin access, users, invitations, audit, and profiles (10)
  - Student notification centre and announcements (10)

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
- Graphify evidence: 75 nodes, 398 links, communities 0, 1, 4, 6, 58.
- Relationship types: calls: 326, contains: 69, imports_from: 2, method: 1.
- Confidence mix: INFERRED: 264, EXTRACTED: 134.
- Connected modules:
  - Registration, parent, student, supervisor, and admin shells (369)
  - Admin access, users, invitations, audit, and profiles (367)
  - Attendance and rota workflows (359)
  - Behaviour, merits, demerits, leaderboard, and child notes (359)
  - Identity, Clerk sync, sessions, and post-sign-in routing (359)

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
- Graphify evidence: 512 nodes, 1249 links, communities 0, 1, 4, 5, 7, 8, 13, 14.
- Relationship types: calls: 825, contains: 414, imports_from: 10.
- Confidence mix: INFERRED: 678, EXTRACTED: 571.
- Connected modules:
  - Registration, parent, student, supervisor, and admin shells (581)
  - Shared UI primitives and cross-app tRPC clients (370)
  - Admin access, users, invitations, audit, and profiles (193)
  - Identity, Clerk sync, sessions, and post-sign-in routing (131)
  - Attendance and rota workflows (130)

### Shared UI primitives and cross-app tRPC clients

- Owns: Reusable UI primitives, tRPC providers, typed clients, mobile core primitives, and cross-app client plumbing.
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
  - `apps/mobile/src/components/core/`
  - `apps/mobile/src/lib/`
  - `apps/mobile/src/types/`
- Shared or infrastructure surfaces:
  - `apps/api/src/router.ts`
  - `apps/api/src/trpc.ts`
- Graphify evidence: 762 nodes, 985 links, communities 0, 2, 4, 14, 20, 21, 23, 26.
- Relationship types: contains: 567, calls: 407, imports_from: 11.
- Confidence mix: EXTRACTED: 701, INFERRED: 284.
- Connected modules:
  - Registration, parent, student, supervisor, and admin shells (918)
  - Shop, invoices, clubs, calendar, tithe, savings, investment, reports, notices, messages, and email (370)
  - Attendance and rota workflows (76)
  - Behaviour, merits, demerits, leaderboard, and child notes (55)
  - PACE, subjects, school years, and academic progress (46)

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
- Graphify evidence: 14 nodes, 100 links, communities 0, 7, 34.
- Relationship types: calls: 85, contains: 9, rationale_for: 2, references: 2, conceptually_related_to: 1, implements: 1.
- Confidence mix: INFERRED: 78, EXTRACTED: 22.
- Connected modules:
  - Shop, invoices, clubs, calendar, tithe, savings, investment, reports, notices, messages, and email (14)
  - Shared UI primitives and cross-app tRPC clients (4)
  - Identity, Clerk sync, sessions, and post-sign-in routing (2)
  - RBAC, permission tags, and access boundaries (1)
  - Registration, parent, student, supervisor, and admin shells (1)

<!-- COMPONENT_MAP:END -->

## Maintenance

- Regenerate this document after running `graphify update .`.
- Keep the human sections short and stable.
- Keep generated evidence factual. Do not hand-edit the generated section.
- When a product module gains a new router, domain file, or UI surface, update `scripts/generate-component-map.mjs` in the same PR.
