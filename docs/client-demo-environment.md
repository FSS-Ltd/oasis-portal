# Client Demo Environment

Use an isolated demo environment when giving external clients access to Oasis Portal. Do not seed client-demo users into the live `public` schema or the live Clerk application.

## Isolation Model

- Database: use a dedicated demo Supabase project or branch created without production data. The current Prisma migrations contain historical `public.` references, so a separate schema inside the live production database is not enough.
- Auth: use a separate Clerk application and its own `CLERK_SECRET_KEY` / publishable key.
- Hosting: use a demo Vercel project or deployment alias whose `APP_URL` contains `demo`.

This keeps demo Clerk identities from resolving in the live portal, and keeps live users from resolving against demo data.

## Supabase Branch Setup

Create the demo Supabase branch without production data, then apply the current Prisma schema and the RLS source of truth from `packages/db/prisma/rls.sql`. After the schema is in place, revoke Supabase Data API table access for public client roles; the portal runtime should use the dedicated Postgres `oasis_app` role instead.

```sql
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON SCHEMA public FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated;
```

Before seeding, Supabase security advisors should show no external-facing security lints for the demo branch.

Create the app runtime role on the demo branch and grant table access, then set a secret password outside source control:

```sql
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'oasis_app') THEN
    CREATE ROLE oasis_app LOGIN NOBYPASSRLS;
  ELSE
    ALTER ROLE oasis_app LOGIN NOBYPASSRLS;
  END IF;
END
$$;

DO $$
BEGIN
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO oasis_app', current_database());
END
$$;

GRANT USAGE ON SCHEMA public TO oasis_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO oasis_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO oasis_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO oasis_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO oasis_app;

ALTER ROLE oasis_app PASSWORD '<generated-runtime-password>';
```

Use the `oasis_app` connection string for the demo app runtime `DATABASE_URL`. Keep `DIRECT_URL` as the owner connection string for migrations and for the seed reset.

## Seed Command

Run from the repository root after the dedicated demo database has been migrated with the normal Oasis Prisma schema and the demo Vercel environment points at that database:

```bash
pnpm --filter @oasis/api seed:client-demo
pnpm --filter @oasis/api verify:client-demo
```

Required environment variables:

```bash
APP_URL=https://client-demo.example.com
DATABASE_URL=postgresql://.../postgres
DIRECT_URL=postgresql://.../postgres
CLERK_SECRET_KEY=...
OASIS_MASTER_KEY=...
OASIS_MASTER_KEY_VERSION=1
OASIS_BIDX_PEPPER=...
OASIS_CLIENT_DEMO_SCHEMA=public
OASIS_CLIENT_DEMO_DATABASE_ISOLATION=dedicated-demo-database
OASIS_PRODUCTION_SUPABASE_REF=<live-production-supabase-ref>
OASIS_CLIENT_DEMO_EMAIL_DOMAIN=demo.example.com
OASIS_CLIENT_DEMO_PASSWORD=...
OASIS_CLIENT_DEMO_SEED_CONFIRMATION=reset-isolated-client-demo-database
OASIS_CLIENT_DEMO_CLERK_CONFIRMATION=isolated-client-demo-clerk
```

The seed resets only the already-validated demo database schema and excludes Prisma's `_prisma_migrations` table. It refuses non-demo app hosts, and it refuses the live Supabase project ref when targeting `public`.

The verifier is non-destructive. It checks the same demo runtime boundary, verifies all planned Clerk users exist with the expected role metadata, verifies no non-demo `User` or `Student` rows exist in the connected demo database, and checks the seeded feature coverage records.

## GitHub Actions Seed

The `.github/workflows/client-demo.yml` workflow runs the same seed and verifier from a manually dispatched workflow. Configure a GitHub environment named `Client Demo` with these environment secrets:

- `CLIENT_DEMO_DATABASE_URL` — runtime `oasis_app` connection string for the isolated demo database.
- `CLIENT_DEMO_DIRECT_URL` — owner connection string for reset and seed operations.
- `CLIENT_DEMO_CLERK_SECRET_KEY` — secret key for the isolated demo Clerk application.
- `CLIENT_DEMO_OASIS_MASTER_KEY`
- `CLIENT_DEMO_OASIS_MASTER_KEY_VERSION`
- `CLIENT_DEMO_OASIS_BIDX_PEPPER`
- `CLIENT_DEMO_PASSWORD`

When dispatching the workflow, provide the demo app URL, demo-only email domain, database schema, and the live production Supabase ref. The workflow still refuses to seed the production Supabase project and only runs when the explicit demo confirmation variables are present in the job environment.

## Seeded Accounts

- Head + parent: `head-parent@<demo-domain>`
- Parent: `parent@<demo-domain>`
- Pastor: `pastor@<demo-domain>`
- Supervisor: `supervisor@<demo-domain>`
- Shopkeeper: `shopkeeper@<demo-domain>`
- Clubs admin: `clubs-admin@<demo-domain>`
- Clubs lead: `clubs-lead@<demo-domain>`
- Students: `student@<demo-domain>`, `student-sibling@<demo-domain>`

All seeded records use synthetic `clientdemo_` identifiers and encrypted synthetic PII.
