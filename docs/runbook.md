# Oasis Portal Runbook

This runbook is the operator's reference for running, diagnosing, and
recovering the Oasis Learning Centre platform. It is intentionally terse —
each procedure is a script you can follow at 03:00 with minimal thinking.

## 1. Environments

| Env        | Web                      | API (same as web) | DB                      | KMS region | Clerk env |
|------------|--------------------------|-------------------|-------------------------|------------|-----------|
| local      | http://localhost:3000    | /api/trpc         | local Postgres          | n/a (stub) | test      |
| preview    | <vercel preview URL>     | /api/trpc         | Neon EU branch per PR   | eu-west-2  | test      |
| production | https://portal.oasis...  | /api/trpc         | Neon EU primary         | eu-west-2  | live      |

All production data (DB, object storage, KMS, Clerk) is pinned to UK/EU.

## 2. Local development

```bash
corepack enable
corepack prepare pnpm@10.0.0 --activate
pnpm install
pnpm --filter @oasis/db generate      # Prisma client
pnpm --filter @oasis/db migrate:dev   # apply migrations to local DB
pnpm dev                              # turbo dev across apps
```

Required env vars (copy from `.env.example` when it lands in Phase 1):

- `DATABASE_URL` — Postgres (local: `postgres://oasis:oasis@localhost:5432/oasis`)
- `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`
- `KMS_KEY_ID` — AWS KMS CMK ARN (local: dummy `alias/dev-stub`)
- `AWS_REGION=eu-west-2`
- `PII_BLIND_INDEX_PEPPER` — 32-byte base64 pepper (rotate separately from KMS)

## 3. Deploy

- Web: push to `main` → Vercel builds → auto-deploy to production.
- DB migrations: `pnpm --filter @oasis/db migrate:deploy` runs as part of
  the release pipeline **before** the new web build is promoted. Roll
  back = promote previous Vercel deployment; DO NOT `prisma migrate reset`
  in production.
- Mobile: EAS build per release tag, submitted to TestFlight / Play
  internal track for QA before store submission.

## 4. Incident playbooks

### 4.1 Encryption outage (KMS unreachable)

**Symptom:** API procedures that read PII return 500; logs show
`KMSInvalidStateException` or network timeout to `kms.eu-west-2.amazonaws.com`.

1. Confirm it's KMS and not Postgres: `curl https://kms.eu-west-2.amazonaws.com/`.
2. Check AWS Health Dashboard for regional KMS incidents.
3. Verify IAM policy on the app role hasn't been modified (CloudTrail).
4. If transient: the encryption helper has a retry-with-backoff. Leave it.
5. If prolonged: put the API into read-only mode (feature flag
   `pii_readonly=true`) — non-PII endpoints (leaderboards using derived
   aggregates, health checks) keep working.
6. DO NOT fall back to plaintext writes. Ever.

### 4.2 Suspected PII leak / dump request

1. Treat as a security incident; notify DPO immediately.
2. Rotate the `PII_BLIND_INDEX_PEPPER` — this invalidates all blind-index
   equality lookups until a re-index job completes, which is acceptable.
3. KMS CMK rotation is automatic annually; trigger a manual rotation if the
   incident indicates key compromise. Ciphertexts embed `kmsKeyId` so old
   wrapped DEKs keep working during the rotation window.
4. Audit `AuditLog` table for reads of affected records in the window.

### 4.3 Merit ledger imbalance

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

### 4.4 Investment sim drift

**Symptom:** students report their investment account value changed when
nothing was bought/sold.

Expected: NAV ticks on a schedule (daily cron); account _value_ moves with
NAV even though units are unchanged. Not a bug. Communicate this in the
student-facing copy.

Unexpected: NAV series is non-deterministic for a given seed. Check the
seed storage — the seed must be persisted per student on their first buy
and never regenerated. If regenerated, you'll see a discontinuous NAV
history; the fix is to reseed from the first-buy timestamp and replay.

### 4.5 Clerk sign-in throttling / outage

1. Check https://status.clerk.com.
2. If Clerk is down: API rejects with UNAUTHORIZED (session verification
   fails). There is no graceful degradation — auth is a hard dependency.
   Communicate via status page.
3. For rate-limited users: Clerk dashboard → user → reset rate limit.

## 5. Backups & recovery

- DB: Neon point-in-time restore window = 7 days (production).
  Nightly logical dump to S3 in `eu-west-2` (encrypted bucket, KMS-managed,
  30-day retention). Test restore drill: quarterly, documented in
  `docs/dr-drill-<date>.md`.
- KMS key: CMK is in a dedicated AWS account with MFA-delete on the key
  policy and a deletion window of 30 days. A key loss = total data loss;
  the key is the most valuable asset in the system.
- Blind-index pepper: stored in AWS Secrets Manager with cross-region
  replication. Losing the pepper only breaks equality lookups (can rebuild
  by decrypting + rehashing during a maintenance window).

## 6. On-call checklist

Before going on-call, verify you have:

- [ ] AWS SSO access to the Oasis production account (read-only by default,
      break-glass role for writes with MFA + CloudTrail).
- [ ] Clerk admin access (SSO, 2FA required).
- [ ] Sentry access with alerting notifications enabled.
- [ ] This runbook bookmarked.
- [ ] The DPO and CTO phone numbers in your phone.
