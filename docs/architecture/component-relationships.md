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

Generated from `graphify-out/graph.json` with 3316 graph nodes and 5676 graph links.

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
- Graphify evidence: 199 nodes, 863 links, communities 0, 1, 4, 6, 8, 9, 10, 11.
- Relationship types: calls: 544, contains: 164, imports_from: 154, method: 1.
- Confidence mix: EXTRACTED: 481, INFERRED: 382.
- Connected modules:
  - Registration, parent, student, supervisor, and admin shells (474)
  - RBAC, permission tags, and access boundaries (436)
  - Behaviour, merits, demerits, leaderboard, and child notes (384)
  - Admin access, users, invitations, audit, and profiles (380)
  - Attendance and rota workflows (365)

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
- Graphify evidence: 114 nodes, 643 links, communities 0, 1, 4, 8, 14, 19, 20, 28.
- Relationship types: calls: 444, contains: 104, imports_from: 90, conceptually_related_to: 1, implements: 1, method: 1, rationale_for: 1, references: 1.
- Confidence mix: INFERRED: 346, EXTRACTED: 297.
- Connected modules:
  - Admin access, users, invitations, audit, and profiles (556)
  - Identity, Clerk sync, sessions, and post-sign-in routing (436)
  - Registration, parent, student, supervisor, and admin shells (434)
  - Behaviour, merits, demerits, leaderboard, and child notes (367)
  - Attendance and rota workflows (353)

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
- Graphify evidence: 392 nodes, 867 links, communities 0, 1, 2, 3, 4, 6, 7, 8.
- Relationship types: calls: 520, contains: 299, imports_from: 47, method: 1.
- Confidence mix: EXTRACTED: 478, INFERRED: 389.
- Connected modules:
  - Registration, parent, student, supervisor, and admin shells (725)
  - RBAC, permission tags, and access boundaries (556)
  - Shop, invoices, clubs, calendar, tithe, savings, investment, reports, notices, messages, and email (392)
  - Identity, Clerk sync, sessions, and post-sign-in routing (380)
  - Attendance and rota workflows (367)

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
- Shared or infrastructure surfaces:
  - `apps/web/src/components/ui/`
- Graphify evidence: 271 nodes, 642 links, communities 0, 2, 3, 4, 5, 8, 9, 19.
- Relationship types: calls: 386, contains: 228, imports_from: 27, method: 1.
- Confidence mix: EXTRACTED: 344, INFERRED: 298.
- Connected modules:
  - Registration, parent, student, supervisor, and admin shells (495)
  - Behaviour, merits, demerits, leaderboard, and child notes (494)
  - Admin access, users, invitations, audit, and profiles (367)
  - Identity, Clerk sync, sessions, and post-sign-in routing (365)
  - RBAC, permission tags, and access boundaries (353)

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
- Shared or infrastructure surfaces:
  - `apps/web/src/components/ui/`
- Graphify evidence: 384 nodes, 854 links, communities 0, 2, 4, 5, 6, 8, 9, 10.
- Relationship types: calls: 471, contains: 329, imports_from: 53, method: 1.
- Confidence mix: EXTRACTED: 515, INFERRED: 339.
- Connected modules:
  - Registration, parent, student, supervisor, and admin shells (499)
  - Attendance and rota workflows (494)
  - Identity, Clerk sync, sessions, and post-sign-in routing (384)
  - Admin access, users, invitations, audit, and profiles (367)
  - RBAC, permission tags, and access boundaries (367)

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
  - _None configured_
- Shared or infrastructure surfaces:
  - `apps/api/src/incidents/`
  - `packages/db/prisma/migrations/20260528160000_incident_reports/`
- Graphify evidence: 93 nodes, 306 links, communities 0, 2, 7, 15, 53, 63, 119, 152.
- Relationship types: calls: 209, contains: 89, imports_from: 8.
- Confidence mix: INFERRED: 157, EXTRACTED: 149.
- Connected modules:
  - Shop, invoices, clubs, calendar, tithe, savings, investment, reports, notices, messages, and email (44)
  - Registration, parent, student, supervisor, and admin shells (41)
  - Behaviour, merits, demerits, leaderboard, and child notes (28)
  - Attendance and rota workflows (21)
  - PACE, subjects, school years, and academic progress (20)

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
- Shared or infrastructure surfaces:
  - `apps/web/src/components/ui/`
- Graphify evidence: 205 nodes, 322 links, communities 0, 2, 5, 6, 17, 39, 40, 43.
- Relationship types: contains: 164, calls: 147, imports_from: 11.
- Confidence mix: EXTRACTED: 218, INFERRED: 104.
- Connected modules:
  - Registration, parent, student, supervisor, and admin shells (165)
  - Behaviour, merits, demerits, leaderboard, and child notes (156)
  - Attendance and rota workflows (153)
  - Shared UI primitives and cross-app tRPC clients (146)
  - Shop, invoices, clubs, calendar, tithe, savings, investment, reports, notices, messages, and email (60)

### Registration, parent, student, supervisor, and admin shells

- Owns: Portal shells, registration form flow, role-specific navigation, and cross-role dashboard entry points.
- API routers:
  - `apps/api/src/routers/profile.ts`
  - `apps/api/src/routers/registration.ts`
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
- Shared or infrastructure surfaces:
  - `apps/api/src/lib/student-portal-access.ts`
  - `apps/web/src/components/ui/`
  - `packages/db/prisma/migrations/20260603211500_student_portal_usage_minutes/`
