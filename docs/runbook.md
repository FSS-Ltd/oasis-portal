# Oasis Portal Runbook

This runbook is the operator's reference for running, diagnosing, and
recovering the Oasis Learning Centre platform. It is intentionally terse —
each procedure is a script you can follow at 03:00 with minimal thinking.

## 1. Environments

| Env        | Web                     | API (same as web) | DB                  | Key source     | Clerk env |
| ---------- | ----------------------- | ----------------- | ------------------- | -------------- | --------- |
| local      | http://localhost:3000   | /api/trpc         | local Postgres      | env master key | test      |
| preview    | <vercel preview URL>    | /api/trpc         | Supabase preview DB | env master key | test      |
| production | https://portal.oasis... | /api/trpc         | Supabase Postgres   | env master key | live      |

All production data stores and auth services are pinned to UK/EU. The
application-level master key and blind-index pepper are stored only in the
hosting secret manager.

## 2. Local development

```bash
corepack enable
corepack prepare pnpm@10.0.0 --activate
pnpm install
pnpm --filter @oasis/db generate      # Prisma client
pnpm db:dev:setup                     # start Docker Postgres, migrate, seed
pnpm dev                              # turbo dev across apps
pnpm dev:watch                        # nodemon wrapper for backend/shared restarts
```

Local Docker provides two Postgres roles:

- `oasis` / `oasis` — database owner used through `DIRECT_URL` for migrations
  and RLS policy application.
- `oasis_app` / `oasis_app` — runtime role used through `DATABASE_URL` so local
  API requests exercise the same non-owner path as production.

Useful local DB commands:

```bash
pnpm db:dev:up       # start Postgres
pnpm db:dev:setup    # start + generate + migrate/RLS + seed ACE subjects
pnpm db:dev:logs     # follow Postgres logs
pnpm db:dev:down     # stop Postgres, keep volume
pnpm db:dev:reset    # delete local DB volume and recreate Postgres
```

First local Head user bootstrap:

1. Run the web app locally.
2. Expose it with `ngrok http 3000` or equivalent.
3. In Clerk test dashboard, point the webhook to
   `https://<ngrok-url>/api/clerk/webhook` for `user.created`, `user.updated`,
   and `user.deleted`.
4. Sign up once through `/sign-up`.
5. Promote that local DB user:

```bash
pnpm bootstrap:head -- --email=you@example.com
```

Required env vars (copy from `.env.example`):

- `DATABASE_URL` — runtime Postgres URL (local Docker:
  `postgresql://oasis_app:oasis_app@localhost:5432/oasis_dev`)
- `DIRECT_URL` — owner Postgres URL used by Prisma migrations (local Docker:
  `postgresql://oasis:oasis@localhost:5432/oasis_dev`)
- `NEXT_PUBLIC_SUPABASE_URL` — browser-safe Supabase project URL
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — browser-safe Supabase publishable key
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`
- `CLERK_WEBHOOK_SIGNING_SECRET`
- `OASIS_MASTER_KEY` — 32 random bytes, base64-encoded
- `OASIS_MASTER_KEY_VERSION` — current master-key version, usually `1`
- `OASIS_BIDX_PEPPER` — pepper for HMAC blind indexes

## 3. Supabase Postgres setup

Create the Supabase project in an EU region. Use the Supabase Postgres
connection strings for Prisma and the browser-safe Project URL / publishable
key for Supabase client features.

1. Create the project and copy both connection strings:
   - `DATABASE_URL` uses the pooled Supabase Postgres endpoint for app runtime.
   - `DIRECT_URL` uses the direct Supabase Postgres endpoint for Prisma migrations.
   - `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
     come from the Supabase API settings and are safe for browser code.
2. Run `pnpm db:generate`.
3. Run `pnpm db:migrate`. This runs `prisma migrate deploy` and then
   `packages/db/scripts/apply-rls.ts`.
4. Run `pnpm db:integration` against the same database. The smoke test proves
   Head/full-admin can read Sensitive behaviour rows and Supervisor cannot.
5. Create the runtime role and grant table access from the migration owner:

```sql
CREATE ROLE oasis_app LOGIN PASSWORD '<generated-password>' NOBYPASSRLS;
GRANT CONNECT ON DATABASE oasis TO oasis_app;
GRANT USAGE ON SCHEMA public TO oasis_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO oasis_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO oasis_app;
```

The app must connect as a non-superuser role without `BYPASSRLS` in production.
The tRPC context sets these transaction-local variables before protected reads:

- `app.user_id`
- `app.user_role`
- `app.full_admin`

Do not run the application with a database owner or superuser connection string.
Those roles can bypass the protection this platform relies on.

## 4. Deploy

- Web + API deploy as one Vercel project from `apps/web`. The Next.js app owns
  the `/api/trpc` route handler and Clerk webhook handlers, so there is no
  separate backend service to deploy for the current architecture.
- GitHub Actions is the release gate. Disable or ignore Vercel's built-in Git
  auto-deploys so production is not deployed twice.
