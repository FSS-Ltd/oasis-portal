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

Generated from `graphify-out/graph.json` with 2484 graph nodes and 4249 graph links.

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
- Graphify evidence: 145 nodes, 580 links, communities 1, 2, 3, 5, 6, 7, 8, 14.
- Relationship types: calls: 363, contains: 115, imports_from: 101, method: 1.
- Confidence mix: EXTRACTED: 323, INFERRED: 257.
- Connected modules:
  - RBAC, permission tags, and access boundaries (368)
  - Behaviour, merits, demerits, leaderboard, and child notes (323)
  - Admin access, users, invitations, audit, and profiles (318)
  - Registration, parent, student, supervisor, and admin shells (310)
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
- Graphify evidence: 106 nodes, 557 links, communities 1, 2, 3, 7, 8, 15, 16, 22.
- Relationship types: calls: 383, contains: 96, imports_from: 73, conceptually_related_to: 1, implements: 1, method: 1, rationale_for: 1, references: 1.
- Confidence mix: INFERRED: 296, EXTRACTED: 261.
- Connected modules:
  - Admin access, users, invitations, audit, and profiles (487)
  - Registration, parent, student, supervisor, and admin shells (372)
  - Identity, Clerk sync, sessions, and post-sign-in routing (368)
  - Behaviour, merits, demerits, leaderboard, and child notes (313)
  - Attendance and rota workflows (301)

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
- Graphify evidence: 338 nodes, 730 links, communities 0, 1, 2, 3, 4, 5, 7, 8.
- Relationship types: calls: 441, contains: 252, imports_from: 36, method: 1.
- Confidence mix: EXTRACTED: 401, INFERRED: 329.
- Connected modules:
  - Registration, parent, student, supervisor, and admin shells (600)
  - RBAC, permission tags, and access boundaries (487)
  - Shop, invoices, clubs, calendar, tithe, investment, reports, notices, messages, and email (333)
  - Identity, Clerk sync, sessions, and post-sign-in routing (318)
  - Attendance and rota workflows (315)

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
- Graphify evidence: 249 nodes, 554 links, communities 0, 1, 3, 4, 7, 8, 15, 29.
- Relationship types: calls: 323, contains: 207, imports_from: 23, method: 1.
- Confidence mix: EXTRACTED: 316, INFERRED: 238.
- Connected modules:
  - Behaviour, merits, demerits, leaderboard, and child notes (436)
  - Registration, parent, student, supervisor, and admin shells (436)
  - Admin access, users, invitations, audit, and profiles (315)
  - Identity, Clerk sync, sessions, and post-sign-in routing (302)
  - RBAC, permission tags, and access boundaries (301)

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
- Graphify evidence: 348 nodes, 751 links, communities 0, 1, 2, 3, 5, 6, 7, 8.
- Relationship types: calls: 407, contains: 294, imports_from: 49, method: 1.
- Confidence mix: EXTRACTED: 464, INFERRED: 287.
- Connected modules:
  - Attendance and rota workflows (436)
  - Registration, parent, student, supervisor, and admin shells (436)
  - Identity, Clerk sync, sessions, and post-sign-in routing (323)
  - Admin access, users, invitations, audit, and profiles (315)
  - RBAC, permission tags, and access boundaries (313)

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
- Graphify evidence: 75 nodes, 265 links, communities 0, 5, 13, 45, 54, 103, 106, 113.
- Relationship types: calls: 188, contains: 70, imports_from: 7.
- Confidence mix: INFERRED: 151, EXTRACTED: 114.
- Connected modules:
  - Shop, invoices, clubs, calendar, tithe, investment, reports, notices, messages, and email (47)
  - Registration, parent, student, supervisor, and admin shells (34)
  - Behaviour, merits, demerits, leaderboard, and child notes (26)
  - Database, RLS, encryption, and Supabase/Postgres support (24)
  - PACE, subjects, school years, and academic progress (19)

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
- Graphify evidence: 198 nodes, 306 links, communities 0, 1, 20, 29, 33, 44, 51, 56.
- Relationship types: contains: 157, calls: 141, imports_from: 8.
- Confidence mix: EXTRACTED: 210, INFERRED: 96.
- Connected modules:
  - Registration, parent, student, supervisor, and admin shells (157)
  - Behaviour, merits, demerits, leaderboard, and child notes (151)
  - Attendance and rota workflows (147)
  - Shared UI primitives and cross-app tRPC clients (140)
  - Shop, invoices, clubs, calendar, tithe, investment, reports, notices, messages, and email (62)

### Registration, parent, student, supervisor, and admin shells

- Owns: Portal shells, registration form flow, role-specific navigation, and cross-role dashboard entry points.
- API routers:
  - `apps/api/src/routers/profile.ts`
  - `apps/api/src/routers/registration.ts`
  - `apps/api/src/routers/student.ts`
- Domain helpers:
  - `packages/domain/src/rbac.ts`
  - `packages/domain/src/registration.ts`
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
- Graphify evidence: 597 nodes, 1021 links, communities 0, 1, 2, 3, 4, 5, 7, 8.
- Relationship types: calls: 544, contains: 445, imports_from: 31, method: 1.
- Confidence mix: EXTRACTED: 644, INFERRED: 377.
- Connected modules:
  - Admin access, users, invitations, audit, and profiles (600)
  - Attendance and rota workflows (436)
  - Behaviour, merits, demerits, leaderboard, and child notes (436)
  - Shop, invoices, clubs, calendar, tithe, investment, reports, notices, messages, and email (419)
  - RBAC, permission tags, and access boundaries (372)

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
- Graphify evidence: 1000 nodes, 1780 links, communities 0, 1, 2, 3, 4, 5, 6, 8.
- Relationship types: calls: 870, contains: 835, imports_from: 75.
- Confidence mix: EXTRACTED: 1277, INFERRED: 503.
- Connected modules:
  - Registration, parent, student, supervisor, and admin shells (419)
  - Admin access, users, invitations, audit, and profiles (333)
  - RBAC, permission tags, and access boundaries (167)
  - Behaviour, merits, demerits, leaderboard, and child notes (157)
  - Attendance and rota workflows (152)

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
- Graphify evidence: 207 nodes, 368 links, communities 0, 1, 2, 4, 5, 29, 33, 34.
- Relationship types: contains: 149, calls: 140, imports_from: 79.
- Confidence mix: EXTRACTED: 262, INFERRED: 106.
- Connected modules:
  - Registration, parent, student, supervisor, and admin shells (160)
  - Behaviour, merits, demerits, leaderboard, and child notes (151)
  - Attendance and rota workflows (146)
  - PACE, subjects, school years, and academic progress (140)
  - Shop, invoices, clubs, calendar, tithe, investment, reports, notices, messages, and email (115)

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
- Graphify evidence: 121 nodes, 294 links, communities 0, 5, 12, 14, 16, 22, 182.
- Relationship types: calls: 179, contains: 96, imports_from: 13, rationale_for: 2, references: 2, conceptually_related_to: 1, implements: 1.
- Confidence mix: EXTRACTED: 217, INFERRED: 77.
- Connected modules:
  - Incident reports, staff review, and parent-safe release (24)
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
