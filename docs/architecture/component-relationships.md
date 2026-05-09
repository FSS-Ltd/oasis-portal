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

Generated from `graphify-out/graph.json` with 1008 graph nodes and 1488 graph links.

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
- Graphify evidence: 92 nodes, 268 links, communities 1, 2, 3, 4, 5, 7, 12, 13.
- Relationship types: calls: 150, contains: 68, imports_from: 49, method: 1.
- Confidence mix: EXTRACTED: 168, INFERRED: 100.
- Connected modules:
  - RBAC, permission tags, and access boundaries (187)
  - Admin access, users, invitations, audit, and profiles (157)
  - Registration, parent, student, supervisor, and admin shells (149)
  - Behaviour, merits, demerits, leaderboard, and child notes (145)
  - Attendance and rota workflows (144)

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
- Graphify evidence: 83 nodes, 321 links, communities 1, 2, 3, 4, 5, 8, 13.
- Relationship types: calls: 199, contains: 73, imports_from: 44, conceptually_related_to: 1, implements: 1, method: 1, rationale_for: 1, references: 1.
- Confidence mix: EXTRACTED: 176, INFERRED: 145.
- Connected modules:
  - Admin access, users, invitations, audit, and profiles (278)
  - Registration, parent, student, supervisor, and admin shells (188)
  - Identity, Clerk sync, sessions, and post-sign-in routing (187)
  - Behaviour, merits, demerits, leaderboard, and child notes (150)
  - Attendance and rota workflows (144)

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
- Graphify evidence: 262 nodes, 451 links, communities 0, 1, 2, 3, 4, 12, 13, 21.
- Relationship types: calls: 233, contains: 191, imports_from: 26, method: 1.
- Confidence mix: EXTRACTED: 288, INFERRED: 163.
- Connected modules:
  - Registration, parent, student, supervisor, and admin shells (351)
  - RBAC, permission tags, and access boundaries (278)
  - Shop, clubs, calendar, tithe, investment, reports, notices, messages, and email (183)
  - Identity, Clerk sync, sessions, and post-sign-in routing (157)
  - Attendance and rota workflows (154)

### Attendance and rota workflows

- Owns: Attendance capture, export, historical attendance, staff rota, and rota validation.
- API routers:
  - `apps/api/src/routers/attendance.ts`
  - `apps/api/src/routers/rota.ts`
- Domain helpers:
  - `packages/domain/src/rbac.ts`
- Web surfaces:
  - `apps/web/src/components/attendance/`
  - `apps/web/src/components/student-drillthrough/attendance-calendar.tsx`
- Mobile surfaces:
  - `apps/mobile/src/components/smoke/`
- Shared or infrastructure surfaces:
  - `apps/web/src/components/ui/`
- Graphify evidence: 121 nodes, 254 links, communities 0, 1, 2, 3, 4, 13, 14, 18.
- Relationship types: calls: 136, contains: 101, imports_from: 16, method: 1.
- Confidence mix: EXTRACTED: 169, INFERRED: 85.
- Connected modules:
  - Behaviour, merits, demerits, leaderboard, and child notes (189)
  - Registration, parent, student, supervisor, and admin shells (189)
  - Admin access, users, invitations, audit, and profiles (154)
  - Identity, Clerk sync, sessions, and post-sign-in routing (144)
  - RBAC, permission tags, and access boundaries (144)

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
- Graphify evidence: 147 nodes, 306 links, communities 0, 1, 2, 3, 4, 13, 15, 16.
- Relationship types: calls: 155, contains: 119, imports_from: 31, method: 1.
- Confidence mix: EXTRACTED: 207, INFERRED: 99.
- Connected modules:
  - Attendance and rota workflows (189)
  - Registration, parent, student, supervisor, and admin shells (189)
  - Admin access, users, invitations, audit, and profiles (154)
  - RBAC, permission tags, and access boundaries (150)
  - Identity, Clerk sync, sessions, and post-sign-in routing (145)

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
- Graphify evidence: 87 nodes, 157 links, communities 0, 3, 17, 19, 22, 26, 48, 49.
- Relationship types: calls: 82, contains: 67, imports_from: 8.
- Confidence mix: EXTRACTED: 102, INFERRED: 55.
- Connected modules:
  - Registration, parent, student, supervisor, and admin shells (65)
  - Behaviour, merits, demerits, leaderboard, and child notes (55)
  - Attendance and rota workflows (52)
  - Shared UI primitives and cross-app tRPC clients (50)
  - Shop, clubs, calendar, tithe, investment, reports, notices, messages, and email (26)

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
  - `apps/web/src/app/(parent)/`
  - `apps/web/src/app/(supervisor)/`
  - `apps/web/src/app/registration/`
  - `apps/web/src/components/supervisor/`
