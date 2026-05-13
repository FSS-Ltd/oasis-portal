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

Generated from `graphify-out/graph.json` with 1494 graph nodes and 2334 graph links.

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
- Graphify evidence: 109 nodes, 374 links, communities 1, 2, 3, 4, 7, 9, 13, 19.
- Relationship types: calls: 223, contains: 84, imports_from: 66, method: 1.
- Confidence mix: EXTRACTED: 223, INFERRED: 151.
- Connected modules:
  - RBAC, permission tags, and access boundaries (240)
  - Admin access, users, invitations, audit, and profiles (208)
  - Behaviour, merits, demerits, leaderboard, and child notes (205)
  - Registration, parent, student, supervisor, and admin shells (201)
  - Attendance and rota workflows (194)

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
- Graphify evidence: 92 nodes, 391 links, communities 1, 2, 3, 4, 13, 14, 16.
- Relationship types: calls: 256, contains: 82, imports_from: 48, conceptually_related_to: 1, implements: 1, method: 1, rationale_for: 1, references: 1.
- Confidence mix: EXTRACTED: 202, INFERRED: 189.
- Connected modules:
  - Admin access, users, invitations, audit, and profiles (344)
  - Registration, parent, student, supervisor, and admin shells (245)
  - Identity, Clerk sync, sessions, and post-sign-in routing (240)
  - Behaviour, merits, demerits, leaderboard, and child notes (199)
  - Attendance and rota workflows (193)

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
- Graphify evidence: 299 nodes, 547 links, communities 0, 1, 2, 3, 4, 14, 19, 24.
- Relationship types: calls: 297, contains: 221, imports_from: 28, method: 1.
- Confidence mix: EXTRACTED: 337, INFERRED: 210.
- Connected modules:
  - Registration, parent, student, supervisor, and admin shells (435)
  - RBAC, permission tags, and access boundaries (344)
  - Shop, clubs, calendar, tithe, investment, reports, notices, messages, and email (228)
  - Identity, Clerk sync, sessions, and post-sign-in routing (208)
  - Attendance and rota workflows (205)

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
- Graphify evidence: 178 nodes, 357 links, communities 0, 1, 2, 3, 4, 6, 12, 22.
- Relationship types: calls: 194, contains: 145, imports_from: 17, method: 1.
- Confidence mix: EXTRACTED: 226, INFERRED: 131.
- Connected modules:
  - Behaviour, merits, demerits, leaderboard, and child notes (267)
  - Registration, parent, student, supervisor, and admin shells (267)
  - Admin access, users, invitations, audit, and profiles (205)
  - Identity, Clerk sync, sessions, and post-sign-in routing (194)
  - RBAC, permission tags, and access boundaries (193)

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
- Graphify evidence: 215 nodes, 434 links, communities 0, 1, 2, 3, 4, 6, 9, 12.
- Relationship types: calls: 223, contains: 175, imports_from: 35, method: 1.
- Confidence mix: EXTRACTED: 282, INFERRED: 152.
- Connected modules:
  - Attendance and rota workflows (267)
  - Registration, parent, student, supervisor, and admin shells (267)
  - Admin access, users, invitations, audit, and profiles (205)
  - Identity, Clerk sync, sessions, and post-sign-in routing (205)
  - RBAC, permission tags, and access boundaries (199)

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
- Graphify evidence: 129 nodes, 196 links, communities 0, 2, 4, 6, 23, 33, 36, 52.
- Relationship types: contains: 98, calls: 90, imports_from: 8.
- Confidence mix: EXTRACTED: 134, INFERRED: 62.
- Connected modules:
  - Registration, parent, student, supervisor, and admin shells (94)
  - Behaviour, merits, demerits, leaderboard, and child notes (83)
  - Attendance and rota workflows (81)
  - Shared UI primitives and cross-app tRPC clients (79)
  - Shop, clubs, calendar, tithe, investment, reports, notices, messages, and email (49)

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
- Graphify evidence: 477 nodes, 748 links, communities 0, 1, 2, 3, 4, 5, 6, 12.
- Relationship types: calls: 368, contains: 355, imports_from: 24, method: 1.
- Confidence mix: EXTRACTED: 516, INFERRED: 232.
- Connected modules:
  - Admin access, users, invitations, audit, and profiles (435)
  - Shop, clubs, calendar, tithe, investment, reports, notices, messages, and email (288)
  - Attendance and rota workflows (267)
  - Behaviour, merits, demerits, leaderboard, and child notes (267)
  - RBAC, permission tags, and access boundaries (245)

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
- Graphify evidence: 466 nodes, 716 links, communities 0, 1, 2, 3, 5, 6, 7, 8.
- Relationship types: contains: 354, calls: 316, imports_from: 46.
- Confidence mix: EXTRACTED: 511, INFERRED: 205.
- Connected modules:
  - Registration, parent, student, supervisor, and admin shells (288)
  - Admin access, users, invitations, audit, and profiles (228)
  - RBAC, permission tags, and access boundaries (90)
  - Behaviour, merits, demerits, leaderboard, and child notes (89)
  - Attendance and rota workflows (85)

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
- Graphify evidence: 128 nodes, 186 links, communities 0, 1, 2, 6, 14, 23, 25, 26.
- Relationship types: contains: 85, imports_from: 64, calls: 37.
- Confidence mix: EXTRACTED: 164, INFERRED: 22.
- Connected modules:
  - Behaviour, merits, demerits, leaderboard, and child notes (89)
  - Registration, parent, student, supervisor, and admin shells (88)
  - Attendance and rota workflows (82)
  - PACE, subjects, school years, and academic progress (79)
  - Shop, clubs, calendar, tithe, investment, reports, notices, messages, and email (53)

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
- Graphify evidence: 144 nodes, 296 links, communities 0, 9, 10, 11, 13, 16, 43, 136.
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
