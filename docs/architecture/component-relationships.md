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

Generated from `graphify-out/graph.json` with 1590 graph nodes and 2479 graph links.

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
- Graphify evidence: 110 nodes, 409 links, communities 1, 2, 3, 4, 5, 7, 8, 13.
- Relationship types: calls: 251, contains: 85, imports_from: 72, method: 1.
- Confidence mix: EXTRACTED: 233, INFERRED: 176.
- Connected modules:
  - RBAC, permission tags, and access boundaries (275)
  - Admin access, users, invitations, audit, and profiles (237)
  - Behaviour, merits, demerits, leaderboard, and child notes (235)
  - Registration, parent, student, supervisor, and admin shells (230)
  - Attendance and rota workflows (223)

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
- Graphify evidence: 93 nodes, 429 links, communities 1, 2, 3, 4, 5, 13, 16.
- Relationship types: calls: 287, contains: 83, imports_from: 54, conceptually_related_to: 1, implements: 1, method: 1, rationale_for: 1, references: 1.
- Confidence mix: INFERRED: 217, EXTRACTED: 212.
- Connected modules:
  - Admin access, users, invitations, audit, and profiles (376)
  - Registration, parent, student, supervisor, and admin shells (277)
  - Identity, Clerk sync, sessions, and post-sign-in routing (275)
  - Behaviour, merits, demerits, leaderboard, and child notes (229)
  - Attendance and rota workflows (222)

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
- Graphify evidence: 302 nodes, 580 links, communities 0, 1, 2, 3, 4, 5, 13, 20.
- Relationship types: calls: 328, contains: 223, imports_from: 28, method: 1.
- Confidence mix: EXTRACTED: 342, INFERRED: 238.
- Connected modules:
  - Registration, parent, student, supervisor, and admin shells (468)
  - RBAC, permission tags, and access boundaries (376)
  - Shop, clubs, calendar, tithe, investment, reports, notices, messages, and email (244)
  - Identity, Clerk sync, sessions, and post-sign-in routing (237)
  - Attendance and rota workflows (234)

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
- Graphify evidence: 194 nodes, 402 links, communities 0, 1, 2, 3, 5, 10, 13, 21.
- Relationship types: calls: 225, contains: 159, imports_from: 17, method: 1.
- Confidence mix: EXTRACTED: 244, INFERRED: 158.
- Connected modules:
  - Behaviour, merits, demerits, leaderboard, and child notes (312)
  - Registration, parent, student, supervisor, and admin shells (312)
  - Admin access, users, invitations, audit, and profiles (234)
  - Identity, Clerk sync, sessions, and post-sign-in routing (223)
  - RBAC, permission tags, and access boundaries (222)

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
- Graphify evidence: 258 nodes, 522 links, communities 0, 1, 2, 3, 5, 7, 11, 13.
- Relationship types: calls: 270, contains: 214, imports_from: 37, method: 1.
- Confidence mix: EXTRACTED: 338, INFERRED: 184.
- Connected modules:
  - Attendance and rota workflows (312)
  - Registration, parent, student, supervisor, and admin shells (312)
  - Identity, Clerk sync, sessions, and post-sign-in routing (235)
  - Admin access, users, invitations, audit, and profiles (234)
  - RBAC, permission tags, and access boundaries (229)

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
- Graphify evidence: 163 nodes, 246 links, communities 0, 2, 10, 11, 21, 24, 33, 42.
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
- Graphify evidence: 500 nodes, 802 links, communities 0, 1, 2, 3, 4, 5, 6, 7.
- Relationship types: calls: 404, contains: 373, imports_from: 24, method: 1.
- Confidence mix: EXTRACTED: 539, INFERRED: 263.
- Connected modules:
  - Admin access, users, invitations, audit, and profiles (468)
  - Attendance and rota workflows (312)
  - Behaviour, merits, demerits, leaderboard, and child notes (312)
  - Shop, clubs, calendar, tithe, investment, reports, notices, messages, and email (309)
  - RBAC, permission tags, and access boundaries (277)

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
- Graphify evidence: 510 nodes, 817 links, communities 0, 1, 2, 3, 6, 8, 9, 10.
- Relationship types: contains: 396, calls: 370, imports_from: 51.
- Confidence mix: EXTRACTED: 592, INFERRED: 225.
- Connected modules:
  - Registration, parent, student, supervisor, and admin shells (309)
  - Admin access, users, invitations, audit, and profiles (244)
  - Behaviour, merits, demerits, leaderboard, and child notes (110)
  - RBAC, permission tags, and access boundaries (107)
  - Attendance and rota workflows (103)

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
- Graphify evidence: 143 nodes, 205 links, communities 0, 1, 2, 4, 21, 24, 27, 29.
- Relationship types: contains: 98, imports_from: 67, calls: 40.
- Confidence mix: EXTRACTED: 181, INFERRED: 24.
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
- Graphify evidence: 97 nodes, 190 links, communities 0, 4, 7, 12, 16, 41, 136.
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
