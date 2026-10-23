# Verification before commits

Before every commit, run the CI-equivalent checks from the repository root:

```sh
pnpm lint
pnpm typecheck
pnpm test
```

Do not create or push a commit while any of these checks fail. If a failure is unrelated to the current change, report it and resolve it before committing unless the user explicitly directs otherwise.

# Event-driven updates

Use authenticated subscriptions and committed-change events for application updates. Never add interval queries or repeated state-discovery reads. Reads must continue through existing tRPC authorization and database RLS; notifications do not grant access.

Every new persisted data source and query area must be classified in the realtime coverage manifest, including authorized audiences, dependent dashboards, and clock-driven refresh boundaries. Reconcile snapshots after subscription, reconnect, and foreground return. Batch notifications, tolerate duplicates, and clean up subscriptions on account changes and shutdown.

`pnpm lint` checks polling constructs. Permitted clocks and usage heartbeats are narrowly identified in `scripts/event-architecture.mjs`; new exceptions require a documented purpose and request budget. Due-date jobs and bounded transport retries are not state-discovery polling. See `docs/event-driven-updates.md` for architecture, configuration, exceptions, and verification.
