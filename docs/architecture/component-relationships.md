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

Generated from `graphify-out/graph.json` with 3667 graph nodes and 5873 graph links.

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
- Graphify evidence: 201 nodes, 794 links, communities 0, 1, 5, 6, 7, 9, 11, 12.
- Relationship types: calls: 464, contains: 166, imports_from: 163, method: 1.
- Confidence mix: EXTRACTED: 496, INFERRED: 298.
- Connected modules:
  - Registration, parent, student, supervisor, and admin shells (415)
  - RBAC, permission tags, and access boundaries (373)
  - Behaviour, merits, demerits, leaderboard, and child notes (319)
  - Admin access, users, invitations, audit, and profiles (312)
  - Attendance and rota workflows (302)

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
- Graphify evidence: 113 nodes, 560 links, communities 0, 1, 7, 9, 14, 16, 28.
- Relationship types: calls: 359, contains: 106, imports_from: 94, method: 1.
- Confidence mix: EXTRACTED: 302, INFERRED: 258.
- Connected modules:
  - Admin access, users, invitations, audit, and profiles (474)
  - Identity, Clerk sync, sessions, and post-sign-in routing (373)
  - Registration, parent, student, supervisor, and admin shells (361)
  - Behaviour, merits, demerits, leaderboard, and child notes (305)
  - Attendance and rota workflows (292)

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
- Graphify evidence: 399 nodes, 776 links, communities 0, 1, 2, 3, 7, 8, 9, 13.
- Relationship types: calls: 423, contains: 305, imports_from: 47, method: 1.
- Confidence mix: EXTRACTED: 486, INFERRED: 290.
- Connected modules:
  - Registration, parent, student, supervisor, and admin shells (643)
  - RBAC, permission tags, and access boundaries (474)
  - Shop, invoices, clubs, calendar, tithe, savings, investment, reports, notices, messages, and email (335)
  - Identity, Clerk sync, sessions, and post-sign-in routing (312)
  - Attendance and rota workflows (305)

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
- Graphify evidence: 317 nodes, 614 links, communities 0, 2, 3, 6, 7, 9, 11, 16.
- Relationship types: calls: 322, contains: 264, imports_from: 27, method: 1.
- Confidence mix: EXTRACTED: 393, INFERRED: 221.
- Connected modules:
  - Registration, parent, student, supervisor, and admin shells (491)
  - Behaviour, merits, demerits, leaderboard, and child notes (424)
  - Admin access, users, invitations, audit, and profiles (305)
  - Identity, Clerk sync, sessions, and post-sign-in routing (302)
  - RBAC, permission tags, and access boundaries (292)

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
- Graphify evidence: 404 nodes, 784 links, communities 0, 1, 2, 3, 5, 6, 7, 9.
- Relationship types: calls: 386, contains: 344, imports_from: 53, method: 1.
- Confidence mix: EXTRACTED: 536, INFERRED: 248.
- Connected modules:
  - Registration, parent, student, supervisor, and admin shells (465)
  - Attendance and rota workflows (424)
  - Identity, Clerk sync, sessions, and post-sign-in routing (319)
  - Admin access, users, invitations, audit, and profiles (305)
  - RBAC, permission tags, and access boundaries (305)

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
  - `apps/mobile/src/components/staff/staff-incident-form-controls.tsx`
  - `apps/mobile/src/components/staff/staff-incident-form.tsx`
  - `apps/mobile/src/components/staff/staff-incident-review-panel.tsx`
  - `apps/mobile/src/components/staff/staff-incident-screen.tsx`
  - `apps/mobile/src/components/staff/staff-incident-student-picker.tsx`
  - `apps/mobile/src/components/staff/staff-incident-utils.ts`
- Shared or infrastructure surfaces:
  - `apps/api/src/incidents/`
  - `packages/db/prisma/migrations/20260528160000_incident_reports/`
- Graphify evidence: 116 nodes, 199 links, communities 0, 8, 19, 23, 31, 58, 104, 126.
- Relationship types: contains: 106, calls: 85, imports_from: 8.
- Confidence mix: EXTRACTED: 172, INFERRED: 27.
- Connected modules:
  - Registration, parent, student, supervisor, and admin shells (33)
  - Shared UI primitives and cross-app tRPC clients (30)
  - Identity, Clerk sync, sessions, and post-sign-in routing (9)
  - Admin access, users, invitations, audit, and profiles (5)
  - RBAC, permission tags, and access boundaries (5)

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
- Graphify evidence: 231 nodes, 301 links, communities 0, 2, 3, 6, 17, 38, 43, 47.
- Relationship types: contains: 185, calls: 105, imports_from: 11.
- Confidence mix: EXTRACTED: 244, INFERRED: 57.
- Connected modules:
  - Registration, parent, student, supervisor, and admin shells (189)
  - Shared UI primitives and cross-app tRPC clients (180)
  - Behaviour, merits, demerits, leaderboard, and child notes (144)
  - Attendance and rota workflows (143)
  - Shop, invoices, clubs, calendar, tithe, savings, investment, reports, notices, messages, and email (47)

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
- Shared or infrastructure surfaces:
  - `apps/api/src/lib/student-portal-access.ts`
  - `apps/web/src/components/ui/`
  - `packages/db/prisma/migrations/20260603211500_student_portal_usage_minutes/`
