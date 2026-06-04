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

Generated from `graphify-out/graph.json` with 2885 graph nodes and 4933 graph links.

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
- Graphify evidence: 187 nodes, 802 links, communities 0, 2, 4, 5, 6, 7, 8, 9.
- Relationship types: calls: 506, contains: 154, imports_from: 141, method: 1.
- Confidence mix: EXTRACTED: 451, INFERRED: 351.
- Connected modules:
  - Registration, parent, student, supervisor, and admin shells (431)
  - RBAC, permission tags, and access boundaries (409)
  - Behaviour, merits, demerits, leaderboard, and child notes (362)
  - Admin access, users, invitations, audit, and profiles (352)
  - Attendance and rota workflows (340)

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
- Graphify evidence: 113 nodes, 606 links, communities 0, 2, 4, 5, 6, 7, 8, 10.
- Relationship types: calls: 413, contains: 103, imports_from: 85, conceptually_related_to: 1, implements: 1, method: 1, rationale_for: 1, references: 1.
- Confidence mix: INFERRED: 316, EXTRACTED: 290.
- Connected modules:
  - Admin access, users, invitations, audit, and profiles (526)
  - Identity, Clerk sync, sessions, and post-sign-in routing (409)
  - Registration, parent, student, supervisor, and admin shells (404)
  - Behaviour, merits, demerits, leaderboard, and child notes (343)
  - Attendance and rota workflows (331)

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
- Graphify evidence: 378 nodes, 808 links, communities 0, 1, 2, 3, 4, 5, 6, 7.
- Relationship types: calls: 477, contains: 287, imports_from: 43, method: 1.
- Confidence mix: EXTRACTED: 459, INFERRED: 349.
- Connected modules:
  - Registration, parent, student, supervisor, and admin shells (666)
  - RBAC, permission tags, and access boundaries (526)
  - Identity, Clerk sync, sessions, and post-sign-in routing (352)
  - Shop, invoices, clubs, calendar, tithe, investment, reports, notices, messages, and email (352)
  - Attendance and rota workflows (345)

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
- Graphify evidence: 251 nodes, 582 links, communities 0, 1, 3, 4, 6, 7, 8, 10.
- Relationship types: calls: 346, contains: 209, imports_from: 26, method: 1.
- Confidence mix: EXTRACTED: 318, INFERRED: 264.
- Connected modules:
  - Registration, parent, student, supervisor, and admin shells (467)
  - Behaviour, merits, demerits, leaderboard, and child notes (466)
  - Admin access, users, invitations, audit, and profiles (345)
  - Identity, Clerk sync, sessions, and post-sign-in routing (340)
  - RBAC, permission tags, and access boundaries (331)

### Behaviour, merits, demerits, leaderboard, and child notes

- Owns: Behaviour logging, sensitive behaviour visibility, child notes, merit ledger rows, and leaderboards.
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
  - `apps/web/src/components/student-drillthrough/notes-list.tsx`
- Mobile surfaces:
  - `apps/mobile/src/components/smoke/`
- Shared or infrastructure surfaces:
  - `apps/web/src/components/ui/`
