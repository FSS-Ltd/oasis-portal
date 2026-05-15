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

Generated from `graphify-out/graph.json` with 1632 graph nodes and 2559 graph links.

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
- Graphify evidence: 110 nodes, 421 links, communities 1, 2, 3, 4, 5, 6, 7, 9.
- Relationship types: calls: 261, contains: 85, imports_from: 74, method: 1.
- Confidence mix: EXTRACTED: 235, INFERRED: 186.
- Connected modules:
  - RBAC, permission tags, and access boundaries (285)
  - Admin access, users, invitations, audit, and profiles (245)
  - Behaviour, merits, demerits, leaderboard, and child notes (243)
  - Registration, parent, student, supervisor, and admin shells (238)
  - Attendance and rota workflows (231)

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
- Graphify evidence: 94 nodes, 447 links, communities 1, 2, 3, 4, 5, 7, 9, 12.
- Relationship types: calls: 302, contains: 84, imports_from: 56, conceptually_related_to: 1, implements: 1, method: 1, rationale_for: 1, references: 1.
- Confidence mix: INFERRED: 231, EXTRACTED: 216.
- Connected modules:
  - Admin access, users, invitations, audit, and profiles (392)
  - Registration, parent, student, supervisor, and admin shells (287)
  - Identity, Clerk sync, sessions, and post-sign-in routing (285)
  - Behaviour, merits, demerits, leaderboard, and child notes (237)
  - Attendance and rota workflows (230)

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
- Graphify evidence: 305 nodes, 600 links, communities 0, 1, 2, 3, 4, 5, 7, 9.
- Relationship types: calls: 346, contains: 225, imports_from: 28, method: 1.
- Confidence mix: EXTRACTED: 345, INFERRED: 255.
- Connected modules:
  - Registration, parent, student, supervisor, and admin shells (482)
  - RBAC, permission tags, and access boundaries (392)
  - Shop, clubs, calendar, tithe, investment, reports, notices, messages, and email (262)
  - Identity, Clerk sync, sessions, and post-sign-in routing (245)
  - Attendance and rota workflows (242)

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
- Graphify evidence: 194 nodes, 410 links, communities 0, 1, 3, 4, 5, 7, 8, 9.
- Relationship types: calls: 233, contains: 159, imports_from: 17, method: 1.
- Confidence mix: EXTRACTED: 244, INFERRED: 166.
- Connected modules:
  - Behaviour, merits, demerits, leaderboard, and child notes (320)
  - Registration, parent, student, supervisor, and admin shells (320)
  - Admin access, users, invitations, audit, and profiles (242)
  - Identity, Clerk sync, sessions, and post-sign-in routing (231)
  - RBAC, permission tags, and access boundaries (230)

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
- Graphify evidence: 258 nodes, 531 links, communities 0, 1, 2, 3, 4, 5, 7, 9.
- Relationship types: calls: 279, contains: 214, imports_from: 37, method: 1.
- Confidence mix: EXTRACTED: 338, INFERRED: 193.
- Connected modules:
  - Attendance and rota workflows (320)
  - Registration, parent, student, supervisor, and admin shells (320)
  - Identity, Clerk sync, sessions, and post-sign-in routing (243)
  - Admin access, users, invitations, audit, and profiles (242)
  - RBAC, permission tags, and access boundaries (237)

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
- Graphify evidence: 163 nodes, 246 links, communities 0, 8, 9, 22, 26, 35, 44, 45.
- Relationship types: contains: 128, calls: 110, imports_from: 8.
- Confidence mix: EXTRACTED: 173, INFERRED: 73.
- Connected modules:
  - Registration, parent, student, supervisor, and admin shells (113)
  - Behaviour, merits, demerits, leaderboard, and child notes (104)
  - Attendance and rota workflows (100)
  - Shared UI primitives and cross-app tRPC clients (95)
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
- Graphify evidence: 504 nodes, 819 links, communities 0, 1, 2, 3, 4, 5, 7, 9.
- Relationship types: calls: 419, contains: 375, imports_from: 24, method: 1.
- Confidence mix: EXTRACTED: 541, INFERRED: 278.
- Connected modules:
  - Admin access, users, invitations, audit, and profiles (482)
  - Shop, clubs, calendar, tithe, investment, reports, notices, messages, and email (326)
  - Attendance and rota workflows (320)
  - Behaviour, merits, demerits, leaderboard, and child notes (320)
  - RBAC, permission tags, and access boundaries (287)

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
  - `packages/domain/src/investmentTransactions.ts`
  - `packages/domain/src/report.ts`
  - `packages/domain/src/shop.ts`
  - `packages/domain/src/tithe.ts`
- Web surfaces:
  - `apps/web/src/app/(admin)/`
  - `apps/web/src/app/(parent)/`
  - `apps/web/src/app/(supervisor)/supervisor/shop/`
  - `apps/web/src/components/calendar/`
  - `apps/web/src/components/clubs/`
  - `apps/web/src/components/noticeboard/`
  - `apps/web/src/components/shop/`
  - `apps/web/src/components/ui/`
- Mobile surfaces:
  - `apps/mobile/src/components/smoke/parent-portal-smoke-screen.tsx`
  - `apps/mobile/src/components/smoke/parent-smoke-messages.tsx`
  - `apps/mobile/src/components/smoke/parent-smoke-notices.tsx`
- Shared or infrastructure surfaces:
  - `apps/api/src/emails/`
- Graphify evidence: 543 nodes, 885 links, communities 0, 2, 3, 4, 6, 7, 8, 9.
- Relationship types: contains: 426, calls: 407, imports_from: 52.
- Confidence mix: EXTRACTED: 631, INFERRED: 254.
- Connected modules:
  - Registration, parent, student, supervisor, and admin shells (326)
  - Admin access, users, invitations, audit, and profiles (262)
  - RBAC, permission tags, and access boundaries (122)
  - Behaviour, merits, demerits, leaderboard, and child notes (119)
  - Attendance and rota workflows (111)

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
- Graphify evidence: 143 nodes, 206 links, communities 0, 1, 2, 3, 22, 26, 29, 30.
- Relationship types: contains: 98, imports_from: 68, calls: 40.
- Confidence mix: EXTRACTED: 182, INFERRED: 24.
- Connected modules:
  - Behaviour, merits, demerits, leaderboard, and child notes (105)
  - Registration, parent, student, supervisor, and admin shells (104)
  - Attendance and rota workflows (98)
  - PACE, subjects, school years, and academic progress (95)
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
- Graphify evidence: 97 nodes, 190 links, communities 0, 5, 11, 13, 18, 43, 137.
- Relationship types: calls: 98, contains: 74, imports_from: 12, rationale_for: 2, references: 2, conceptually_related_to: 1, implements: 1.
- Confidence mix: EXTRACTED: 150, INFERRED: 40.
- Connected modules:
  - Shop, clubs, calendar, tithe, investment, reports, notices, messages, and email (13)
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
