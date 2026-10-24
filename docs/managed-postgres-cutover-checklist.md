# Managed Postgres cutover

Execution was authorized on 24 October 2026. This checklist records gates; an unchecked gate blocks cutover. Keep connection strings, recovery keys, source records and detailed database errors out of this document.

## Authoritative state and recovery

- Source: `oasis_prod`; destination: managed `postgres`, in the same Supabase project.
- Preserve every reviewed application table, including the legacy membership table and migration ledger. Never copy managed schemas or replace Storage objects.
- Keep source authoritative until the final freeze and snapshot. Do not distribute destination runtime credentials during validation.
- Store encrypted archives, manifests, canonical table digests, reviewed archive lists and receipts outside Git in a mode-0700 operator directory on encrypted storage. Files must be mode 0600.
- Backup keys live in macOS Keychain under a unique `oasis.managed-postgres-migration.*` service and account `oasis-migration`. Record the service name in the private receipt, never the key. Existing keys must never be overwritten.
- Recover the key in a fresh process, authenticate the complete archive, restore it and compare every table before scheduling the write freeze. A successful dump alone is insufficient.
- Retain the encrypted archive and intact frozen source for at least 30 days. Record custody and recovery instructions with the receipts. Do not delete either as part of deployment or worktree cleanup.

## Before maintenance

- [ ] Review current source/target identities, object definitions, permissions, external dependencies and completed migration history. Target application objects must be absent.
- [ ] Inspect the authenticated archive's schema and table of contents. Exclude schema recreation, schema comments, ACLs and source-only maintenance objects. Reject any entry absent from the manifest.
- [ ] Pass the encrypted restore drill, complete content/constraint/index/trigger-enabled validation, restricted-runtime tests and function-ownership tests.
- [ ] Run repository lint, typecheck, tests, changed-file formatting and relevant web/mobile builds.
- [ ] Prepare authenticated browser, PWA, native and private WebSocket checks before pausing production.
- [ ] Inventory active writers: web/API, old and preview deployments, mobile/PWA APIs, Clerk webhooks, administrative tools, GitHub scheduled reconciliation and all Vercel cron routes. Pause deployment automation during the window.
- [ ] Measure the window from the rehearsal. Confirm webhook failures remain retryable; never acknowledge writes that did not commit. Agreement email recovery remains a 15-minute, 100-candidate exception.

## Freeze and final copy

- [ ] Pause public API traffic, scheduled writers and administrative/configuration/deploy jobs, including private configuration and coverage writes. Public-table guards do not freeze private administrative tables. Keep operator reads available.
- [ ] Apply `managed-postgres-maintenance.sql` to the exact reviewed public-table list. Its atomic locks drain writers; unconditional ALWAYS statement triggers reject owner, replica-mode, no-op and TRUNCATE writes.
- [ ] Verify the database identity, exact table set, trigger shape and independently reviewed guard-function hash with `verifyMaintenanceFreeze`. Record the receipt.
- [ ] Take a new encrypted archive and content baseline while frozen. Do not reuse a warm snapshot as the authoritative final copy.
- [ ] Apply `managed-postgres-runtime.sql` before restore. Restore only approved entries through `restoreReviewedApplication`, with the pinned manifest and encrypted archive receipt. Owner is always `oasis_owner`.
- [ ] Restore pre-data, data, then post-data in separate fail-closed phases. Never use `--clean`, `--create` or superuser trigger-disabling shortcuts.
- [ ] Compare every table's canonical digest and exact count, schema definitions, enabled triggers, sequences, validated constraints/indexes and migration ledger. Require an empty notification accumulator.
- [ ] Transfer only manifest-approved SECURITY DEFINER functions to trusted `postgres`; retain private execution restrictions. Run the runtime privilege pass again.
- [ ] Review source versus canonical RLS differences before applying canonical policies. Install supported Realtime policies with `managed-postgres-realtime.sql`. Never alter managed table ownership or RLS settings.
- [ ] Verify explicit 2FA configuration and run hosted preflight, actual authenticated WebSocket delivery, rollback, duplicate/no-op, reconnect, revocation and recipient-isolation checks.

## Cutover and release

