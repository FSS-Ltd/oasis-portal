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

Generated from `graphify-out/graph.json` with 1929 graph nodes and 3055 graph links.

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
- Graphify evidence: 118 nodes, 493 links, communities 1, 2, 3, 4, 6, 9, 12, 14.
- Relationship types: calls: 316, contains: 93, imports_from: 83, method: 1.
- Confidence mix: EXTRACTED: 269, INFERRED: 224.
- Connected modules:
  - RBAC, permission tags, and access boundaries (348)
  - Admin access, users, invitations, audit, and profiles (301)
  - Behaviour, merits, demerits, leaderboard, and child notes (300)
  - Registration, parent, student, supervisor, and admin shells (294)
  - Attendance and rota workflows (287)

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
- Graphify evidence: 103 nodes, 523 links, communities 1, 2, 3, 4, 12, 14, 21.
- Relationship types: calls: 362, contains: 93, imports_from: 63, conceptually_related_to: 1, implements: 1, method: 1, rationale_for: 1, references: 1.
- Confidence mix: INFERRED: 276, EXTRACTED: 247.
- Connected modules:
  - Admin access, users, invitations, audit, and profiles (457)
  - Registration, parent, student, supervisor, and admin shells (349)
  - Identity, Clerk sync, sessions, and post-sign-in routing (348)
  - Behaviour, merits, demerits, leaderboard, and child notes (298)
  - Attendance and rota workflows (286)

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
- Graphify evidence: 320 nodes, 670 links, communities 0, 1, 2, 3, 4, 5, 12, 27.
- Relationship types: calls: 402, contains: 238, imports_from: 29, method: 1.
- Confidence mix: EXTRACTED: 373, INFERRED: 297.
- Connected modules:
  - Registration, parent, student, supervisor, and admin shells (548)
  - RBAC, permission tags, and access boundaries (457)
  - Identity, Clerk sync, sessions, and post-sign-in routing (301)
  - Attendance and rota workflows (298)
  - Behaviour, merits, demerits, leaderboard, and child notes (298)

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
- Graphify evidence: 232 nodes, 502 links, communities 0, 1, 3, 8, 12, 17, 18, 22.
- Relationship types: calls: 291, contains: 192, imports_from: 18, method: 1.
- Confidence mix: EXTRACTED: 294, INFERRED: 208.
- Connected modules:
  - Behaviour, merits, demerits, leaderboard, and child notes (411)
  - Registration, parent, student, supervisor, and admin shells (411)
  - Admin access, users, invitations, audit, and profiles (298)
  - Identity, Clerk sync, sessions, and post-sign-in routing (287)
  - RBAC, permission tags, and access boundaries (286)

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
- Graphify evidence: 317 nodes, 661 links, communities 0, 1, 2, 3, 9, 12, 16, 19.
- Relationship types: calls: 352, contains: 268, imports_from: 40, method: 1.
- Confidence mix: EXTRACTED: 423, INFERRED: 238.
- Connected modules:
  - Attendance and rota workflows (411)
  - Registration, parent, student, supervisor, and admin shells (411)
  - Identity, Clerk sync, sessions, and post-sign-in routing (300)
  - Admin access, users, invitations, audit, and profiles (298)
  - RBAC, permission tags, and access boundaries (298)

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
- Graphify evidence: 196 nodes, 288 links, communities 0, 1, 8, 20, 22, 29, 32, 43.
- Relationship types: contains: 156, calls: 124, imports_from: 8.
- Confidence mix: EXTRACTED: 209, INFERRED: 79.
- Connected modules:
  - Registration, parent, student, supervisor, and admin shells (149)
  - Behaviour, merits, demerits, leaderboard, and child notes (141)
  - Attendance and rota workflows (137)
  - Shared UI primitives and cross-app tRPC clients (130)
  - Shop, invoices, clubs, calendar, tithe, investment, reports, notices, messages, and email (60)

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
- Graphify evidence: 563 nodes, 931 links, communities 0, 1, 2, 3, 4, 5, 9, 10.
- Relationship types: calls: 483, contains: 422, imports_from: 25, method: 1.
- Confidence mix: EXTRACTED: 605, INFERRED: 326.
- Connected modules:
  - Admin access, users, invitations, audit, and profiles (548)
  - Attendance and rota workflows (411)
  - Behaviour, merits, demerits, leaderboard, and child notes (411)
  - Shop, invoices, clubs, calendar, tithe, investment, reports, notices, messages, and email (372)
  - RBAC, permission tags, and access boundaries (349)

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
  - `apps/api/src/routers/report.ts`
  - `apps/api/src/routers/shop.ts`
  - `apps/api/src/routers/tithe.ts`
- Domain helpers:
  - `packages/domain/src/clubs.ts`
  - `packages/domain/src/investmentSim.ts`
  - `packages/domain/src/investmentTransactions.ts`
  - `packages/domain/src/invoice.ts`
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
  - `apps/web/src/components/reports/`
  - `apps/web/src/components/shop/`
  - `apps/web/src/components/ui/`
- Mobile surfaces:
  - `apps/mobile/src/components/smoke/parent-portal-smoke-screen.tsx`
  - `apps/mobile/src/components/smoke/parent-smoke-messages.tsx`
  - `apps/mobile/src/components/smoke/parent-smoke-notices.tsx`
- Shared or infrastructure surfaces:
  - `apps/api/src/emails/`
- Graphify evidence: 729 nodes, 1169 links, communities 0, 1, 2, 3, 4, 5, 6, 7.
- Relationship types: contains: 590, calls: 516, imports_from: 63.
- Confidence mix: EXTRACTED: 860, INFERRED: 309.
- Connected modules:
  - Registration, parent, student, supervisor, and admin shells (372)
  - Admin access, users, invitations, audit, and profiles (293)
  - RBAC, permission tags, and access boundaries (151)
  - Behaviour, merits, demerits, leaderboard, and child notes (146)
  - Attendance and rota workflows (138)

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
- Graphify evidence: 175 nodes, 247 links, communities 0, 1, 2, 3, 22, 29, 32, 33.
- Relationship types: contains: 125, imports_from: 73, calls: 49.
- Confidence mix: EXTRACTED: 217, INFERRED: 30.
- Connected modules:
  - Behaviour, merits, demerits, leaderboard, and child notes (140)
  - Registration, parent, student, supervisor, and admin shells (140)
  - Attendance and rota workflows (133)
  - PACE, subjects, school years, and academic progress (130)
  - Shop, invoices, clubs, calendar, tithe, investment, reports, notices, messages, and email (65)

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
- Graphify evidence: 97 nodes, 196 links, communities 0, 5, 9, 14, 21, 51, 156.
- Relationship types: calls: 104, contains: 74, imports_from: 12, rationale_for: 2, references: 2, conceptually_related_to: 1, implements: 1.
- Confidence mix: EXTRACTED: 150, INFERRED: 46.
- Connected modules:
  - Shop, invoices, clubs, calendar, tithe, investment, reports, notices, messages, and email (13)
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
