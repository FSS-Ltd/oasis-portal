# Connection-pool timeout fix review

Investigated on 3 November 2026 against `127bf2b1cc4bb18aceb358164a295df93fc8318c`, then prepared for a pull request against the latest `main`. The fix releases transaction connections before push delivery and keeps homework disabled at the API boundary.

## Findings and retained fix

The notification persistence helpers called `sendPushToStudents` through the root Prisma client while their callers held an RLS transaction. With one connection, the transaction waits for push recipient lookup, which waits for the transaction's connection. Restoring the original helper reproduced a real PostgreSQL pool timeout with `connection_limit=1&pool_timeout=1`.

The supplied patch correctly separates persistence from push delivery. It also batches behaviour student/supervisor-scope reads and makes `behaviour.logManyForStudents` awards, ledger rows, audit records, and in-app notifications one atomic transaction. Push runs after commit in behaviour, club, shop, homework review, and announcements. Homework re-review retains its single award notification.

The supplied Sentry summary does not identify the request that held the connection. Reproducing this defect establishes a cause of pool starvation, but does not prove it caused that specific production event.

## Further hardening

- Persistence contexts now expose only encryption and the current user. A root query through that context becomes a TypeScript error.
- Push uses one five-second network deadline across every batch, response headers, and response bodies. Timeout aborts the request; timers are cleared on completion or failure. No automatic retry is introduced.
- Regression tests cover stalled headers/bodies, a shared deadline across batches, and timer cleanup.
- Five integration tests use real PostgreSQL 16, the actual behaviour and notification RLS policies, a non-owner/non-BYPASSRLS runtime role, and one Prisma connection. They verify committed records before push, rollback of all four persisted record types, connection availability while push networking is paused, student isolation, and removal of session authority when reusing the connection.
- The pool regression also checks failure events: best-effort push error handling must not conceal a swallowed pool timeout from the test.
- The existing `HOMEWORK_VISIBLE = false` flag now also blocks every `homework.*` tRPC procedure with a 404 before validation or resolver database access. Web routes, navigation, and mobile queries already respect this flag. HTTP tests cover all 13 procedures for both Head and Student roles; dormant workflow tests explicitly enable the flag only in their test module.

## Verification

Required checks from the worktree root:

- `pnpm lint`: passed across all packages.
- `pnpm typecheck`: passed across all packages.
- `pnpm test`: passed, 2,231 tests. Twenty unrelated database integration tests and the five opt-in pool tests were skipped.
- `OASIS_POOL_DB_TEST=1 pnpm --filter @oasis/api exec vitest run src/__tests__/notification-pool.integration.test.ts`: all five passed separately.
- Prettier checks for every changed file and `git diff --check`: passed.

The original helper failed the pool regression; the fixed helper passed. Unrelated database integration suites require their own opt-in fixtures and are skipped by the regular test command.

No production request replay or deployment test was performed. The API package has no build script; root type checking checks its consumers. No UI changes require browser verification.

## Re-run the pool tests

Requires Docker, `psql`, and installed workspace dependencies. Run from the repository root. Use a new dedicated fixture container; the test refuses an unmarked database and never reads application database URLs. The test installs the current Prisma schema and the policies under test, then resets fixture records between cases.

```sh
docker run --detach --name oasis-timeout-fixture \
  --publish 127.0.0.1:55443:5432 \
  --env POSTGRES_HOST_AUTH_METHOD=trust \
  --env POSTGRES_DB=oasis_pool_fixture postgres:16-alpine

# Once PostgreSQL accepts connections:
psql -X 'postgresql://postgres@127.0.0.1:55443/oasis_pool_fixture' \
  -v ON_ERROR_STOP=1 \
  -c "COMMENT ON DATABASE oasis_pool_fixture IS 'oasis-timeout-fixture-v1'"

OASIS_POOL_DB_TEST=1 pnpm --filter @oasis/api exec vitest run \
  src/__tests__/notification-pool.integration.test.ts

docker stop oasis-timeout-fixture
docker rm --volumes oasis-timeout-fixture
```

## Limits and follow-up risks

This removes the confirmed notification deadlock path. It cannot guarantee that unrelated workload or database outages never exhaust a pool. Pool sizes and transaction settings are unchanged; no schema migration, subscription, polling, paid service, or dependency was added.

The five-second budget bounds Expo networking, not database acquisition or the entire mutation. Guardian email preparation still repeats queries per award after commit. Other behaviour mutations retain their existing post-commit audit/notification persistence. Moving all delivery to a durable outbox and adding mutation idempotency would be separate changes with schema and delivery implications.

`homework.studentDue` still performs a root read inside `withRls` in dormant code. Public homework API access is now blocked while `HOMEWORK_VISIBLE` is false. Its known mutually recursive homework RLS policies require a separate fix and real database permission tests before switching to the transaction client and enabling homework again.

Committed responses can still be lost in transit. Inspect saved records before manually replaying an uncertain award; this patch does not add an idempotency key.

## Files changed

Production:

- `apps/api/src/routers/behaviour.ts`
- `apps/api/src/routers/club.ts`
- `apps/api/src/routers/homework.ts`
- `apps/api/src/routers/shop.ts`
- `apps/api/src/routers/studentNotification.ts`
- `apps/api/src/services/push-notifications.ts`
- `apps/api/src/services/student-notifications.ts`
- `apps/api/src/trpc.ts`

Tests:

- `apps/api/src/__tests__/behaviour.router.test.ts`
- `apps/api/src/__tests__/homework.router.test.ts`
- `apps/api/src/__tests__/homework-disabled.test.ts` (new)
- `apps/api/src/__tests__/pushNotification.test.ts`
- `apps/api/src/__tests__/studentNotification.router.test.ts`
- `apps/api/src/__tests__/student-notifications.test.ts` (new)
- `apps/api/src/__tests__/notification-pool.integration.test.ts` (new)

Documentation: this file.