- Pull requests from the same repository run the full CI gate and then create a
  Vercel preview deployment. Forked pull requests run checks only because they
  must not receive deployment secrets.
- Pushes to `main` run the full CI gate, run `pnpm db:migrate` against the
  production database, then run `vercel pull`, `vercel build --prod`, and
  `vercel deploy --prebuilt --prod --archive=tgz`.
- Roll back web code by promoting or rolling back to the previous Vercel
  production deployment. DO NOT `prisma migrate reset` in production.
- Mobile: EAS build per release tag, submitted to TestFlight / Play
  internal track for QA before store submission.

Required GitHub Actions secrets:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`
- `PROD_DATABASE_URL` — production runtime Postgres URL.
- `PROD_DIRECT_URL` — production owner/direct Postgres URL for migrations.

The CI workflow reads these from repository-level GitHub Actions secrets. Local
`.env` files and Vercel project runtime variables are not visible to GitHub
Actions. If `vercel pull` reports `No existing credentials found` during CI, the
most likely cause is a missing or empty `VERCEL_TOKEN` secret in GitHub.

Required Vercel project settings:

- Root Directory: `apps/web`.
- Production and preview runtime env vars configured with non-empty values in
  Vercel, including
  `DATABASE_URL`, `DIRECT_URL`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`,
  `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SIGNING_SECRET`,
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
  `OASIS_MASTER_KEY`, `OASIS_MASTER_KEY_VERSION`, `OASIS_BIDX_PEPPER`,
  `APP_URL`, `RESEND_API_KEY`, and `RESEND_FROM`.
  The web middleware reads `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` at runtime; using
  `CLERK_PUBLISHABLE_KEY` instead causes every request to fail with a Clerk
  missing publishable-key error. Vercel may still list an env var whose value is
  empty; the CI env validator treats empty values as invalid.
- If `DATABASE_URL` uses Supabase's transaction pooler on port `6543`, Prisma
  runtime traffic must use `pgbouncer=true` and `connection_limit=1`. The shared
  DB client adds those parameters defensively when they are missing, but keeping
  them in the Vercel value makes the runtime configuration explicit.
- Because GitHub Actions uses `vercel build` and `vercel deploy --prebuilt`,
  build-time public variables must be available through `vercel pull`.
  Vercel pulls Sensitive variables as empty strings, so keep
  `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, and
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` as non-sensitive project variables, or
  mirror them into GitHub Actions secrets and export them before `vercel build`.
- Any Vercel project variable needed during `@oasis/web#build` must also be
  declared in `turbo.json` under the `build` task's `env` or `passThroughEnv`
  list. Turborepo strict env mode otherwise strips it during Vercel builds.
- Supabase browser/server clients live in `apps/web/src/lib/supabase`. Clerk
  remains the authentication source; Supabase Auth middleware is not configured.

### 4.1 Transactional email deliverability

Oasis Portal sends transactional email through Resend. Keep this path boring:
authenticated domain, branded sender, low-volume transactional content, and
header checks after every DNS or sender change.

Required production sender:

```bash
APP_URL=https://www.oasisportal.space
RESEND_FROM="Oasis Portal <no-reply@oasisportal.space>"
```

`APP_URL` is used to build absolute URLs for email-safe public assets such as
the Oasis logo. If it is missing, templates omit the logo instead of sending a
broken image.

Required DNS state:

| Host                       | Type | Value / source                     | Purpose                        |
| -------------------------- | ---- | ---------------------------------- | ------------------------------ |
| `send.oasisportal.space`   | TXT  | Resend-provided SPF value          | Return-path SPF alignment      |
| `send.oasisportal.space`   | MX   | Resend-provided bounce/feedback MX | Return-path bounce handling    |
| `resend._domainkey...`     | TXT  | Resend-provided DKIM public key    | DKIM signing                   |
| `_dmarc.oasisportal.space` | TXT  | `v=DMARC1; p=none;`                | DMARC monitoring before policy |

After adding or changing records:

1. In Resend, confirm `oasisportal.space` is verified.
2. Run `pnpm --filter @oasis/api email:smoke` from an environment with the
   production Resend variables loaded.
3. Send one smoke email to Gmail and one to Outlook.
4. Inspect received headers. The expected result is `spf=pass`, `dkim=pass`,
   and `dmarc=pass`.
5. Register and monitor `oasisportal.space` in Google Postmaster Tools once
   volume is high enough for data to appear.

If a recipient reports junk placement:

1. Ask for the original message headers, not a screenshot.
2. Confirm SPF, DKIM, and DMARC pass in those headers.
3. Check Resend logs for bounce, complaint, suppression, or delivery delay
   events around the message id stored in `UserInvitation.emailMessageId`.
4. Confirm the recipient has not marked previous Oasis mail as junk.
5. If authentication passes but junking continues, keep DMARC at `p=none`,
   reduce test sends, and build reputation with normal transactional traffic
   before considering stricter DMARC policy.

## 5. Incident playbooks

### 5.1 Encryption key unavailable