- Mobile surfaces:
  - `apps/mobile/app/`
  - `apps/mobile/src/components/`
- Shared or infrastructure surfaces:
  - `apps/web/src/components/ui/`
- Graphify evidence: 362 nodes, 554 links, communities 0, 1, 2, 3, 4, 6, 12, 13.
- Relationship types: calls: 268, contains: 263, imports_from: 22, method: 1.
- Confidence mix: EXTRACTED: 378, INFERRED: 176.
- Connected modules:
  - Admin access, users, invitations, audit, and profiles (351)
  - Shop, clubs, calendar, tithe, investment, reports, notices, messages, and email (211)
  - Attendance and rota workflows (189)
  - Behaviour, merits, demerits, leaderboard, and child notes (189)
  - RBAC, permission tags, and access boundaries (188)

### Shop, clubs, calendar, tithe, investment, reports, notices, messages, and email

- Owns: Commercial, calendar, and communication workflows that hang off student, parent, staff, and admin experiences.
- API routers:
  - `apps/api/src/routers/calendar.ts`
  - `apps/api/src/routers/club.ts`
  - `apps/api/src/routers/email.ts`
  - `apps/api/src/routers/investment.ts`
  - `apps/api/src/routers/message.ts`
  - `apps/api/src/routers/notice.ts`
  - `apps/api/src/routers/report.ts`
  - `apps/api/src/routers/shop.ts`
  - `apps/api/src/routers/tithe.ts`
- Domain helpers:
  - `packages/domain/src/clubs.ts`
  - `packages/domain/src/investmentSim.ts`
  - `packages/domain/src/report.ts`
  - `packages/domain/src/shop.ts`
  - `packages/domain/src/tithe.ts`
- Web surfaces:
  - `apps/web/src/app/(admin)/`
  - `apps/web/src/app/(parent)/`
  - `apps/web/src/components/calendar/`
  - `apps/web/src/components/noticeboard/`
  - `apps/web/src/components/ui/`
- Mobile surfaces:
  - _None configured_
- Shared or infrastructure surfaces:
  - `apps/api/src/emails/`
- Graphify evidence: 272 nodes, 372 links, communities 0, 1, 2, 4, 7, 9, 10, 15.
- Relationship types: contains: 184, calls: 146, imports_from: 42.
- Confidence mix: EXTRACTED: 262, INFERRED: 110.
- Connected modules:
  - Registration, parent, student, supervisor, and admin shells (211)
  - Admin access, users, invitations, audit, and profiles (183)
  - RBAC, permission tags, and access boundaries (59)
  - Behaviour, merits, demerits, leaderboard, and child notes (45)
  - Attendance and rota workflows (38)

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
- Graphify evidence: 93 nodes, 155 links, communities 0, 1, 4, 5, 19, 23, 25, 26.
- Relationship types: imports_from: 62, contains: 61, calls: 32.
- Confidence mix: EXTRACTED: 138, INFERRED: 17.
- Connected modules:
  - Behaviour, merits, demerits, leaderboard, and child notes (60)
  - Registration, parent, student, supervisor, and admin shells (59)
  - Attendance and rota workflows (53)
  - PACE, subjects, school years, and academic progress (50)
  - Shop, clubs, calendar, tithe, investment, reports, notices, messages, and email (33)

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
- Graphify evidence: 53 nodes, 88 links, communities 0, 5, 8, 28, 38, 121.
- Relationship types: calls: 41, contains: 33, imports_from: 8, rationale_for: 2, references: 2, conceptually_related_to: 1, implements: 1.
- Confidence mix: EXTRACTED: 66, INFERRED: 22.
- Connected modules:
  - PACE, subjects, school years, and academic progress (5)
  - Shared UI primitives and cross-app tRPC clients (5)
  - Shop, clubs, calendar, tithe, investment, reports, notices, messages, and email (5)
  - RBAC, permission tags, and access boundaries (1)

<!-- COMPONENT_MAP:END -->

## Maintenance

- Regenerate this document after running `graphify update .`.
- Keep the human sections short and stable.
- Keep generated evidence factual. Do not hand-edit the generated section.
- When a product module gains a new router, domain file, or UI surface, update `scripts/generate-component-map.mjs` in the same PR.
