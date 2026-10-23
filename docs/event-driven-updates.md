# Event-driven application updates

Oasis uses private Supabase Broadcast notifications to invalidate authorized read models across web, native Expo, and the PWA. The database remains authoritative. Clients read through tRPC and existing RBAC/RLS; they never consume database records from notifications.

## Delivery and coverage

The `oasis.data_changed` event contains only a UUID `eventId`, typed query `areas`, and an ISO `occurredAt` timestamp. The private topic is `oasis:user:<Clerk user ID>`. Legacy messaging, community, and child-note events remain available for older clients.

The domain realtime coverage manifest classifies every Prisma model and all root router areas. Each model declares its dependent read areas and recipient class. Tests compare that manifest with the schema, root router, and migration configuration. New models and areas must be classified before CI passes.

Database triggers collect authorized old and new recipients within the writing transaction. A private accumulator deduplicates recipient/area pairs; its deferred trigger sends one combined notification per recipient and deletes the accumulated rows before commit. Committed accumulator rows are never retained. A rollback also rolls back the transport message. Notifications include no row contents or record IDs.

Recipient rules narrow by account, guardian, role, tag, assignment, and audience. Existing SELECT policies further restrict protected rows. Destructive changes capture old relationships before deletion. Deactivated accounts receive a profile-only control notification so existing clients can discard their caches. Subsequent domain notifications require an active account.

Application helpers and configuration live in `oasis_private`. Clients cannot call emission helpers or publish application events. Supabase owns the `realtime` schema; new migrations change only supported message policies there.

## Client lifecycle

Providers subscribe before their catch-up read. Initial subscription, reconnect, and foreground return refresh active snapshots, so offline changes do not depend on replay retention or a global event cursor. Events received during reads schedule another refresh. Pre-event mount reads settle before a fresh read starts.

The shared coordinator batches events for 100 milliseconds, ignores duplicate IDs within a bounded window, and permits one refresh at a time. Inactive caches become stale without eager requests; PDFs and exports remain on demand. Backgrounding, logout, account changes, and unmount remove subscriptions and timers. SDK reconnect attempts use bounded backoff. Authentication transport heartbeats and token renewal do not poll application data.

Authority changes refresh `health.me` before protected reads. Denial clears active observer snapshots as well as cached data, including previously downloaded PDFs. Role and relationship changes re-run read scopes and route guards. Disconnected providers show stale-state feedback and a manual retry action; they do not enable a polling fallback.

Web server-rendered routes register data dependencies and refresh only when an affected area changes. Local drafts remain separate from incoming read models. Parent account-link confirmation observes committed cache updates, with one timeout and a manual check rather than repeated queries.

London midnight and known expiry/due boundaries use one-shot deadline timers. These refresh time-derived results even when no row changes. Foreground catch-up handles suspended timers and timezone/DST transitions.

## Configuration and release

Web and mobile must use the same Supabase project as their API database. Mobile needs these browser-safe build values:

```text
EXPO_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

Never expose the service-role key. Clerk remains the authentication source; the Supabase project must trust that Clerk issuer. Native URL support comes from the existing Clerk/Expo polyfills.

Deploy the additive Realtime migrations before clients. Run migrations against the intended environment with an explicit `OASIS_ENFORCE_2FA` value. The database migration command applies the canonical RLS policies and synchronizes private Realtime authorization configuration. For an existing migrated environment, configure/check it explicitly:

```sh
node scripts/with-env.mjs pnpm --filter @oasis/db realtime:configure
node scripts/with-env.mjs pnpm --filter @oasis/db realtime:check
```

The configuration parser matches the API: trimmed, case-insensitive `true` enables enforcement. An absent setting is an error. Unconfigured database subscription policies deny access. The check command rejects a mismatch, and CI checks the pulled Vercel environment before deploying clients. SQL validates Clerk `fva` with the same numeric, non-negative checks as `hasCompletedTwoFactor`.

Use separate databases for environments with different enforcement settings. Check the target connection before configuring it. To change enforcement, synchronize the intended database setting and deployment environment together. Previous clients can still consume their legacy notifications; rolling back a client does not require removing additive database objects.

No production migration, deployment, or paid service is part of local implementation verification.

## Allowed scheduled activity

- Usage heartbeats record activity and enforce usage limits. They are writes with a business purpose. Meaningful usage-minute changes notify authorized adult viewers without refreshing the student's own heartbeat gate.
- Sign-out countdowns and UI clocks do not discover database state.
- Known calendar/expiry deadlines schedule their next specific boundary. Transport retries are bounded reconnect or failed-request recovery.
- Existing scheduled price ingestion remains the source of external market data. Clients update when ingestion commits a snapshot; there is no continuous market-feed integration.
- Existing interest, reminder, and timetable jobs execute due business work.
- Agreement emails send immediately after the request mutation. The recovery cron runs every 15 minutes, selects at most 100 due queued/failed candidates, uses existing claims and idempotency keys, and caps attempts at eight. This bounded retry/recovery exception is not the ordinary delivery path. Lease-only updates do not wake clients; visible delivery status changes do.
- Audit notifications cover the actions/entities displayed by the inspection audit query. Decryption-read audit entries do not trigger an audit-read feedback loop.

`pnpm lint` runs an AST guard against interval query options, unapproved interval timers, loop-contained confirmation reads, and self-scheduling refresh loops. New exceptions must identify an exact purpose, location, and request budget. The guard complements review; arbitrary indirection must not be used to bypass the standard.

## Verification

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm --filter @oasis/web build
pnpm --filter @oasis/mobile build:web
```

Database integration requires a dedicated, migrated test database, never the normal app connection:

```sh
OASIS_REALTIME_TEST_DATABASE_URL='<dedicated test URL>' pnpm --filter @oasis/db test:realtime
```

This verifies commit/rollback, batching, no-op suppression, actual SELECT policies, guardian/staff/student isolation, revocation, 2FA, visible operational statuses, and accumulator cleanup. A transport stub is allowed only on localhost. It verifies database delivery semantics, not a hosted WebSocket connection.

The web `realtime-updates` Playwright scenario requires explicit `E2E_REALTIME=1`, a local `E2E_BASE_URL`, dedicated `E2E_REALTIME_TEST_DATABASE_URL` equal to that app's `DATABASE_URL`, and Head test credentials. It exercises two browser contexts, remote changes, reconnect, draft preservation, and idle request counts. The PWA `realtime-subscription` scenario requires `OASIS_REALTIME_TEST_STORAGE_STATE`, a saved dedicated-test Clerk session. Native device verification additionally requires a configured simulator/device and test login. Skipped credentialed scenarios are not evidence of live delivery.

After startup and settled events, idle clients must issue zero recurring application-data reads. Count legitimate usage writes, authentication renewal, and transport heartbeats separately. Release verification must include hosted Supabase WebSocket delivery, permission removal while connected, reconnect catch-up, both clients, and cleanup.