- Graphify evidence: 1120 nodes, 1758 links, communities 0, 1, 2, 3, 6, 7, 8, 9.
- Relationship types: contains: 862, calls: 827, imports_from: 68, method: 1.
- Confidence mix: EXTRACTED: 1280, INFERRED: 478.
- Connected modules:
  - Admin access, users, invitations, audit, and profiles (643)
  - Shop, invoices, clubs, calendar, tithe, savings, investment, reports, notices, messages, and email (526)
  - Shared UI primitives and cross-app tRPC clients (523)
  - Attendance and rota workflows (491)
  - Behaviour, merits, demerits, leaderboard, and child notes (465)

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
- Graphify evidence: 148 nodes, 176 links, communities 0, 1, 2, 18, 52, 55, 56, 84.
- Relationship types: contains: 120, calls: 48, imports_from: 8.
- Confidence mix: EXTRACTED: 163, INFERRED: 13.
- Connected modules:
  - Registration, parent, student, supervisor, and admin shells (148)
  - Student notification centre and announcements (143)
  - Homework assignments, submissions, and review (7)
  - Student community messaging and moderation (7)
  - Shared UI primitives and cross-app tRPC clients (6)

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
  - _None configured_
- Shared or infrastructure surfaces:
  - `apps/api/src/services/student-notifications.ts`
  - `packages/db/prisma/migrations/20260604052000_student_notifications/`
- Graphify evidence: 145 nodes, 175 links, communities 0, 1, 2, 18, 20, 52, 55, 56.
- Relationship types: contains: 117, calls: 46, imports_from: 12.
- Confidence mix: EXTRACTED: 160, INFERRED: 15.
- Connected modules:
  - Registration, parent, student, supervisor, and admin shells (148)
  - Faith Corner managed student content (143)
  - Homework assignments, submissions, and review (10)
  - Student community messaging and moderation (7)
  - Shared UI primitives and cross-app tRPC clients (6)

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
- Graphify evidence: 99 nodes, 169 links, communities 0, 2, 8, 10, 20, 45, 79, 80.
- Relationship types: contains: 88, calls: 64, imports_from: 17.
- Confidence mix: EXTRACTED: 139, INFERRED: 30.
- Connected modules:
  - PACE, subjects, school years, and academic progress (36)
  - Registration, parent, student, supervisor, and admin shells (20)
  - Behaviour, merits, demerits, leaderboard, and child notes (18)
  - Student community messaging and moderation (13)
  - Shared UI primitives and cross-app tRPC clients (11)

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
- Graphify evidence: 111 nodes, 380 links, communities 0, 2, 3, 7, 9, 16, 22, 46.
- Relationship types: calls: 261, contains: 99, imports_from: 19, method: 1.
- Confidence mix: EXTRACTED: 200, INFERRED: 180.
- Connected modules:
  - Registration, parent, student, supervisor, and admin shells (301)
  - Admin access, users, invitations, audit, and profiles (297)
  - Identity, Clerk sync, sessions, and post-sign-in routing (293)
  - RBAC, permission tags, and access boundaries (291)
  - Attendance and rota workflows (290)

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
  - `apps/mobile/src/components/smoke/parent-portal-smoke-screen.tsx`
  - `apps/mobile/src/components/smoke/parent-smoke-messages.tsx`
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
- Shared or infrastructure surfaces:
  - `apps/api/src/emails/`
  - `apps/api/src/services/market-data/`
  - `apps/api/src/services/savings-interest.ts`
  - `packages/db/prisma/migrations/20260606160000_investment_market_snapshots/`
  - `packages/db/prisma/migrations/20260606163000_add_requested_lse_etfs/`
  - `packages/db/prisma/migrations/20260616120000_student_direct_messages/`
- Graphify evidence: 1373 nodes, 2351 links, communities 0, 1, 2, 3, 4, 5, 6, 7.
- Relationship types: contains: 1161, calls: 1070, imports_from: 120.
- Confidence mix: EXTRACTED: 1879, INFERRED: 472.
- Connected modules:
  - Registration, parent, student, supervisor, and admin shells (526)
  - Admin access, users, invitations, audit, and profiles (335)
  - Shared UI primitives and cross-app tRPC clients (252)
  - Identity, Clerk sync, sessions, and post-sign-in routing (171)
  - RBAC, permission tags, and access boundaries (143)

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
- Graphify evidence: 426 nodes, 771 links, communities 0, 1, 2, 3, 8, 11, 21, 23.
- Relationship types: calls: 356, contains: 317, imports_from: 98.
- Confidence mix: EXTRACTED: 499, INFERRED: 272.
- Connected modules:
  - Registration, parent, student, supervisor, and admin shells (523)
  - Shop, invoices, clubs, calendar, tithe, savings, investment, reports, notices, messages, and email (252)
  - Attendance and rota workflows (216)
  - Behaviour, merits, demerits, leaderboard, and child notes (184)
  - PACE, subjects, school years, and academic progress (180)

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
- Graphify evidence: 53 nodes, 82 links, communities 2, 8, 25, 226, 271.
- Relationship types: calls: 39, contains: 35, imports_from: 8.
- Confidence mix: EXTRACTED: 64, INFERRED: 18.
- Connected modules:
  - Shared UI primitives and cross-app tRPC clients (17)
  - Registration, parent, student, supervisor, and admin shells (5)
  - Incident reports, staff review, and parent-safe release (2)

<!-- COMPONENT_MAP:END -->

## Maintenance

- Regenerate this document after running `graphify update .`.
- Keep the human sections short and stable.
- Keep generated evidence factual. Do not hand-edit the generated section.
- When a product module gains a new router, domain file, or UI surface, update `scripts/generate-component-map.mjs` in the same PR.
