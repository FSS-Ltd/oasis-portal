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

Generated from `graphify-out/graph.json` with 2613 graph nodes and 4518 graph links.

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
- Graphify evidence: 161 nodes, 703 links, communities 1, 2, 4, 5, 6, 7, 8, 9.
- Relationship types: calls: 456, contains: 129, imports_from: 117, method: 1.
- Confidence mix: EXTRACTED: 365, INFERRED: 338.
- Connected modules:
  - RBAC, permission tags, and access boundaries (396)
  - Behaviour, merits, demerits, leaderboard, and child notes (354)
  - Admin access, users, invitations, audit, and profiles (347)
  - Registration, parent, student, supervisor, and admin shells (339)
  - Attendance and rota workflows (336)

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
- Graphify evidence: 112 nodes, 586 links, communities 1, 2, 4, 8, 9, 10, 14, 17.
- Relationship types: calls: 405, contains: 102, imports_from: 74, conceptually_related_to: 1, implements: 1, method: 1, rationale_for: 1, references: 1.
- Confidence mix: INFERRED: 309, EXTRACTED: 277.
- Connected modules:
  - Admin access, users, invitations, audit, and profiles (515)
  - Identity, Clerk sync, sessions, and post-sign-in routing (396)
  - Registration, parent, student, supervisor, and admin shells (393)
  - Behaviour, merits, demerits, leaderboard, and child notes (340)
  - Attendance and rota workflows (328)

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
- Graphify evidence: 349 nodes, 763 links, communities 0, 1, 2, 3, 4, 6, 8, 9.
- Relationship types: calls: 462, contains: 262, imports_from: 38, method: 1.
- Confidence mix: EXTRACTED: 423, INFERRED: 340.
- Connected modules:
  - Registration, parent, student, supervisor, and admin shells (623)
  - RBAC, permission tags, and access boundaries (515)
  - Identity, Clerk sync, sessions, and post-sign-in routing (347)
  - Attendance and rota workflows (342)
  - Behaviour, merits, demerits, leaderboard, and child notes (342)

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
- Graphify evidence: 248 nodes, 575 links, communities 0, 1, 2, 3, 4, 7, 8, 9.
- Relationship types: calls: 344, contains: 206, imports_from: 24, method: 1.
- Confidence mix: EXTRACTED: 313, INFERRED: 262.
- Connected modules:
  - Behaviour, merits, demerits, leaderboard, and child notes (462)
  - Registration, parent, student, supervisor, and admin shells (462)
  - Admin access, users, invitations, audit, and profiles (342)
  - Identity, Clerk sync, sessions, and post-sign-in routing (336)
  - RBAC, permission tags, and access boundaries (328)

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
- Graphify evidence: 350 nodes, 774 links, communities 0, 1, 2, 3, 4, 5, 7, 8.
- Relationship types: calls: 428, contains: 296, imports_from: 49, method: 1.
- Confidence mix: EXTRACTED: 468, INFERRED: 306.
- Connected modules:
  - Attendance and rota workflows (462)
  - Registration, parent, student, supervisor, and admin shells (462)
  - Identity, Clerk sync, sessions, and post-sign-in routing (354)
  - Admin access, users, invitations, audit, and profiles (342)
  - RBAC, permission tags, and access boundaries (340)

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
- Graphify evidence: 92 nodes, 282 links, communities 0, 1, 6, 11, 43, 57, 93, 111.
- Relationship types: calls: 189, contains: 85, imports_from: 8.
- Confidence mix: EXTRACTED: 145, INFERRED: 137.
- Connected modules:
  - Shop, invoices, clubs, calendar, tithe, investment, reports, notices, messages, and email (38)
  - Registration, parent, student, supervisor, and admin shells (33)
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
- Graphify evidence: 199 nodes, 306 links, communities 0, 1, 3, 7, 19, 31, 32, 35.
- Relationship types: contains: 158, calls: 139, imports_from: 9.
- Confidence mix: EXTRACTED: 208, INFERRED: 98.
- Connected modules:
  - Registration, parent, student, supervisor, and admin shells (155)
  - Behaviour, merits, demerits, leaderboard, and child notes (149)
  - Attendance and rota workflows (146)
  - Shared UI primitives and cross-app tRPC clients (139)
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
  - `apps/web/src/app/(supervisor)/`
  - `apps/web/src/app/registration/`
  - `apps/web/src/components/navigation/`
  - `apps/web/src/components/supervisor/`
- Mobile surfaces:
  - `apps/mobile/app/`
  - `apps/mobile/src/components/`
- Shared or infrastructure surfaces:
  - `apps/web/src/components/ui/`
- Graphify evidence: 606 nodes, 1048 links, communities 0, 1, 2, 3, 4, 6, 8, 9.
- Relationship types: calls: 560, contains: 453, imports_from: 34, method: 1.
- Confidence mix: EXTRACTED: 672, INFERRED: 376.
- Connected modules:
  - Admin access, users, invitations, audit, and profiles (623)
  - Attendance and rota workflows (462)
  - Behaviour, merits, demerits, leaderboard, and child notes (462)
  - Shop, invoices, clubs, calendar, tithe, investment, reports, notices, messages, and email (404)
  - RBAC, permission tags, and access boundaries (393)

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
- Graphify evidence: 1016 nodes, 1837 links, communities 0, 1, 2, 3, 4, 5, 6, 7.
- Relationship types: calls: 901, contains: 849, imports_from: 87.
- Confidence mix: EXTRACTED: 1307, INFERRED: 530.
- Connected modules:
  - Registration, parent, student, supervisor, and admin shells (404)
  - Admin access, users, invitations, audit, and profiles (335)
  - Identity, Clerk sync, sessions, and post-sign-in routing (188)
  - RBAC, permission tags, and access boundaries (170)
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
- Graphify evidence: 209 nodes, 365 links, communities 0, 2, 3, 4, 6, 10, 31, 32.
- Relationship types: contains: 151, calls: 135, imports_from: 79.
- Confidence mix: EXTRACTED: 265, INFERRED: 100.
- Connected modules:
  - Registration, parent, student, supervisor, and admin shells (154)
  - Behaviour, merits, demerits, leaderboard, and child notes (150)
  - Attendance and rota workflows (145)
  - PACE, subjects, school years, and academic progress (139)
  - Shop, invoices, clubs, calendar, tithe, investment, reports, notices, messages, and email (111)

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
- Graphify evidence: 121 nodes, 294 links, communities 0, 6, 7, 10, 18, 25, 191.
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
