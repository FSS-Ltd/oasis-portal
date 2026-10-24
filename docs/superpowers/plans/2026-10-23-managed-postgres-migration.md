# Managed Postgres Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move Oasis application objects and records from `oasis_prod` into the existing Supabase-managed `postgres` database, preserving records and access boundaries while enabling private committed-change broadcasts.

**Architecture:** Use a rehearsed, maintenance-window logical copy within the existing Supabase project. Copy only reviewed application objects; preserve Supabase-managed schemas, Storage objects, Clerk identities, and encryption material. Keep writes closed until content, permissions, and actual WebSocket delivery pass validation.

**Tech Stack:** PostgreSQL 17, existing Prisma/TypeScript tooling, PostgreSQL 17 dump/restore clients, Supabase Broadcast, Clerk, and existing web/Expo test runners.

**Spec:** User-approved migration planning in this chat; [event architecture](../../event-driven-updates.md), [PII encryption ADR](../../adr/0006-pii-envelope-encryption-env-key.md), and [operational runbook](../../runbook.md).

**Status:** Execution authorized by the user on 24 October 2026, including verified backups, safe migration, CI rerun and merge only on green checks. Backup restoration, content validation, restricted runtime access and actual hosted delivery remain mandatory cutover gates. Source writes remain open until rehearsal passes; no cutover has occurred. Protected operator receipts record live progress separately from this plan.

## Global constraints

- Zero loss of accepted writes; no dual-writing, reseeding, new IDs, key rotation, or dropping `oasis_prod`.
- No new paid services or hosted test environments without explicit authorization.
- Preserve existing app behavior and authorization. Application notifications remain metadata-only.
- Do not create, alter, restore, or drop Supabase-managed schema objects. Supported policies on `realtime.messages` are the exception.
- No credentials, record contents, dumps, decrypted PII, signed URLs, or private keys in source control, chat, CI output, or ordinary logs.
- Backups require encryption and a proven restore path. Keep current and historical encryption keys and the blind-index pepper unchanged.
- Do not switch database URLs merely to make CI green. Freeze old deployments and all writers before copying the authoritative dataset.

## Verified starting point — 23 October 2026

Read-only catalog queries established:

| Item                             | Source `oasis_prod` | Target `postgres`             |
| -------------------------------- | ------------------- | ----------------------------- |
| Server                           | PostgreSQL 17.6     | PostgreSQL 17.6, same project |
| Public tables                    | 129                 | 0                             |
| Application `User` table         | Present             | Absent                        |
| Managed Broadcast table/function | Absent              | Present                       |
| Application public RLS policies  | 181                 | 0                             |
| Dedicated Oasis runtime role     | Absent              | Absent                        |

The 129 source tables comprise 127 Prisma models, legacy `TimetableAgeGroupMembership`, and `_prisma_migrations`. Preserve all 129, including the legacy table. Source database size was approximately 116 MiB; this includes indexes and overhead and is not a dump-size or downtime estimate.

Both current owner and configured app runtime connections resolve to `postgres`, a role with `BYPASSRLS`. This prevents treating a read-only session default or ordinary RLS as a sufficient write freeze. Provisioning and validating restricted runtime credentials is a cutover prerequisite.

The three event migrations are applied in the source. Its private configuration and Vercel preview/production explicitly use `OASIS_ENFORCE_2FA=false`. The source has 127 coverage entries and 252 active capture triggers; `LibraryEmailReminder` is the documented operational exclusion. The notification accumulator was empty.

Target managed Storage already holds `notice-attachments` (private, 4 objects) and `shop-item-photos` (public, 128 objects). These counts are baseline observations, not immutable assertions. Preserve these buckets, object keys, policies, and underlying files. No Storage object move is required within the same project.

Preview and production currently share the source connection. The approved encrypted `PREVIEW_DIRECT_URL` GitHub secret is configured. A fresh CI rerun now fails specifically on unavailable transport in `oasis_prod`; code checks and isolated transaction integration pass.

## Review focus

1. A webhook, cron, mobile client, or old deployment writes after the copy snapshot: the freeze must reject it without acknowledging lost work.
2. Imported public tables become visible through Supabase Data API defaults: anonymous/authenticated clients must never gain direct app-table access.
3. Migration history says a conditional migration ran, but its managed-service policies never existed: install the supported target policies explicitly.
4. Ciphertexts, signatures, balances, IDs, sequence state, or legacy records change during transfer: compare complete canonical content and relationships, not just counts.
5. A rollback after target writes restores an older source: prohibit a simple URL rollback once any real target write is accepted.

