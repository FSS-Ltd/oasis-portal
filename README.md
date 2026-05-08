# Oasis Learning Centre Platform

Bespoke centre management platform for Oasis Learning Centre (ACE homeschool
enrichment, UK). Web + native iOS/Android, role-scoped for Head / Principal /
Pastor / Head of Discipline / Clubs Admin / Supervisor / Parent / Student.

Built to the FSS quality bar defined in `BUILD.md` and `AGENTS.md`.

## What this is

One monorepo, one typed backend, three clients.

- `apps/web` — Next.js 15 App Router (Head, Principal, Pastor, HoD, ClubsAdmin, Supervisor, Parent)
- `apps/mobile` — Expo (iOS + Android) for Supervisor, Parent, Student
- `apps/api` — tRPC routers exposed as Next.js Route Handlers (shared by web + mobile)
- `packages/db` — Prisma schema, migrations, KMS envelope encryption extension
- `packages/domain` — pure TS business logic (RBAC, merit ledger, tithe, investment simulator, shop, leaderboard, clubs, reports)
- `packages/ui` — cross-platform components (Tamagui / react-native-web)
- `packages/config` — shared tsconfig and eslint preset

Design doc: `oasis-platform-plan.md`. ADRs: `docs/ADRs/`.

## Setup

Prereqs: Node 20+ (22 recommended), pnpm 10+, Postgres 15+ for local dev
(Docker recommended), an AWS account for KMS (use a local emulator in dev),
a Clerk account, EAS CLI for native builds.

```
pnpm install
cp .env.example .env.local           # fill in Clerk + Postgres + KMS keys
pnpm db:generate                     # prisma generate
pnpm db:migrate                      # prisma migrate dev
pnpm db:seed                         # seed subjects, test users
pnpm dev                             # runs web + api, mobile runs separately
pnpm dev:watch                       # nodemon wrapper for backend/shared restarts
```

Mobile:

```
pnpm --filter mobile start           # Expo dev server
pnpm --filter mobile ios             # iOS simulator
pnpm --filter mobile android         # Android emulator
```

## Running tests

```
pnpm test                            # unit (vitest) across all packages
pnpm test:integration                # Prisma + pg test-containers
pnpm test:e2e                        # Playwright (web)
pnpm --filter mobile test:e2e        # Maestro (mobile)
```

Quality gate (must pass before merge to `main`, per AGENTS.md §8.1):

```
pnpm lint && pnpm typecheck && pnpm test
```

## Architecture

See `oasis-platform-plan.md` for the full design doc and
`docs/ADRs/` for specific architecture decisions:

- 001 — Monorepo with Turborepo + pnpm workspaces
- 002 — Clerk for auth (2FA, org-based RBAC, UK/EU residency)
- 003 — Sensitive-visibility enforcement (tRPC guard + Postgres RLS)
- 004 — Merit ledger as append-only double-entry
- 005 — PII envelope encryption with AWS KMS

## Deployment

Web + API: Vercel (EU edge). Mobile: EAS Build + Submit.
Database: Supabase or Neon in `eu-west-2`. KMS: AWS `eu-west-2`.
See `docs/runbook.md` for incident response.

## Known limitations (v1)

Nice-to-have features listed in `oasis-platform-plan.md` under
"Out of scope for v1" are deliberately deferred.

## Contributing

One logical change per PR. PR template enforced. See `BUILD.md` §8–9.
