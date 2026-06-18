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

Generated from `graphify-out/graph.json` with 3465 graph nodes and 5771 graph links.

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
- Graphify evidence: 201 nodes, 796 links, communities 0, 1, 2, 4, 5, 7, 8, 9.
- Relationship types: calls: 466, contains: 166, imports_from: 163, method: 1.
- Confidence mix: EXTRACTED: 496, INFERRED: 300.
- Connected modules:
  - Registration, parent, student, supervisor, and admin shells (415)
  - RBAC, permission tags, and access boundaries (374)
  - Behaviour, merits, demerits, leaderboard, and child notes (320)
  - Admin access, users, invitations, audit, and profiles (313)
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
- Graphify evidence: 113 nodes, 561 links, communities 1, 2, 7, 9, 10, 13, 28.
- Relationship types: calls: 360, contains: 106, imports_from: 94, method: 1.
- Confidence mix: EXTRACTED: 302, INFERRED: 259.
- Connected modules:
  - Admin access, users, invitations, audit, and profiles (475)
  - Identity, Clerk sync, sessions, and post-sign-in routing (374)
  - Registration, parent, student, supervisor, and admin shells (362)
  - Behaviour, merits, demerits, leaderboard, and child notes (306)
  - Attendance and rota workflows (293)

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
- Graphify evidence: 399 nodes, 783 links, communities 0, 1, 2, 3, 7, 9, 11, 13.
- Relationship types: calls: 430, contains: 305, imports_from: 47, method: 1.
- Confidence mix: EXTRACTED: 486, INFERRED: 297.
- Connected modules:
  - Registration, parent, student, supervisor, and admin shells (649)
  - RBAC, permission tags, and access boundaries (475)
  - Shop, invoices, clubs, calendar, tithe, savings, investment, reports, notices, messages, and email (341)
  - Identity, Clerk sync, sessions, and post-sign-in routing (313)
  - Attendance and rota workflows (307)

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
- Graphify evidence: 273 nodes, 578 links, communities 0, 1, 3, 7, 8, 9, 12, 13.
- Relationship types: calls: 320, contains: 230, imports_from: 27, method: 1.
- Confidence mix: EXTRACTED: 347, INFERRED: 231.
- Connected modules:
  - Registration, parent, student, supervisor, and admin shells (444)
  - Behaviour, merits, demerits, leaderboard, and child notes (436)
  - Admin access, users, invitations, audit, and profiles (307)
  - Identity, Clerk sync, sessions, and post-sign-in routing (302)
  - RBAC, permission tags, and access boundaries (293)

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
- Graphify evidence: 386 nodes, 790 links, communities 0, 1, 2, 4, 7, 8, 9, 12.
- Relationship types: calls: 405, contains: 331, imports_from: 53, method: 1.
- Confidence mix: EXTRACTED: 519, INFERRED: 271.
- Connected modules:
  - Registration, parent, student, supervisor, and admin shells (456)
  - Attendance and rota workflows (436)
  - Identity, Clerk sync, sessions, and post-sign-in routing (320)
  - Admin access, users, invitations, audit, and profiles (307)
  - RBAC, permission tags, and access boundaries (306)

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
- Graphify evidence: 94 nodes, 295 links, communities 0, 1, 5, 11, 49, 62, 119, 153.
- Relationship types: calls: 197, contains: 90, imports_from: 8.
- Confidence mix: EXTRACTED: 151, INFERRED: 144.
- Connected modules:
  - Shop, invoices, clubs, calendar, tithe, savings, investment, reports, notices, messages, and email (45)
  - Registration, parent, student, supervisor, and admin shells (42)
  - Behaviour, merits, demerits, leaderboard, and child notes (27)
  - PACE, subjects, school years, and academic progress (21)
  - Attendance and rota workflows (20)

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
- Graphify evidence: 206 nodes, 291 links, communities 0, 1, 8, 12, 39, 41, 57, 75.
- Relationship types: contains: 165, calls: 115, imports_from: 11.
- Confidence mix: EXTRACTED: 219, INFERRED: 72.
- Connected modules:
  - Registration, parent, student, supervisor, and admin shells (168)
  - Shared UI primitives and cross-app tRPC clients (159)
  - Behaviour, merits, demerits, leaderboard, and child notes (155)
  - Attendance and rota workflows (154)
  - Shop, invoices, clubs, calendar, tithe, savings, investment, reports, notices, messages, and email (50)

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
- Graphify evidence: 927 nodes, 1569 links, communities 0, 1, 2, 3, 6, 7, 9, 10.
- Relationship types: calls: 782, contains: 718, imports_from: 68, method: 1.
- Confidence mix: EXTRACTED: 1094, INFERRED: 475.
- Connected modules:
  - Admin access, users, invitations, audit, and profiles (649)
  - Behaviour, merits, demerits, leaderboard, and child notes (456)
  - Shop, invoices, clubs, calendar, tithe, savings, investment, reports, notices, messages, and email (450)
  - Attendance and rota workflows (444)
  - Identity, Clerk sync, sessions, and post-sign-in routing (415)

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
- Graphify evidence: 148 nodes, 179 links, communities 0, 1, 2, 17, 43, 47, 48, 78.
- Relationship types: contains: 120, calls: 51, imports_from: 8.
- Confidence mix: EXTRACTED: 163, INFERRED: 16.
- Connected modules:
  - Registration, parent, student, supervisor, and admin shells (151)
  - Student notification centre and announcements (146)
  - Homework assignments, submissions, and review (8)
  - Student community messaging and moderation (8)
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
- Graphify evidence: 145 nodes, 178 links, communities 0, 1, 2, 17, 43, 47, 48, 78.
- Relationship types: contains: 117, calls: 49, imports_from: 12.
- Confidence mix: EXTRACTED: 160, INFERRED: 18.
- Connected modules:
  - Registration, parent, student, supervisor, and admin shells (151)
  - Faith Corner managed student content (146)
  - Homework assignments, submissions, and review (11)
  - Student community messaging and moderation (8)
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
- Graphify evidence: 99 nodes, 177 links, communities 0, 1, 8, 11, 18, 19, 40, 72.
- Relationship types: contains: 88, calls: 72, imports_from: 17.
- Confidence mix: EXTRACTED: 139, INFERRED: 38.
- Connected modules:
  - PACE, subjects, school years, and academic progress (41)
  - Registration, parent, student, supervisor, and admin shells (21)
  - Behaviour, merits, demerits, leaderboard, and child notes (18)
  - Student community messaging and moderation (15)
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
- Graphify evidence: 111 nodes, 384 links, communities 0, 1, 7, 9, 13, 23, 36, 44.
- Relationship types: calls: 265, contains: 99, imports_from: 19, method: 1.
- Confidence mix: EXTRACTED: 200, INFERRED: 184.
- Connected modules:
  - Registration, parent, student, supervisor, and admin shells (303)
  - Admin access, users, invitations, audit, and profiles (299)
  - Identity, Clerk sync, sessions, and post-sign-in routing (294)
  - RBAC, permission tags, and access boundaries (292)
  - Attendance and rota workflows (291)

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
- Shared or infrastructure surfaces:
  - `apps/api/src/emails/`
  - `apps/api/src/services/market-data/`
  - `apps/api/src/services/savings-interest.ts`
  - `packages/db/prisma/migrations/20260606160000_investment_market_snapshots/`
  - `packages/db/prisma/migrations/20260606163000_add_requested_lse_etfs/`
  - `packages/db/prisma/migrations/20260616120000_student_direct_messages/`