- [ ] Test a protected canary through `oasis_app NOBYPASSRLS`; preserve Clerk trust, all encryption keys, blind-index pepper, Storage paths and public service URLs.
- [ ] Verify representative authorized roles, server-rendered dashboards, edits/deletions, drafts, foreground recovery and idle application-read counts.
- [ ] Update Vercel production/preview runtime connections and GitHub production/preview secrets consistently. Administrative connections remain separate from runtime credentials.
- [ ] Require CI green on the exact PR head. Merge only after all migration gates pass.
- [ ] Open public destination writes and record the first accepted-write boundary. Resume jobs and retry queued webhooks using existing idempotency controls. Source must remain frozen.

## Failure boundary

Before any real destination write, keep the destination closed, verify the old deployment points to intact source, then explicitly apply `managed-postgres-unfreeze.sql` and replay queued work. Never remove a freeze merely because an operation timed out.

After any real destination write, switching URLs back would lose commits. Freeze writers and repair forward. Any reverse copy requires a fresh encrypted destination backup, complete reconciliation and a separately reviewed procedure. Do not infer recovery from the transient notification accumulator.

## Evidence recorded so far

- Metadata inventory: 132 application tables, 2,003 objects, no sequences.
- Freeze and recovery scope checks use explicit C collation so JSON table names and PostgreSQL catalog names compare consistently. A real PostgreSQL 17 ICU-default regression verifies freeze, blocked writes and unfreeze. CI runs the isolated migration safety suite on a loopback-only PostgreSQL 17 fixture.
- Consistent encrypted warm backup: 182,201 rows across all 132 tables.
- Keychain creation/read-back and fresh-process authentication/decryption passed.
- Full encrypted restore passed: every table count/content digest, schema object, enabled trigger and constraint matched. The 132 tables contained 182,201 rows. Restore phases took approximately 57 seconds locally.
- Nineteen reviewed SECURITY DEFINER functions transferred to the trusted owner locally. Canonical RLS definitions matched the source.
- Repository lint, typecheck, tests and changed-file formatting passed. Thirteen actual PostgreSQL permission, freeze and ownership integration cases passed, including installation as a non-superuser CREATEROLE administrator. The local iOS simulator build passed.
- Managed administrator role installation passed on the empty hosted target. The runtime has no superuser or RLS-bypass authority; no application data was copied. The first attempt rolled back completely after PostgreSQL rejected an unnecessary ADMIN grant; the corrected installer preserves PostgreSQL’s automatic creator grant.
- Restricted-runtime profile/account reads, role denial and RLS queries passed against the retained restore. An authenticated browser reached its server-rendered account route without page errors. Nullable account emails uncovered during these checks now have regression coverage.
- Browser and PWA account directories rendered against the retained restricted-runtime restore with zero repeated application-data reads over 35 seconds. PWA installation/service-worker/offline checks passed with isolated public configuration.
- Native password plus email MFA succeeded after correcting the local simulator artifact’s signing. The native account queries passed against the retained restore, with zero query starts over a five-second idle window. Native testing exposed a subscription render loop caused by Clerk Expo’s changing token callback; the provider now retains fresh callbacks without restarting a same-session subscription.
- Account-editor refreshes exposed draft loss on web and mobile. Rendered regressions verify draft preservation, untouched-field updates, account changes, save/cancel behavior and late callback isolation. Web explicitly declares the already-locked React test renderer for these tests.
- Additional rendered regressions cover profile and registration fields/rows, weekly/monthly and club availability, volunteer choices, compliance, charity goals, academic policy, and gap plans. Live snapshots preserve drafts; scope changes and late saves stay isolated. Dirty gap plans retain their original optimistic version.
- Hosted event delivery, reconnect/revocation/isolation and final client cutover checks remain pending. Local client tests do not prove hosted delivery.
- The user separately approved enabling Oasis’s Clerk Native API after native authentication reported it disabled. The saved setting was verified after reload.
- No source freeze, target copy, URL change or public write cutover has occurred.

The existing `db:integration` smoke truncates application tables. Run it only against disposable isolated fixtures, never source, destination or a retained restore. The dedicated `OASIS_MIGRATION_SECURITY_TEST=1 pnpm --filter @oasis/db test:managed-migration` runner pins loopback PostgreSQL 17 and requires an operator-created NOLOGIN fixture marker.