**Symptom:** API procedures that read PII return 500; logs show missing or
wrong-length `OASIS_MASTER_KEY` / `OASIS_MASTER_KEY_V<n>`.

1. Confirm the affected environment has the expected master-key env vars.
2. Check whether a key rotation changed `OASIS_MASTER_KEY_VERSION` without
   keeping the previous key as `OASIS_MASTER_KEY_V<n>`.
3. If prolonged: put the API into read-only mode (feature flag
   `pii_readonly=true`) — non-PII endpoints (leaderboards using derived
   aggregates, health checks) keep working.
4. DO NOT fall back to plaintext writes. Ever.

### 5.2 Suspected PII leak / dump request

1. Treat as a security incident; notify DPO immediately.
2. Rotate the `OASIS_BIDX_PEPPER` — this invalidates all blind-index
   equality lookups until a re-index job completes, which is acceptable.
3. Rotate the master key if the incident indicates key compromise. Ciphertexts
   embed the key version, so old wrapped DEKs keep working while the previous
   key remains available as `OASIS_MASTER_KEY_V<n>`.
4. Audit `AuditLog` table for reads of affected records in the window.

### 5.3 Merit ledger imbalance

**Symptom:** reconciliation job reports a non-zero sum for some
`correlationId`, or a student balance query returns a negative number for
an account that should be non-negative.

1. `SELECT correlation_id, SUM(amount) FROM merit_ledger_entry GROUP BY
correlation_id HAVING SUM(amount) <> 0;` — list bad correlation ids.
2. For each: pull all rows, identify the missing leg. Common cause is a
   partially-committed transaction from a pre-tRPC-transaction-wrapper
   migration window.
3. Post a correcting entry with `reason='reconcile:<ticket>'` and the
   inverse legs that restore zero-sum. Never UPDATE or DELETE ledger rows.
4. File a post-mortem; identify the write path that bypassed
   `applyLedgerTxn()`.

### 5.4 Investment sim drift

**Symptom:** students report their investment account value changed when
nothing was bought/sold.

Expected: NAV ticks on a schedule (daily cron); account _value_ moves with
NAV even though units are unchanged. Not a bug. Communicate this in the
student-facing copy.

Unexpected: NAV series is non-deterministic for a given seed. Check the
seed storage — the seed must be persisted per student on their first buy
and never regenerated. If regenerated, you'll see a discontinuous NAV
history; the fix is to reseed from the first-buy timestamp and replay.

### 5.5 Clerk sign-in throttling / outage

1. Check https://status.clerk.com.
2. If Clerk is down: API rejects with UNAUTHORIZED (session verification
   fails). There is no graceful degradation — auth is a hard dependency.
   Communicate via status page.
3. For rate-limited users: Clerk dashboard → user → reset rate limit.

### 5.6 Clerk 2FA enforcement and recovery

2FA enforcement is currently feature-flagged off until the Clerk upgrade is
complete. To enable it, set `OASIS_ENFORCE_2FA=true` in the relevant preview or
production environment, then enable Clerk's dashboard MFA requirement. When the
flag is enabled, the portal checks the current session's second-factor
verification before allowing protected app routes or tRPC calls.

1. Dashboard check: Clerk → Configure → Authentication → Multi-factor
   authentication → Require multi-factor authentication.
2. Portal flag check: confirm `OASIS_ENFORCE_2FA=true` is present in the target
   deployment environment.
3. Preview smoke: sign in with a test user that has not completed second factor.
   Expected result: `/post-sign-in/resolve` sends the user to `/2fa`, and
   protected tRPC calls return `UNAUTHORIZED` with
   `two-factor authentication required`.
4. Completion smoke: complete the second factor, sign out, sign back in, and
   confirm role routing reaches the expected portal.
5. Locked-out user recovery: verify identity outside the portal, then Clerk
   dashboard → user → security → reset/remove the affected factor or generate a
   recovery path. Do not bypass Oasis RBAC or create replacement accounts unless
   Jean-Fidele approves it.
6. Incident note: record the user id, support actor, factor reset reason, and
   timestamp in the support log. Do not record recovery codes, raw tokens, or
   authenticator secrets.

## 6. Backups & recovery

- DB: Supabase point-in-time recovery window is configured per plan/environment.
  Nightly logical dump to S3 in `eu-west-2` (encrypted bucket, KMS-managed,
  30-day retention). Test restore drill: quarterly, documented in
  `docs/dr-drill-<date>.md`.
- Master key: stored in the hosting secret manager with strict access. A key
  loss = total PII loss; the key is the most sensitive operational secret.
- Blind-index pepper: stored beside the master key. Losing the pepper only
  breaks equality lookups (can rebuild by decrypting + rehashing during a
  maintenance window).

## 7. On-call checklist

Before going on-call, verify you have:

- [ ] Vercel access to preview and production environment variables.
- [ ] Supabase access to preview and production databases.
- [ ] Clerk admin access (SSO, 2FA required).
- [ ] Sentry access with alerting notifications enabled.
- [ ] This runbook bookmarked.
- [ ] The DPO and CTO phone numbers in your phone.
