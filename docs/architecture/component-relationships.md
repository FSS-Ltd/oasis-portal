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

Generated from `graphify-out/graph.json` with 2980 graph nodes and 4807 graph links.

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
- Graphify evidence: 197 nodes, 774 links, communities 0, 2, 4, 6, 7, 8, 9, 11.
- Relationship types: calls: 464, contains: 163, imports_from: 146, method: 1.
- Confidence mix: EXTRACTED: 472, INFERRED: 302.
- Connected modules:
  - Registration, parent, student, supervisor, and admin shells (404)
  - RBAC, permission tags, and access boundaries (360)
  - Behaviour, merits, demerits, leaderboard, and child notes (318)
  - Admin access, users, invitations, audit, and profiles (307)
  - Attendance and rota workflows (298)

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
- Graphify evidence: 111 nodes, 544 links, communities 0, 2, 4, 5, 6, 23, 25, 28.
- Relationship types: calls: 353, contains: 104, imports_from: 86, method: 1.
- Confidence mix: EXTRACTED: 290, INFERRED: 254.
- Connected modules:
  - Admin access, users, invitations, audit, and profiles (466)
  - Identity, Clerk sync, sessions, and post-sign-in routing (360)
  - Registration, parent, student, supervisor, and admin shells (354)
  - Behaviour, merits, demerits, leaderboard, and child notes (300)
  - Attendance and rota workflows (287)

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
- Graphify evidence: 389 nodes, 757 links, communities 0, 1, 2, 3, 4, 5, 6, 10.
- Relationship types: calls: 413, contains: 297, imports_from: 46, method: 1.
- Confidence mix: EXTRACTED: 475, INFERRED: 282.
- Connected modules:
  - Registration, parent, student, supervisor, and admin shells (626)
  - RBAC, permission tags, and access boundaries (466)
  - Shop, invoices, clubs, calendar, tithe, savings, investment, reports, notices, messages, and email (327)
  - Identity, Clerk sync, sessions, and post-sign-in routing (307)
  - Attendance and rota workflows (300)

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
- Graphify evidence: 270 nodes, 555 links, communities 1, 2, 3, 4, 6, 8, 9, 15.
- Relationship types: calls: 301, contains: 227, imports_from: 26, method: 1.
- Confidence mix: EXTRACTED: 342, INFERRED: 213.
- Connected modules:
  - Registration, parent, student, supervisor, and admin shells (423)
  - Behaviour, merits, demerits, leaderboard, and child notes (421)
  - Admin access, users, invitations, audit, and profiles (300)
  - Identity, Clerk sync, sessions, and post-sign-in routing (298)
  - RBAC, permission tags, and access boundaries (287)

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
- Graphify evidence: 384 nodes, 757 links, communities 0, 1, 2, 3, 4, 6, 7, 9.
- Relationship types: calls: 374, contains: 329, imports_from: 53, method: 1.
- Confidence mix: EXTRACTED: 515, INFERRED: 242.
- Connected modules:
  - Registration, parent, student, supervisor, and admin shells (427)
  - Attendance and rota workflows (421)
  - Identity, Clerk sync, sessions, and post-sign-in routing (318)
  - Admin access, users, invitations, audit, and profiles (300)
  - RBAC, permission tags, and access boundaries (300)

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
- Graphify evidence: 92 nodes, 282 links, communities 1, 5, 12, 19, 37, 49, 61, 106.
- Relationship types: calls: 188, contains: 86, imports_from: 8.
- Confidence mix: EXTRACTED: 146, INFERRED: 136.
- Connected modules:
  - Shop, invoices, clubs, calendar, tithe, savings, investment, reports, notices, messages, and email (41)
  - Registration, parent, student, supervisor, and admin shells (39)
  - Behaviour, merits, demerits, leaderboard, and child notes (26)
  - PACE, subjects, school years, and academic progress (20)
  - Attendance and rota workflows (19)

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
- Graphify evidence: 204 nodes, 265 links, communities 1, 2, 3, 9, 17, 34, 39, 41.
- Relationship types: contains: 163, calls: 92, imports_from: 10.
- Confidence mix: EXTRACTED: 216, INFERRED: 49.
- Connected modules:
  - Registration, parent, student, supervisor, and admin shells (146)
  - Behaviour, merits, demerits, leaderboard, and child notes (145)
  - Attendance and rota workflows (144)
  - Shared UI primitives and cross-app tRPC clients (139)
  - Shop, invoices, clubs, calendar, tithe, savings, investment, reports, notices, messages, and email (35)

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
- Graphify evidence: 858 nodes, 1369 links, communities 1, 2, 3, 4, 5, 6, 8, 10.
- Relationship types: contains: 662, calls: 645, imports_from: 61, method: 1.
- Confidence mix: EXTRACTED: 1024, INFERRED: 345.
- Connected modules:
  - Admin access, users, invitations, audit, and profiles (626)
  - Behaviour, merits, demerits, leaderboard, and child notes (427)
  - Attendance and rota workflows (423)
  - Identity, Clerk sync, sessions, and post-sign-in routing (404)
  - Shop, invoices, clubs, calendar, tithe, savings, investment, reports, notices, messages, and email (384)

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
- Graphify evidence: 120 nodes, 146 links, communities 0, 1, 5, 18, 24, 39, 44, 65.
- Relationship types: contains: 93, calls: 45, imports_from: 8.
- Confidence mix: EXTRACTED: 131, INFERRED: 15.
- Connected modules:
  - Registration, parent, student, supervisor, and admin shells (130)
  - Student notification centre and announcements (125)
  - Shared UI primitives and cross-app tRPC clients (6)
  - Identity, Clerk sync, sessions, and post-sign-in routing (4)
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
- Graphify evidence: 124 nodes, 155 links, communities 0, 1, 5, 18, 24, 39, 44, 65.
- Relationship types: contains: 97, calls: 47, imports_from: 11.
- Confidence mix: EXTRACTED: 138, INFERRED: 17.
- Connected modules:
  - Registration, parent, student, supervisor, and admin shells (130)
  - Faith Corner managed student content (125)
  - Shared UI primitives and cross-app tRPC clients (6)
  - Shop, invoices, clubs, calendar, tithe, savings, investment, reports, notices, messages, and email (5)
  - Identity, Clerk sync, sessions, and post-sign-in routing (4)

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
- Graphify evidence: 1097 nodes, 1825 links, communities 0, 1, 2, 3, 4, 5, 7, 8.
- Relationship types: contains: 918, calls: 809, imports_from: 98.
- Confidence mix: EXTRACTED: 1435, INFERRED: 390.
- Connected modules:
  - Registration, parent, student, supervisor, and admin shells (384)
  - Admin access, users, invitations, audit, and profiles (327)
  - Identity, Clerk sync, sessions, and post-sign-in routing (166)
  - RBAC, permission tags, and access boundaries (142)
  - Behaviour, merits, demerits, leaderboard, and child notes (116)

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
- Graphify evidence: 216 nodes, 404 links, communities 0, 1, 2, 3, 6, 10, 12, 18.
- Relationship types: calls: 159, contains: 157, imports_from: 88.
- Confidence mix: EXTRACTED: 282, INFERRED: 122.
- Connected modules:
  - Registration, parent, student, supervisor, and admin shells (166)
  - Attendance and rota workflows (152)
  - Behaviour, merits, demerits, leaderboard, and child notes (150)
  - PACE, subjects, school years, and academic progress (139)
  - Shop, invoices, clubs, calendar, tithe, savings, investment, reports, notices, messages, and email (114)

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
- Graphify evidence: 52 nodes, 82 links, communities 1, 12, 23, 215.
- Relationship types: calls: 39, contains: 35, imports_from: 8.
- Confidence mix: EXTRACTED: 64, INFERRED: 18.
- Connected modules:
  - Shared UI primitives and cross-app tRPC clients (12)
  - Incident reports, staff review, and parent-safe release (7)

<!-- COMPONENT_MAP:END -->

## Maintenance

- Regenerate this document after running `graphify update .`.
- Keep the human sections short and stable.
- Keep generated evidence factual. Do not hand-edit the generated section.
- When a product module gains a new router, domain file, or UI surface, update `scripts/generate-component-map.mjs` in the same PR.