## Task 1: Build a read-only inventory and approval manifest

**Files:** Create `packages/db/scripts/managed-postgres-inventory.ts` and `packages/db/src/__tests__/managed-postgres-inventory.test.ts`.

**Interface:** `buildMigrationManifest(source, target): Promise<MigrationManifest>`. Define and version `MigrationManifest` in this module: source/target database names and server versions, project reference, reviewed object identities and definitions, table/sequence names, owners/ACLs, extensions, migration-history checksums, artifact hashes, and source Git commit. Never include connection strings or row contents. CLI has no mutation mode.

- [ ] Test refusal of identical source/target databases, wrong project, unexpected target public objects, missing legacy tables, and unclassified dependencies.
- [ ] Inventory all 129 tables and dependencies: enums, domains, sequences, constraints, indexes, views, functions, triggers, RLS, grants, and large objects if referenced. Re-read catalogs; the observations above are not a future whitelist.
- [ ] Separate application-owned `public`/`oasis_private` objects from managed `auth`, `storage`, `realtime`, `extensions`, `vault`, and other Supabase objects. Require review for any cross-schema dependency.
- [ ] Record historical conditional migration effects, required Storage configurations, Clerk third-party JWT trust, and current private/legacy subscription topics. Do not replay old migrations into managed schemas.
- [ ] Run `pnpm --filter @oasis/db exec vitest run src/__tests__/managed-postgres-inventory.test.ts`; require all rejection cases to pass and review the metadata-only manifest.

## Task 2: Implement protected backup, copy, and content validation

**Files:** Create `packages/db/scripts/managed-postgres-copy.ts`, `packages/db/scripts/managed-postgres-validation.ts`, `packages/db/src/__tests__/managed-postgres-copy.test.ts`, and `packages/db/src/__tests__/managed-postgres-validation.test.ts`.

**Interfaces:** `copyApplication(manifest, mode: 'rehearse' | 'cutover'): Promise<void>` and `validateApplicationCopy(source, target, manifest): Promise<ValidationReport>`. The report contains table counts, content-match booleans, schema/constraint/sequence results, and aggregate failures; no row values or identifiers.

- [ ] Test wrong-target refusal, altered manifest/hash, unexpected restore entries, partial encryption/dump/restore failure, row substitution with equal counts, changed ciphertext, and sequence state beyond the maximum existing ID.
- [ ] Use PostgreSQL 17 clients (17.7 is installed), TLS, private connection service/pass files, and restrictive artifact permissions. Never put credential-bearing URLs in process arguments.
- [ ] Stream a consistent custom-format application dump into authenticated encryption. Use the existing approved encrypted-backup pipeline, or install the free `age` operational CLI and verify recipient/decryption custody before use. Never write an unencrypted dump to ordinary disk. No application dependency is needed.
- [ ] Scope the archive to reviewed application objects in `public` and `oasis_private`, including `_prisma_migrations` and the legacy table. Inspect its table of contents and schema SQL; omit database/schema recreation, ownership, ACLs, managed extensions, and managed-schema objects. Fail on unreviewed entries.
- [ ] Restore approved pre-data, then data/sequence state, then post-data objects. Keep app triggers and foreign keys out of the data-load phase. Do not rely on `--disable-triggers` superuser behavior or use `--clean`/`--create` against the managed database.
- [ ] Validate every table with exact counts and a streamed, deterministic cryptographic digest over all canonical columns ordered by a stable unique key. Resolve any table without a stable unique key explicitly in the manifest. Compare IDs, all ciphertext bytes, agreement signatures, audit history, balances, relationship rows, migration history, and sequence `last_value`/`is_called` state. Emit only aggregate results.
- [ ] Prove restored constraints are validated, indexes valid, expected functions/triggers present, and no pending notification rows exist. Keep detailed errors in protected operator artifacts because COPY failures can contain record values.
- [ ] Perform and verify an encrypted-backup restore on an isolated target before approving a live cutover. Derive the maintenance window from this rehearsal, not from the source database size.

## Task 3: Install target permissions and managed-service integration

**Files:** Create reviewed operational SQL in `packages/db/sql/managed-postgres-runtime.sql` and `packages/db/sql/managed-postgres-realtime.sql`; add integration cases to `packages/db/scripts/realtime-privacy-checks.ts` and `packages/db/scripts/smoke-rls.ts`.

