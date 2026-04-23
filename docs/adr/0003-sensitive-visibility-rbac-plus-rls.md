# ADR 0003: Two-wall enforcement of sensitive visibility (RBAC + Postgres RLS)

- **Status:** Accepted
- **Date:** 2026-04-23

## Context

Behaviour entries, reports, and messages contain sensitive notes. The brief
requires:

- Full admins (Head, Principal, Pastor, Head of Discipline) see everything.
- Supervisors see general behaviour but **not** sensitive-flagged entries.
- Parents see only entries attached to their own child.
- Students see only their own non-sensitive entries.
- Clubs Admin has no behavioural visibility.

A single enforcement layer is fragile: any tRPC procedure that forgets to
call the RBAC guard would leak. We want belt-and-braces.

## Decision

Enforce visibility at **two independent walls**:

1. **Application (RBAC) wall** — `packages/domain/src/rbac.ts` exports
   `requireCanViewSensitive`, `requireOwnChild`, `requireSelfStudent`, etc.
   Every tRPC procedure that touches sensitive data calls one of these
   guards and scopes queries by `studentId` / `parentId`.
2. **Database (RLS) wall** — `packages/db/prisma/rls.sql` attaches row-level
   security policies to `BehaviourEntry` (and later `Report`, `Message`)
   keyed off Postgres session variables `app.user_id`, `app.user_role`,
   `app.full_admin`. The tRPC context sets these per request before running
   any query.

If a developer forgets the RBAC call, the RLS policy still blocks the row.
If the session vars aren't set, RLS denies by default.

## Consequences

- **Positive:** A single point of failure in app code cannot leak sensitive
  entries. RLS policies are auditable as SQL. Trial accounts of pen-testers
  cannot exfiltrate even with a forged query.
- **Negative:** Every request must set session vars — forgetting this is a
  hard failure (policies deny), not a silent one, which is the right
  tradeoff. Some batch/maintenance queries must bypass RLS via a service
  role; those scripts are tightly scoped and logged.
- **Reversible?** Policies can be dropped without data migration. The RBAC
  wall remains and still enforces.
