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

Generated from `graphify-out/graph.json` with 1781 graph nodes and 2771 graph links.

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
- Graphify evidence: 112 nodes, 442 links, communities 0, 2, 3, 4, 6, 7, 12, 21.
- Relationship types: calls: 273, contains: 87, imports_from: 81, method: 1.
- Confidence mix: EXTRACTED: 248, INFERRED: 194.
- Connected modules:
  - RBAC, permission tags, and access boundaries (298)
  - Admin access, users, invitations, audit, and profiles (254)
  - Behaviour, merits, demerits, leaderboard, and child notes (253)
  - Registration, parent, student, supervisor, and admin shells (247)
  - Attendance and rota workflows (240)

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
- Graphify evidence: 95 nodes, 466 links, communities 0, 2, 3, 4, 12, 18, 22.
- Relationship types: calls: 315, contains: 85, imports_from: 61, conceptually_related_to: 1, implements: 1, method: 1, rationale_for: 1, references: 1.
- Confidence mix: INFERRED: 243, EXTRACTED: 223.
- Connected modules:
  - Admin access, users, invitations, audit, and profiles (403)
  - Identity, Clerk sync, sessions, and post-sign-in routing (298)
  - Registration, parent, student, supervisor, and admin shells (298)
  - Behaviour, merits, demerits, leaderboard, and child notes (251)
  - Attendance and rota workflows (239)

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
- Graphify evidence: 307 nodes, 611 links, communities 0, 1, 2, 3, 4, 21, 28, 30.
- Relationship types: calls: 355, contains: 226, imports_from: 29, method: 1.
- Confidence mix: EXTRACTED: 347, INFERRED: 264.
- Connected modules:
  - Registration, parent, student, supervisor, and admin shells (493)
  - RBAC, permission tags, and access boundaries (403)
  - Shop, clubs, calendar, tithe, investment, reports, notices, messages, and email (270)
  - Identity, Clerk sync, sessions, and post-sign-in routing (254)
  - Attendance and rota workflows (251)

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
- Graphify evidence: 221 nodes, 445 links, communities 0, 1, 2, 3, 4, 5, 13, 26.
- Relationship types: calls: 245, contains: 181, imports_from: 18, method: 1.
- Confidence mix: EXTRACTED: 268, INFERRED: 177.
- Connected modules:
  - Behaviour, merits, demerits, leaderboard, and child notes (355)
  - Registration, parent, student, supervisor, and admin shells (355)
  - Admin access, users, invitations, audit, and profiles (251)
  - Identity, Clerk sync, sessions, and post-sign-in routing (240)
  - RBAC, permission tags, and access boundaries (239)

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
- Graphify evidence: 298 nodes, 593 links, communities 0, 1, 3, 4, 5, 7, 14, 16.
- Relationship types: calls: 303, contains: 249, imports_from: 40, method: 1.
- Confidence mix: EXTRACTED: 387, INFERRED: 206.
- Connected modules:
  - Attendance and rota workflows (355)
  - Registration, parent, student, supervisor, and admin shells (355)
  - Identity, Clerk sync, sessions, and post-sign-in routing (253)
  - Admin access, users, invitations, audit, and profiles (251)
  - RBAC, permission tags, and access boundaries (251)

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
- Graphify evidence: 191 nodes, 279 links, communities 0, 1, 5, 17, 27, 37, 47, 48.
- Relationship types: contains: 151, calls: 120, imports_from: 8.
- Confidence mix: EXTRACTED: 202, INFERRED: 77.
- Connected modules:
  - Registration, parent, student, supervisor, and admin shells (140)
  - Behaviour, merits, demerits, leaderboard, and child notes (131)
  - Attendance and rota workflows (127)
  - Shared UI primitives and cross-app tRPC clients (121)
  - Shop, clubs, calendar, tithe, investment, reports, notices, messages, and email (59)

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
- Graphify evidence: 537 nodes, 858 links, communities 0, 1, 2, 3, 4, 5, 7, 10.
- Relationship types: calls: 432, contains: 400, imports_from: 25, method: 1.
- Confidence mix: EXTRACTED: 568, INFERRED: 290.
- Connected modules:
  - Admin access, users, invitations, audit, and profiles (493)
  - Attendance and rota workflows (355)
  - Behaviour, merits, demerits, leaderboard, and child notes (355)
  - Shop, clubs, calendar, tithe, investment, reports, notices, messages, and email (339)
  - RBAC, permission tags, and access boundaries (298)

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
  - `apps/web/src/components/reports/`
  - `apps/web/src/components/shop/`
  - `apps/web/src/components/ui/`
- Mobile surfaces:
  - `apps/mobile/src/components/smoke/parent-portal-smoke-screen.tsx`
  - `apps/mobile/src/components/smoke/parent-smoke-messages.tsx`
  - `apps/mobile/src/components/smoke/parent-smoke-notices.tsx`
- Shared or infrastructure surfaces:
  - `apps/api/src/emails/`
- Graphify evidence: 622 nodes, 996 links, communities 0, 1, 2, 4, 5, 6, 8, 11.
- Relationship types: contains: 494, calls: 444, imports_from: 58.
- Confidence mix: EXTRACTED: 724, INFERRED: 272.
- Connected modules:
  - Registration, parent, student, supervisor, and admin shells (339)
  - Admin access, users, invitations, audit, and profiles (270)
  - RBAC, permission tags, and access boundaries (131)
  - Behaviour, merits, demerits, leaderboard, and child notes (127)
  - Attendance and rota workflows (120)

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
- Graphify evidence: 170 nodes, 234 links, communities 0, 1, 2, 3, 5, 27, 29, 32.
- Relationship types: contains: 120, imports_from: 70, calls: 44.
- Confidence mix: EXTRACTED: 207, INFERRED: 27.
- Connected modules:
  - Behaviour, merits, demerits, leaderboard, and child notes (131)
  - Registration, parent, student, supervisor, and admin shells (130)
  - Attendance and rota workflows (124)
  - PACE, subjects, school years, and academic progress (121)
  - Shop, clubs, calendar, tithe, investment, reports, notices, messages, and email (60)

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
- Graphify evidence: 97 nodes, 190 links, communities 1, 7, 9, 12, 18, 46, 152.
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
