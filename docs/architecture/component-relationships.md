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

Generated from `graphify-out/graph.json` with 1183 graph nodes and 1697 graph links.

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
- Graphify evidence: 108 nodes, 321 links, communities 1, 2, 4, 5, 8, 9, 17, 43.
- Relationship types: calls: 175, contains: 83, imports_from: 62, method: 1.
- Confidence mix: EXTRACTED: 211, INFERRED: 110.
- Connected modules:
  - RBAC, permission tags, and access boundaries (202)
  - Behaviour, merits, demerits, leaderboard, and child notes (171)
  - Admin access, users, invitations, audit, and profiles (169)
  - Registration, parent, student, supervisor, and admin shells (168)
  - Attendance and rota workflows (162)

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
- Graphify evidence: 88 nodes, 328 links, communities 1, 2, 3, 4, 5.
- Relationship types: calls: 198, contains: 81, imports_from: 48, method: 1.
- Confidence mix: EXTRACTED: 192, INFERRED: 136.
- Connected modules:
  - Admin access, users, invitations, audit, and profiles (285)
  - Identity, Clerk sync, sessions, and post-sign-in routing (202)
  - Registration, parent, student, supervisor, and admin shells (199)
  - Behaviour, merits, demerits, leaderboard, and child notes (167)
  - Attendance and rota workflows (161)

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
- Graphify evidence: 275 nodes, 455 links, communities 0, 1, 2, 3, 4, 17, 24, 25.
- Relationship types: calls: 225, contains: 202, imports_from: 27, method: 1.
- Confidence mix: EXTRACTED: 307, INFERRED: 148.
- Connected modules:
  - Registration, parent, student, supervisor, and admin shells (357)
  - RBAC, permission tags, and access boundaries (285)
  - Shop, clubs, calendar, tithe, investment, reports, notices, messages, and email (187)
  - Attendance and rota workflows (171)
  - Behaviour, merits, demerits, leaderboard, and child notes (171)

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
- Graphify evidence: 167 nodes, 302 links, communities 0, 1, 5, 7, 13, 20, 21, 29.
- Relationship types: calls: 149, contains: 135, imports_from: 17, method: 1.
- Confidence mix: EXTRACTED: 209, INFERRED: 93.
- Connected modules:
  - Behaviour, merits, demerits, leaderboard, and child notes (231)
  - Registration, parent, student, supervisor, and admin shells (231)
  - Admin access, users, invitations, audit, and profiles (171)
  - Identity, Clerk sync, sessions, and post-sign-in routing (162)
  - RBAC, permission tags, and access boundaries (161)

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
- Graphify evidence: 197 nodes, 365 links, communities 0, 1, 4, 9, 10, 14, 19, 21.
- Relationship types: calls: 171, contains: 158, imports_from: 35, method: 1.
- Confidence mix: EXTRACTED: 258, INFERRED: 107.
- Connected modules:
  - Attendance and rota workflows (231)
  - Registration, parent, student, supervisor, and admin shells (231)
  - Admin access, users, invitations, audit, and profiles (171)
  - Identity, Clerk sync, sessions, and post-sign-in routing (171)
  - RBAC, permission tags, and access boundaries (167)

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
- Graphify evidence: 121 nodes, 144 links, communities 0, 7, 21, 22, 29, 31, 49, 50.
- Relationship types: contains: 90, calls: 46, imports_from: 8.
- Confidence mix: EXTRACTED: 125, INFERRED: 19.
- Connected modules:
  - Attendance and rota workflows (76)
  - Registration, parent, student, supervisor, and admin shells (76)
  - Behaviour, merits, demerits, leaderboard, and child notes (75)
  - Shared UI primitives and cross-app tRPC clients (75)
  - Shop, clubs, calendar, tithe, investment, reports, notices, messages, and email (34)

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
- Graphify evidence: 442 nodes, 639 links, communities 0, 1, 2, 3, 4, 6, 9, 13.
- Relationship types: contains: 327, calls: 288, imports_from: 23, method: 1.
- Confidence mix: EXTRACTED: 474, INFERRED: 165.
- Connected modules:
  - Admin access, users, invitations, audit, and profiles (357)
  - Shop, clubs, calendar, tithe, investment, reports, notices, messages, and email (241)
  - Attendance and rota workflows (231)
  - Behaviour, merits, demerits, leaderboard, and child notes (231)
  - RBAC, permission tags, and access boundaries (199)

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
  - `apps/web/src/components/clubs/`
  - `apps/web/src/components/noticeboard/`
  - `apps/web/src/components/ui/`
- Mobile surfaces:
  - `apps/mobile/src/components/smoke/parent-portal-smoke-screen.tsx`
  - `apps/mobile/src/components/smoke/parent-smoke-messages.tsx`
  - `apps/mobile/src/components/smoke/parent-smoke-notices.tsx`
- Shared or infrastructure surfaces:
  - `apps/api/src/emails/`
- Graphify evidence: 350 nodes, 481 links, communities 0, 1, 3, 4, 8, 10, 11, 13.
- Relationship types: contains: 250, calls: 185, imports_from: 46.
- Confidence mix: EXTRACTED: 358, INFERRED: 123.
- Connected modules:
  - Registration, parent, student, supervisor, and admin shells (241)
  - Admin access, users, invitations, audit, and profiles (187)
  - Behaviour, merits, demerits, leaderboard, and child notes (71)
  - Attendance and rota workflows (65)
  - RBAC, permission tags, and access boundaries (65)

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
- Graphify evidence: 127 nodes, 180 links, communities 0, 4, 5, 7, 21, 27, 28, 29.
- Relationship types: contains: 84, imports_from: 64, calls: 32.
- Confidence mix: EXTRACTED: 163, INFERRED: 17.
- Connected modules:
  - Behaviour, merits, demerits, leaderboard, and child notes (84)
  - Registration, parent, student, supervisor, and admin shells (83)
  - Attendance and rota workflows (77)
  - PACE, subjects, school years, and academic progress (75)
  - Shop, clubs, calendar, tithe, investment, reports, notices, messages, and email (49)

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
- Graphify evidence: 49 nodes, 75 links, communities 0, 12, 30, 38, 129.
- Relationship types: calls: 34, contains: 33, imports_from: 8.
- Confidence mix: EXTRACTED: 61, INFERRED: 14.
- Connected modules:
  - Shared UI primitives and cross-app tRPC clients (5)
  - Shop, clubs, calendar, tithe, investment, reports, notices, messages, and email (5)

<!-- COMPONENT_MAP:END -->

## Maintenance

- Regenerate this document after running `graphify update .`.
- Keep the human sections short and stable.
- Keep generated evidence factual. Do not hand-edit the generated section.
- When a product module gains a new router, domain file, or UI surface, update `scripts/generate-component-map.mjs` in the same PR.
