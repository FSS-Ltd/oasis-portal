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

Generated from `graphify-out/graph.json` with 1540 graph nodes and 2407 graph links.

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
- Graphify evidence: 109 nodes, 378 links, communities 0, 2, 4, 11, 12, 14, 20, 50.
- Relationship types: calls: 227, contains: 84, imports_from: 66, method: 1.
- Confidence mix: EXTRACTED: 223, INFERRED: 155.
- Connected modules:
  - RBAC, permission tags, and access boundaries (244)
  - Admin access, users, invitations, audit, and profiles (212)
  - Behaviour, merits, demerits, leaderboard, and child notes (209)
  - Registration, parent, student, supervisor, and admin shells (205)
  - Attendance and rota workflows (198)

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
- Graphify evidence: 92 nodes, 395 links, communities 0, 2, 3, 12, 14, 17.
- Relationship types: calls: 260, contains: 82, imports_from: 48, conceptually_related_to: 1, implements: 1, method: 1, rationale_for: 1, references: 1.
- Confidence mix: EXTRACTED: 202, INFERRED: 193.
- Connected modules:
  - Admin access, users, invitations, audit, and profiles (348)
  - Registration, parent, student, supervisor, and admin shells (249)
  - Identity, Clerk sync, sessions, and post-sign-in routing (244)
  - Behaviour, merits, demerits, leaderboard, and child notes (203)
  - Attendance and rota workflows (197)

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
- Graphify evidence: 299 nodes, 551 links, communities 0, 1, 2, 3, 12, 20, 25, 27.
- Relationship types: calls: 301, contains: 221, imports_from: 28, method: 1.
- Confidence mix: EXTRACTED: 337, INFERRED: 214.
- Connected modules:
  - Registration, parent, student, supervisor, and admin shells (439)
  - RBAC, permission tags, and access boundaries (348)
  - Shop, clubs, calendar, tithe, investment, reports, notices, messages, and email (231)
  - Identity, Clerk sync, sessions, and post-sign-in routing (212)
  - Attendance and rota workflows (209)

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
- Graphify evidence: 188 nodes, 371 links, communities 0, 1, 2, 3, 7, 12, 21, 23.
- Relationship types: calls: 200, contains: 153, imports_from: 17, method: 1.
- Confidence mix: EXTRACTED: 234, INFERRED: 137.
- Connected modules:
  - Behaviour, merits, demerits, leaderboard, and child notes (281)
  - Registration, parent, student, supervisor, and admin shells (281)
  - Admin access, users, invitations, audit, and profiles (209)
  - Identity, Clerk sync, sessions, and post-sign-in routing (198)
  - RBAC, permission tags, and access boundaries (197)

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
- Graphify evidence: 229 nodes, 457 links, communities 0, 1, 2, 3, 4, 10, 12, 16.
- Relationship types: calls: 234, contains: 187, imports_from: 35, method: 1.
- Confidence mix: EXTRACTED: 296, INFERRED: 161.
- Connected modules:
  - Attendance and rota workflows (281)
  - Registration, parent, student, supervisor, and admin shells (281)
  - Admin access, users, invitations, audit, and profiles (209)
  - Identity, Clerk sync, sessions, and post-sign-in routing (209)
  - RBAC, permission tags, and access boundaries (203)

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
- Graphify evidence: 157 nodes, 236 links, communities 1, 7, 10, 21, 24, 34, 37, 45.
- Relationship types: contains: 122, calls: 106, imports_from: 8.
- Confidence mix: EXTRACTED: 165, INFERRED: 71.
- Connected modules:
  - Registration, parent, student, supervisor, and admin shells (105)
  - Behaviour, merits, demerits, leaderboard, and child notes (96)
  - Attendance and rota workflows (92)
  - Shared UI primitives and cross-app tRPC clients (89)
  - Shop, clubs, calendar, tithe, investment, reports, notices, messages, and email (56)

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
  - `apps/web/src/components/navigation/`
  - `apps/web/src/components/supervisor/`
- Mobile surfaces:
  - `apps/mobile/app/`
  - `apps/mobile/src/components/`
- Shared or infrastructure surfaces:
  - `apps/web/src/components/ui/`
- Graphify evidence: 487 nodes, 762 links, communities 0, 1, 2, 3, 4, 6, 12, 20.
- Relationship types: calls: 374, contains: 363, imports_from: 24, method: 1.
- Confidence mix: EXTRACTED: 524, INFERRED: 238.
- Connected modules:
  - Admin access, users, invitations, audit, and profiles (439)
  - Shop, clubs, calendar, tithe, investment, reports, notices, messages, and email (295)
  - Attendance and rota workflows (281)
  - Behaviour, merits, demerits, leaderboard, and child notes (281)
  - RBAC, permission tags, and access boundaries (249)

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
- Graphify evidence: 480 nodes, 748 links, communities 0, 1, 2, 5, 6, 7, 10, 11.
- Relationship types: contains: 368, calls: 334, imports_from: 46.
- Confidence mix: EXTRACTED: 534, INFERRED: 214.
- Connected modules:
  - Registration, parent, student, supervisor, and admin shells (295)
  - Admin access, users, invitations, audit, and profiles (231)
  - Behaviour, merits, demerits, leaderboard, and child notes (97)
  - RBAC, permission tags, and access boundaries (93)
  - Attendance and rota workflows (92)

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
- Graphify evidence: 138 nodes, 196 links, communities 0, 1, 2, 3, 21, 24, 26, 27.
- Relationship types: contains: 93, imports_from: 64, calls: 39.
- Confidence mix: EXTRACTED: 172, INFERRED: 24.
- Connected modules:
  - Behaviour, merits, demerits, leaderboard, and child notes (99)
  - Registration, parent, student, supervisor, and admin shells (98)
  - Attendance and rota workflows (92)
  - PACE, subjects, school years, and academic progress (89)
  - Shop, clubs, calendar, tithe, investment, reports, notices, messages, and email (57)

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
- Graphify evidence: 144 nodes, 296 links, communities 1, 4, 8, 9, 14, 17, 44, 138.
- Relationship types: calls: 156, contains: 118, imports_from: 16, rationale_for: 2, references: 2, conceptually_related_to: 1, implements: 1.
- Confidence mix: EXTRACTED: 235, INFERRED: 61.
- Connected modules:
  - Shop, clubs, calendar, tithe, investment, reports, notices, messages, and email (20)
  - PACE, subjects, school years, and academic progress (5)
  - Shared UI primitives and cross-app tRPC clients (5)
  - Identity, Clerk sync, sessions, and post-sign-in routing (2)
  - RBAC, permission tags, and access boundaries (1)

<!-- COMPONENT_MAP:END -->

## Maintenance

- Regenerate this document after running `graphify update .`.
- Keep the human sections short and stable.
- Keep generated evidence factual. Do not hand-edit the generated section.
- When a product module gains a new router, domain file, or UI surface, update `scripts/generate-component-map.mjs` in the same PR.
