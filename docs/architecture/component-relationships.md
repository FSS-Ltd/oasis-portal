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

Generated from `graphify-out/graph.json` with 1126 graph nodes and 1723 graph links.

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
- Graphify evidence: 95 nodes, 293 links, communities 0, 2, 4, 6, 7, 8, 13, 43.
- Relationship types: calls: 168, contains: 71, imports_from: 53, method: 1.
- Confidence mix: EXTRACTED: 180, INFERRED: 113.
- Connected modules:
  - RBAC, permission tags, and access boundaries (202)
  - Admin access, users, invitations, audit, and profiles (170)
  - Registration, parent, student, supervisor, and admin shells (162)
  - Behaviour, merits, demerits, leaderboard, and child notes (158)
  - Attendance and rota workflows (157)

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
- Graphify evidence: 86 nodes, 342 links, communities 0, 2, 3, 6, 7, 8, 9.
- Relationship types: calls: 215, contains: 76, imports_from: 46, conceptually_related_to: 1, implements: 1, method: 1, rationale_for: 1, references: 1.
- Confidence mix: EXTRACTED: 183, INFERRED: 159.
- Connected modules:
  - Admin access, users, invitations, audit, and profiles (297)
  - Registration, parent, student, supervisor, and admin shells (204)
  - Identity, Clerk sync, sessions, and post-sign-in routing (202)
  - Behaviour, merits, demerits, leaderboard, and child notes (163)
  - Attendance and rota workflows (157)

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
- Graphify evidence: 268 nodes, 476 links, communities 0, 1, 2, 3, 6, 8, 13, 19.
- Relationship types: calls: 253, contains: 196, imports_from: 26, method: 1.
- Confidence mix: EXTRACTED: 295, INFERRED: 181.
- Connected modules:
  - Registration, parent, student, supervisor, and admin shells (371)
  - RBAC, permission tags, and access boundaries (297)
  - Shop, clubs, calendar, tithe, investment, reports, notices, messages, and email (197)
  - Attendance and rota workflows (170)
  - Behaviour, merits, demerits, leaderboard, and child notes (170)

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
- Graphify evidence: 142 nodes, 325 links, communities 0, 1, 2, 3, 6, 8, 12, 17.
- Relationship types: calls: 191, contains: 117, imports_from: 16, method: 1.
- Confidence mix: EXTRACTED: 190, INFERRED: 135.
- Connected modules:
  - Behaviour, merits, demerits, leaderboard, and child notes (260)
  - Registration, parent, student, supervisor, and admin shells (260)
  - Admin access, users, invitations, audit, and profiles (170)
  - Identity, Clerk sync, sessions, and post-sign-in routing (157)
  - RBAC, permission tags, and access boundaries (157)

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
- Graphify evidence: 168 nodes, 377 links, communities 0, 1, 2, 3, 6, 8, 16, 18.
- Relationship types: calls: 210, contains: 135, imports_from: 31, method: 1.
- Confidence mix: EXTRACTED: 228, INFERRED: 149.
- Connected modules:
  - Attendance and rota workflows (260)
  - Registration, parent, student, supervisor, and admin shells (260)
  - Admin access, users, invitations, audit, and profiles (170)
  - RBAC, permission tags, and access boundaries (163)
  - Identity, Clerk sync, sessions, and post-sign-in routing (158)

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
- Graphify evidence: 107 nodes, 215 links, communities 1, 2, 3, 18, 20, 25, 37, 38.
- Relationship types: calls: 125, contains: 82, imports_from: 8.
- Confidence mix: EXTRACTED: 121, INFERRED: 94.
- Connected modules:
  - Registration, parent, student, supervisor, and admin shells (123)
  - Behaviour, merits, demerits, leaderboard, and child notes (113)
  - Attendance and rota workflows (110)
  - Shared UI primitives and cross-app tRPC clients (108)
  - Shop, clubs, calendar, tithe, investment, reports, notices, messages, and email (44)

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
- Graphify evidence: 422 nodes, 696 links, communities 0, 1, 2, 3, 5, 6, 8, 13.
- Relationship types: calls: 359, contains: 314, imports_from: 22, method: 1.
- Confidence mix: EXTRACTED: 461, INFERRED: 235.
- Connected modules:
  - Admin access, users, invitations, audit, and profiles (371)
  - Attendance and rota workflows (260)
  - Behaviour, merits, demerits, leaderboard, and child notes (260)
  - Shop, clubs, calendar, tithe, investment, reports, notices, messages, and email (255)
  - RBAC, permission tags, and access boundaries (204)

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
  - `apps/mobile/src/components/smoke/parent-portal-smoke-screen.tsx`
  - `apps/mobile/src/components/smoke/parent-smoke-messages.tsx`
  - `apps/mobile/src/components/smoke/parent-smoke-notices.tsx`
- Shared or infrastructure surfaces:
  - `apps/api/src/emails/`
- Graphify evidence: 325 nodes, 466 links, communities 0, 1, 2, 4, 5, 8, 10, 11.
- Relationship types: contains: 228, calls: 194, imports_from: 44.
- Confidence mix: EXTRACTED: 329, INFERRED: 137.
- Connected modules:
  - Registration, parent, student, supervisor, and admin shells (255)
  - Admin access, users, invitations, audit, and profiles (197)
  - Behaviour, merits, demerits, leaderboard, and child notes (70)
  - RBAC, permission tags, and access boundaries (70)
  - Attendance and rota workflows (63)

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
- Graphify evidence: 113 nodes, 214 links, communities 0, 1, 2, 3, 18, 22, 24, 25.
- Relationship types: contains: 76, calls: 75, imports_from: 63.
- Confidence mix: EXTRACTED: 158, INFERRED: 56.
- Connected modules:
  - Behaviour, merits, demerits, leaderboard, and child notes (118)
  - Registration, parent, student, supervisor, and admin shells (117)
  - Attendance and rota workflows (111)
  - PACE, subjects, school years, and academic progress (108)
  - Shop, clubs, calendar, tithe, investment, reports, notices, messages, and email (51)

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
- Graphify evidence: 53 nodes, 93 links, communities 1, 7, 9, 36, 126.
- Relationship types: calls: 46, contains: 33, imports_from: 8, rationale_for: 2, references: 2, conceptually_related_to: 1, implements: 1.
- Confidence mix: EXTRACTED: 66, INFERRED: 27.
- Connected modules:
  - PACE, subjects, school years, and academic progress (10)
  - Shared UI primitives and cross-app tRPC clients (10)
  - Attendance and rota workflows (5)
  - Behaviour, merits, demerits, leaderboard, and child notes (5)
  - Registration, parent, student, supervisor, and admin shells (5)

<!-- COMPONENT_MAP:END -->

## Maintenance

- Regenerate this document after running `graphify update .`.
- Keep the human sections short and stable.
- Keep generated evidence factual. Do not hand-edit the generated section.
- When a product module gains a new router, domain file, or UI surface, update `scripts/generate-component-map.mjs` in the same PR.