**Interface:** Operational SQL is explicitly target-scoped and transactionally applied after identity checks. It does not rewrite historical Prisma migration files or create a second migration history. Document hashes and installation results in the execution manifest.

- [ ] Before creating target application objects, disable automatic app-object grants to `anon`, `authenticated`, and `PUBLIC` through reviewed schema-scoped default privileges. Verify app-table reads and app-function execution are denied throughout restore, not just after it.
- [ ] Provision a dedicated `LOGIN NOBYPASSRLS` runtime role, separate from owner/migration credentials. Grant only required application schema/table/sequence/function privileges. Do not grant access to private configuration/emission helpers or managed schemas broadly.
- [ ] Diff source RLS against canonical `packages/db/prisma/rls.sql`; review differences rather than assuming the 181 live policies equal the current repository. Apply the reviewed canonical policies and test the app through its restricted runtime role.
- [ ] Install the private receive/isolation/no-publication policies from the reviewed event architecture on the actual managed `realtime.messages`. Restore the private JWT/2FA helper with explicit execution grants and secure search paths.
- [ ] Restore legacy channel compatibility through supported policies and private security-definer authorization helpers. Legacy community policy subqueries must not force granting direct app-table reads to authenticated clients.
- [ ] Regression-test a restored migration ledger whose historical managed-service policy blocks never executed: preflight must reject before the target installer, and pass only after the actual policies and configuration exist.
- [ ] Do not replay the historical `ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY` statements; managed Realtime tables already belong to Supabase. Do not clone a Realtime schema into `oasis_prod`.
- [ ] Verify existing Storage objects remain accessible only through their intended paths. Provision any separately approved missing bucket configuration through supported Storage tooling; never replace managed Storage tables from a dump.
- [ ] Run `realtime:configure` and `realtime:preflight` against the target with the approved explicit 2FA setting. Test anonymous access, spoofed publication, guardian/assignment isolation, revoked users, and 2FA on a real private WebSocket channel.

## Task 4: Rehearse the write freeze and rollback boundary

**Files:** Create `packages/db/sql/managed-postgres-maintenance.sql`, `packages/db/scripts/managed-postgres-maintenance-checks.ts`, `packages/db/scripts/test-managed-postgres-migration.ts`, and `docs/managed-postgres-cutover-checklist.md`. Add a `test:managed-migration` command to `packages/db/package.json` for the dedicated integration runner.

**Interface:** The approved source table manifest is the freeze scope. Application-owned statement triggers reject INSERT/UPDATE/DELETE/TRUNCATE with a retryable maintenance error. They reject writes even from the currently configured owner connection. All guard definitions and removal SQL must be reviewed and tested before installation.

- [ ] Enumerate API mutations, direct Prisma calls, administrative sessions, old Vercel deployments, preview deployments, mobile/PWA clients, Clerk webhooks, agreement delivery, ingestion, reminder jobs, and scheduled business writes.
- [ ] Prove the freeze rejects writes from each writer class and the existing owner connection, including a transaction opened before freeze. Drain or terminate in-flight writer transactions before taking the authoritative snapshot. Do not rely on an application banner, RLS, or a session read-only default alone.
- [ ] Block app access with a maintenance response and pause scheduled writers/deployments. Webhooks must receive retryable failures or enter an existing durable queue; never acknowledge an unpersisted event. Record replay/idempotency instructions before pausing providers.
- [ ] Block DDL/deploy automation and coordinate administrative access while freeze triggers are installed. Keep an authenticated operator read connection for backup/validation. Exclude source maintenance-guard definitions from the target restore allowlist. Keep target public writers closed through maintenance routing and withheld runtime credentials until validation and the final go/no-go.
- [ ] Rehearse failure before restore, during restore, before URL cutover, after read-only canary, and after a simulated first accepted target write. Validate the recovery decision for each point.
- [ ] Run `pnpm --filter @oasis/db test:managed-migration` only against two explicitly isolated fixture databases. The runner must refuse equal databases, production endpoints, missing test markers, and missing write opt-in before creating fixtures. Require all freeze, restore, denial, and rollback-boundary cases to pass.

## Task 5: Execute the separately approved maintenance window

**Files:** Update the operator checklist with approved artifact hashes, the freeze receipt, measured checkpoints, and final validation reports. Do not store secrets or dumps in the repository.