- Graphify evidence: 872 nodes, 1496 links, communities 0, 1, 2, 3, 4, 5, 6, 7.
- Relationship types: calls: 762, contains: 670, imports_from: 63, method: 1.
- Confidence mix: EXTRACTED: 1029, INFERRED: 467.
- Connected modules:
  - Admin access, users, invitations, audit, and profiles (725)
  - Behaviour, merits, demerits, leaderboard, and child notes (499)
  - Attendance and rota workflows (495)
  - Identity, Clerk sync, sessions, and post-sign-in routing (474)
  - Shop, invoices, clubs, calendar, tithe, savings, investment, reports, notices, messages, and email (471)

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
- Graphify evidence: 130 nodes, 149 links, communities 0, 1, 2, 23, 40, 46, 51, 78.
- Relationship types: contains: 102, calls: 39, imports_from: 8.
- Confidence mix: EXTRACTED: 139, INFERRED: 10.
- Connected modules:
  - Registration, parent, student, supervisor, and admin shells (121)
  - Student notification centre and announcements (116)
  - Homework assignments, submissions, and review (7)
  - Shared UI primitives and cross-app tRPC clients (4)
  - Admin access, users, invitations, audit, and profiles (3)

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
- Graphify evidence: 127 nodes, 148 links, communities 0, 1, 2, 6, 23, 40, 46, 51.
- Relationship types: contains: 99, calls: 37, imports_from: 12.
- Confidence mix: EXTRACTED: 136, INFERRED: 12.
- Connected modules:
  - Registration, parent, student, supervisor, and admin shells (121)
  - Faith Corner managed student content (116)
  - Homework assignments, submissions, and review (10)
  - Shared UI primitives and cross-app tRPC clients (4)
  - Shop, invoices, clubs, calendar, tithe, savings, investment, reports, notices, messages, and email (4)

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
- Graphify evidence: 98 nodes, 177 links, communities 0, 2, 6, 7, 12, 22, 42, 71.
- Relationship types: contains: 87, calls: 73, imports_from: 17.
- Confidence mix: EXTRACTED: 138, INFERRED: 39.
- Connected modules:
  - PACE, subjects, school years, and academic progress (44)
  - Behaviour, merits, demerits, leaderboard, and child notes (18)
  - Registration, parent, student, supervisor, and admin shells (13)
  - Shop, invoices, clubs, calendar, tithe, savings, investment, reports, notices, messages, and email (13)
  - Incident reports, staff review, and parent-safe release (10)

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
  - `apps/web/src/app/(supervisor)/supervisor/shop/`
  - `apps/web/src/components/calendar/`
  - `apps/web/src/components/clubs/`
  - `apps/web/src/components/invoices/`
  - `apps/web/src/components/noticeboard/`
  - `apps/web/src/components/permission-slips/`
  - `apps/web/src/components/reports/`
  - `apps/web/src/components/shop/`
  - `apps/web/src/components/ui/`
- Mobile surfaces:
  - `apps/mobile/src/components/smoke/parent-portal-smoke-screen.tsx`
  - `apps/mobile/src/components/smoke/parent-smoke-messages.tsx`
  - `apps/mobile/src/components/smoke/parent-smoke-notices.tsx`
- Shared or infrastructure surfaces:
  - `apps/api/src/emails/`
  - `apps/api/src/services/market-data/`
  - `apps/api/src/services/savings-interest.ts`
  - `packages/db/prisma/migrations/20260606160000_investment_market_snapshots/`
  - `packages/db/prisma/migrations/20260606163000_add_requested_lse_etfs/`
- Graphify evidence: 1166 nodes, 2153 links, communities 0, 1, 2, 3, 4, 5, 6, 7.
- Relationship types: calls: 1063, contains: 983, imports_from: 107.
- Confidence mix: EXTRACTED: 1555, INFERRED: 598.
- Connected modules:
  - Registration, parent, student, supervisor, and admin shells (471)
  - Admin access, users, invitations, audit, and profiles (392)
  - Identity, Clerk sync, sessions, and post-sign-in routing (209)
  - RBAC, permission tags, and access boundaries (195)
  - Behaviour, merits, demerits, leaderboard, and child notes (175)

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
- Graphify evidence: 214 nodes, 413 links, communities 0, 1, 2, 3, 5, 7, 14, 39.
- Relationship types: calls: 165, contains: 156, imports_from: 92.
- Confidence mix: EXTRACTED: 285, INFERRED: 128.
- Connected modules:
  - Registration, parent, student, supervisor, and admin shells (171)
  - Attendance and rota workflows (160)
  - Behaviour, merits, demerits, leaderboard, and child notes (158)
  - PACE, subjects, school years, and academic progress (146)
  - Shop, invoices, clubs, calendar, tithe, savings, investment, reports, notices, messages, and email (121)

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
- Graphify evidence: 122 nodes, 297 links, communities 2, 7, 14, 20, 31, 237.
- Relationship types: calls: 181, contains: 97, imports_from: 13, rationale_for: 2, references: 2, conceptually_related_to: 1, implements: 1.
- Confidence mix: EXTRACTED: 219, INFERRED: 78.
- Connected modules:
  - Incident reports, staff review, and parent-safe release (17)
  - Shop, invoices, clubs, calendar, tithe, savings, investment, reports, notices, messages, and email (14)
  - Shared UI primitives and cross-app tRPC clients (12)
  - PACE, subjects, school years, and academic progress (5)
  - Identity, Clerk sync, sessions, and post-sign-in routing (2)

<!-- COMPONENT_MAP:END -->

## Maintenance

- Regenerate this document after running `graphify update .`.
- Keep the human sections short and stable.
- Keep generated evidence factual. Do not hand-edit the generated section.
- When a product module gains a new router, domain file, or UI surface, update `scripts/generate-component-map.mjs` in the same PR.