- Graphify evidence: 1302 nodes, 2312 links, communities 0, 1, 2, 3, 4, 5, 6, 7.
- Relationship types: contains: 1107, calls: 1085, imports_from: 120.
- Confidence mix: EXTRACTED: 1810, INFERRED: 502.
- Connected modules:
  - Registration, parent, student, supervisor, and admin shells (450)
  - Admin access, users, invitations, audit, and profiles (341)
  - Identity, Clerk sync, sessions, and post-sign-in routing (172)
  - Shared UI primitives and cross-app tRPC clients (169)
  - RBAC, permission tags, and access boundaries (144)

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
- Graphify evidence: 235 nodes, 558 links, communities 0, 1, 2, 3, 11, 12, 39, 41.
- Relationship types: calls: 286, contains: 174, imports_from: 98.
- Confidence mix: EXTRACTED: 314, INFERRED: 244.
- Connected modules:
  - Registration, parent, student, supervisor, and admin shells (310)
  - Behaviour, merits, demerits, leaderboard, and child notes (174)
  - Shop, invoices, clubs, calendar, tithe, savings, investment, reports, notices, messages, and email (169)
  - Attendance and rota workflows (168)
  - PACE, subjects, school years, and academic progress (159)

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
- Graphify evidence: 53 nodes, 87 links, communities 0, 10, 11, 202, 247.
- Relationship types: calls: 44, contains: 35, imports_from: 8.
- Confidence mix: EXTRACTED: 64, INFERRED: 23.
- Connected modules:
  - Shared UI primitives and cross-app tRPC clients (17)
  - Incident reports, staff review, and parent-safe release (7)
  - Registration, parent, student, supervisor, and admin shells (5)

<!-- COMPONENT_MAP:END -->

## Maintenance

- Regenerate this document after running `graphify update .`.
- Keep the human sections short and stable.
- Keep generated evidence factual. Do not hand-edit the generated section.
- When a product module gains a new router, domain file, or UI surface, update `scripts/generate-component-map.mjs` in the same PR.