- [ ] Obtain approval for the exact source/target manifest, backup retention/location/key custody, measured maintenance window, runtime-role change, and cutover/rollback procedure. Confirm a usable project backup/PITR recovery path; do not assume the runbook statement proves one exists.
- [ ] Install and verify the source write freeze, stop new jobs/deployments, drain transactions, and confirm queued external work is recoverable. A failed freeze or unknown writer cancels the cutover.
- [ ] Take the final encrypted backup and content baseline while the source is frozen. Keep `oasis_prod` intact. Restore the reviewed application archive into the target without touching existing managed services.
- [ ] Install target policies/runtime privileges, validate the entire copy, and verify migration history has no failed/pending entries. A drift, content mismatch, or missing permission blocks URL changes.
- [ ] Build a protected canary using the target restricted runtime role and the unchanged Clerk/Supabase project, encryption keys, pepper, object paths, and 2FA setting. Restrict it to operator-approved accounts while public writers remain closed.
- [ ] Verify representative parent, student, staff, admin and agreement flows; committed changes across two web clients and PWA/native; rollback/no-op/duplicate behavior; deletions and unsaved drafts; reconnect/foreground catch-up; role revocation and isolation; token expiry; zero recurring idle data reads. Use approved synthetic fixtures and record their cleanup.
- [ ] Update Vercel runtime `DATABASE_URL` to the restricted target role and owner `DIRECT_URL` only for administrative tooling. Update existing GitHub production connection secrets and `PREVIEW_DIRECT_URL` consistently. Verify all active API deployments use the intended target; disable old writable endpoints. Mobile clients retain their API/Supabase URLs when those endpoints remain the same.
- [ ] Require CI code checks, hosted preflight, and preview validation to pass on the exact release commit before merge/release. Do not merge #458 while this preparation is incomplete. Record the go/no-go against the user’s execution authorization before accepting public target writes; any unmet verification gate blocks opening writes.
- [ ] Open target writes, record the first accepted write boundary, and then resume queues/jobs with existing idempotency protection. Keep source application writes frozen; do not allow split-brain operation.

## Task 6: Rollback, observation, and retention

- [ ] **Before any real target write:** keep target closed, restore the old app environment/deployment, verify it points at intact `oasis_prod`, remove the source freeze only after verification, and replay queued work exactly once.
- [ ] **After any real target write:** a URL switch back is prohibited because the source is stale. Freeze writers and prefer a forward repair. A reverse copy requires a new consistent encrypted target backup, full content reconciliation, a rehearsed reverse migration, and explicit approval. Never discard target commits or assume the notification accumulator is a change ledger.
- [ ] Verify accepted writes, webhook/job backlog, channel errors, authorization denials, database load, and idle request behavior through bounded release observations. Include London-midnight/expiry checks and actual mobile background recovery before sign-off.
- [ ] Preserve the source and encrypted backups for an agreed retention period, verify restore access, then request a separate archival/decommission decision. No automatic database deletion or removal of historical keys.

## Exit criteria and current blockers

The user authorized implementation and safe execution on 24 October 2026, followed by CI and merge only on green checks. Implementation and the encrypted local restore drill are complete; live cutover remains gated by hosted verification.

Cutover additionally requires implemented/reviewed tooling, encrypted backup/restore proof, the verified isolated restore drill plus private hosted Realtime and Clerk verification, runtime-role/isolation evidence, a proven all-writer freeze, agreed retention and maintenance window, hosted cross-client and native test evidence, and explicit execution approval. No new test project or paid backup feature has been provisioned.

Existing checks to retain: `pnpm lint`, `pnpm typecheck`, `pnpm test`, changed-file formatting, web/PWA builds, database integration, and credentialed browser/native tests. Plans and test stubs do not count as executed migration or hosted-delivery evidence.

## Technical references

- [PostgreSQL 17 pg_dump](https://www.postgresql.org/docs/17/app-pgdump.html): consistent single-database dumps; subset dumps need dependency review.
- [PostgreSQL 17 pg_restore](https://www.postgresql.org/docs/17/app-pgrestore.html): reviewed archive selection and phased restoration; restores execute source-defined SQL.
- [Supabase managed-schema restrictions](https://supabase.com/changelog/realtime-schema-locked-down-against-modification): supported `realtime.messages` policies remain available; managed objects must not be altered.
- [Supabase Broadcast architecture](https://supabase.com/docs/guides/realtime/architecture): database broadcasts depend on the managed transport table and WAL.
- [age encryption](https://github.com/FiloSottile/age): optional free operational tool for encrypting streamed backup artifacts.