- Graphify evidence: 352 nodes, 785 links, communities 0, 1, 2, 4, 6, 7, 8, 9.
- Relationship types: calls: 433, contains: 298, imports_from: 53, method: 1.
- Confidence mix: EXTRACTED: 474, INFERRED: 311.
- Connected modules:
  - Registration, parent, student, supervisor, and admin shells (471)
  - Attendance and rota workflows (466)
  - Identity, Clerk sync, sessions, and post-sign-in routing (362)
  - Admin access, users, invitations, audit, and profiles (345)
  - RBAC, permission tags, and access boundaries (343)

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
- Graphify evidence: 92 nodes, 288 links, communities 0, 1, 5, 14, 40, 57, 103, 131.
- Relationship types: calls: 194, contains: 86, imports_from: 8.
- Confidence mix: EXTRACTED: 146, INFERRED: 142.
- Connected modules:
  - Shop, invoices, clubs, calendar, tithe, investment, reports, notices, messages, and email (38)
  - Registration, parent, student, supervisor, and admin shells (36)
  - Behaviour, merits, demerits, leaderboard, and child notes (25)
  - PACE, subjects, school years, and academic progress (20)
  - Attendance and rota workflows (18)

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
- Graphify evidence: 201 nodes, 311 links, communities 0, 1, 6, 8, 16, 32, 33, 47.
- Relationship types: contains: 160, calls: 141, imports_from: 10.
- Confidence mix: EXTRACTED: 211, INFERRED: 100.
- Connected modules:
  - Registration, parent, student, supervisor, and admin shells (158)
  - Behaviour, merits, demerits, leaderboard, and child notes (150)
  - Attendance and rota workflows (147)
  - Shared UI primitives and cross-app tRPC clients (140)
  - Shop, invoices, clubs, calendar, tithe, investment, reports, notices, messages, and email (60)

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
- Graphify evidence: 773 nodes, 1306 links, communities 0, 1, 3, 4, 5, 6, 7, 8.
- Relationship types: calls: 660, contains: 588, imports_from: 57, method: 1.
- Confidence mix: EXTRACTED: 897, INFERRED: 409.
- Connected modules:
  - Admin access, users, invitations, audit, and profiles (666)
  - Behaviour, merits, demerits, leaderboard, and child notes (471)
  - Attendance and rota workflows (467)
  - Identity, Clerk sync, sessions, and post-sign-in routing (431)
  - Shop, invoices, clubs, calendar, tithe, investment, reports, notices, messages, and email (429)

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
- Graphify evidence: 67 nodes, 67 links, communities 0, 1, 2, 50, 55, 64, 65, 80.
- Relationship types: contains: 47, calls: 12, imports_from: 8.
- Confidence mix: EXTRACTED: 63, INFERRED: 4.
- Connected modules:
  - Registration, parent, student, supervisor, and admin shells (51)
  - Student notification centre and announcements (46)
  - Admin access, users, invitations, audit, and profiles (3)
  - Identity, Clerk sync, sessions, and post-sign-in routing (3)
  - RBAC, permission tags, and access boundaries (3)

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
- Graphify evidence: 71 nodes, 76 links, communities 0, 1, 2, 50, 55, 64, 65, 83.
- Relationship types: contains: 51, calls: 14, imports_from: 11.
- Confidence mix: EXTRACTED: 70, INFERRED: 6.
- Connected modules:
  - Registration, parent, student, supervisor, and admin shells (51)
  - Faith Corner managed student content (46)
  - Shop, invoices, clubs, calendar, tithe, investment, reports, notices, messages, and email (4)
  - Admin access, users, invitations, audit, and profiles (3)
  - Identity, Clerk sync, sessions, and post-sign-in routing (3)

### Shop, invoices, clubs, calendar, tithe, investment, reports, notices, messages, and email

- Owns: Commercial, finance, calendar, and communication workflows that hang off student, parent, staff, and admin experiences.
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
  - `packages/domain/src/investmentSim.ts`
  - `packages/domain/src/investmentTransactions.ts`
  - `packages/domain/src/invoice.ts`
  - `packages/domain/src/permissionSlips.ts`
  - `packages/domain/src/report.ts`
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
- Graphify evidence: 1039 nodes, 1874 links, communities 0, 1, 2, 3, 4, 5, 6, 7.
- Relationship types: calls: 915, contains: 867, imports_from: 92.
- Confidence mix: EXTRACTED: 1332, INFERRED: 542.
- Connected modules:
  - Registration, parent, student, supervisor, and admin shells (429)
  - Admin access, users, invitations, audit, and profiles (352)
  - Identity, Clerk sync, sessions, and post-sign-in routing (195)
  - RBAC, permission tags, and access boundaries (174)
  - Behaviour, merits, demerits, leaderboard, and child notes (162)

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
- Graphify evidence: 210 nodes, 380 links, communities 0, 1, 2, 3, 5, 8, 10, 11.
- Relationship types: contains: 152, calls: 140, imports_from: 88.
- Confidence mix: EXTRACTED: 275, INFERRED: 105.
- Connected modules:
  - Registration, parent, student, supervisor, and admin shells (159)
  - Behaviour, merits, demerits, leaderboard, and child notes (151)
  - Attendance and rota workflows (146)
  - PACE, subjects, school years, and academic progress (140)
  - Shop, invoices, clubs, calendar, tithe, investment, reports, notices, messages, and email (113)

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
- Graphify evidence: 121 nodes, 294 links, communities 1, 5, 10, 24, 218.
- Relationship types: calls: 179, contains: 96, imports_from: 13, rationale_for: 2, references: 2, conceptually_related_to: 1, implements: 1.
- Confidence mix: EXTRACTED: 217, INFERRED: 77.
- Connected modules:
  - Incident reports, staff review, and parent-safe release (16)
  - Shop, invoices, clubs, calendar, tithe, investment, reports, notices, messages, and email (14)
  - Shared UI primitives and cross-app tRPC clients (12)
  - PACE, subjects, school years, and academic progress (5)
  - Identity, Clerk sync, sessions, and post-sign-in routing (2)

<!-- COMPONENT_MAP:END -->

## Maintenance

- Regenerate this document after running `graphify update .`.
- Keep the human sections short and stable.
- Keep generated evidence factual. Do not hand-edit the generated section.
- When a product module gains a new router, domain file, or UI surface, update `scripts/generate-component-map.mjs` in the same PR.
