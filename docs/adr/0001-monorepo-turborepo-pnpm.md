# ADR 0001: Monorepo with Turborepo + pnpm workspaces

- **Status:** Accepted
- **Date:** 2026-04-23
- **Deciders:** Core engineering

## Context

The Oasis platform ships a Next.js 15 web app, an Expo (iOS + Android) mobile
app, a tRPC API, a Prisma data layer, a shared domain package (RBAC, merit
ledger, tithe, investment sim, shop, leaderboards, clubs, reports), and a
shared UI package. All of these need to share TypeScript types end-to-end —
in particular the tRPC `AppRouter` type must be resolvable by both web and
mobile at compile time, and the domain package must be the single source of
truth for business rules on both the API and the clients.

We considered three options:

1. **Polyrepo** — one repo per app/package, published to a private registry.
2. **Nx monorepo** — rich plugin ecosystem, heavier config, opinionated.
3. **Turborepo + pnpm workspaces** — thin task runner on top of pnpm's
   workspace protocol; type-sharing via `workspace:*`; remote cache available.

## Decision

Adopt **Turborepo + pnpm workspaces**.

- `pnpm-workspace.yaml` declares `apps/*` and `packages/*`.
- Cross-package imports use `workspace:*` semver.
- Turbo orchestrates `build`, `lint`, `typecheck`, `test` with dependency
  awareness and local cache.
- Shared TS config lives in `packages/config` + root `tsconfig.base.json`
  with `strict`, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`.

## Consequences

- **Positive:** Atomic cross-cutting changes (e.g. add a field to the ledger
  and update web/mobile consumers in one PR). Typed tRPC client with no
  codegen. Cheap local builds via Turbo cache.
- **Negative:** CI must install pnpm explicitly (corepack). Contributors need
  to understand workspace protocol. Some tooling (Expo/Metro) needs extra
  config to resolve workspace packages — handled in `apps/mobile/metro.config.js`.
- **Reversible?** Yes — packages can be extracted to their own repos later
  if the monorepo becomes unwieldy; the `workspace:*` protocol is a
  mechanical rewrite to published versions.
