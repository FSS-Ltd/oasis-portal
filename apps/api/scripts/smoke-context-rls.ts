/**
 * Integration smoke for `applyRlsTx` (the core of `createContext.withRls`).
 *
 * Mirrors `packages/db/scripts/smoke-rls.ts` but exercises the helper that
 * tRPC handlers use, proving full-admin sees Sensitive `BehaviourEntry` rows
 * while a Supervisor (and an anonymous context) do not.
 *
 * Requires a running Postgres reachable via `DATABASE_URL`, the migrations
 * applied, and the `oasis_app` runtime role (created by smoke-rls.ts on first
 * run; this script also provisions it idempotently).
 */
import { randomBytes } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import type { SessionUser } from '@oasis/domain';
import { blindIndex, encryptField } from '@oasis/db';
import { applyRlsTx } from '../src/context.js';

const owner = new PrismaClient();
const RUNTIME_ROLE = 'oasis_app';
const RUNTIME_PASSWORD = 'oasis_app_ci_password';

function ensureSmokeEncryptionEnv() {
  process.env['OASIS_MASTER_KEY'] ??= randomBytes(32).toString('base64');
  process.env['OASIS_MASTER_KEY_VERSION'] ??= '1';
  process.env['OASIS_BIDX_PEPPER'] ??= randomBytes(32).toString('hex');
}

function runtimeDatabaseUrl(): string {
  if (process.env['RLS_DATABASE_URL']) return process.env['RLS_DATABASE_URL'];
  const rawUrl = process.env['DATABASE_URL'];
  if (!rawUrl) throw new Error('Missing DATABASE_URL for RLS context smoke');
  const url = new URL(rawUrl);
  url.username = RUNTIME_ROLE;
  url.password = RUNTIME_PASSWORD;
  return url.toString();
}

async function ensureRuntimeRole() {
  if (process.env['RLS_DATABASE_URL']) return;
  await owner.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${RUNTIME_ROLE}') THEN
        CREATE ROLE ${RUNTIME_ROLE} LOGIN PASSWORD '${RUNTIME_PASSWORD}' NOBYPASSRLS;
      END IF;
    END
    $$;
  `);
  await owner.$executeRawUnsafe(
    `ALTER ROLE ${RUNTIME_ROLE} WITH LOGIN PASSWORD '${RUNTIME_PASSWORD}' NOBYPASSRLS`,
  );
  await owner.$executeRawUnsafe(`GRANT USAGE ON SCHEMA public TO ${RUNTIME_ROLE}`);
  await owner.$executeRawUnsafe(
    `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${RUNTIME_ROLE}`,
  );
  await owner.$executeRawUnsafe(`
    ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${RUNTIME_ROLE}
  `);
}

async function seed() {
  await owner.$executeRawUnsafe('TRUNCATE "User" CASCADE');
  await owner.$executeRaw`
    INSERT INTO "User" ("id", "clerkId", "role", "tags", "fullNameEnc", "emailEnc", "emailBidx", "updatedAt")
    VALUES
      (
        'ctx-head', 'ctx-head-clerk', 'Head'::"Role", ARRAY[]::TEXT[],
        ${encryptField('Context Head')}, ${encryptField('ctx-head@example.test')},
        ${blindIndex('ctx-head@example.test')}, NOW()
      ),
      (
        'ctx-sup', 'ctx-sup-clerk', 'Supervisor'::"Role", ARRAY[]::TEXT[],
        ${encryptField('Context Supervisor')}, ${encryptField('ctx-sup@example.test')},
        ${blindIndex('ctx-sup@example.test')}, NOW()
      )
  `;
  await owner.$executeRaw`
    INSERT INTO "Student" ("id", "fullNameEnc", "nameBidx", "dobEnc", "yearGroup", "enrolmentDate", "updatedAt")
    VALUES (
      'ctx-student', ${encryptField('Context Student')}, ${blindIndex('Context Student')},
      ${encryptField('2015-01-01')}, 'Y5', NOW(), NOW()
    )
  `;
  await owner.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.user_id', 'ctx-head', true)`;
    await tx.$executeRaw`SELECT set_config('app.user_role', 'Head', true)`;
    await tx.$executeRaw`SELECT set_config('app.full_admin', 'true', true)`;
    await tx.$executeRaw`
      INSERT INTO "BehaviourEntry" ("id", "studentId", "type", "category", "visibility", "meritDelta", "recordedById")
      VALUES
        ('ctx-b-general',   'ctx-student', 'Merit'::"BehaviourType",   'Kindness',     'General'::"BehaviourVisibility",   5,  'ctx-head'),
        ('ctx-b-sensitive', 'ctx-student', 'Demerit'::"BehaviourType", 'Safeguarding', 'Sensitive'::"BehaviourVisibility", -5, 'ctx-head')
    `;
  });
}

const head: SessionUser = { id: 'ctx-head', role: 'Head', tags: [], requires2fa: false };
const supervisor: SessionUser = {
  id: 'ctx-sup',
  role: 'Supervisor',
  tags: [],
  requires2fa: false,
};

async function main() {
  const runtime = new PrismaClient({ datasources: { db: { url: runtimeDatabaseUrl() } } });
  try {
    ensureSmokeEncryptionEnv();
    await ensureRuntimeRole();
    await seed();

    const headRows = await applyRlsTx(runtime, head, (tx) =>
      tx.behaviourEntry.findMany({ select: { id: true, visibility: true } }),
    );
    const supRows = await applyRlsTx(runtime, supervisor, (tx) =>
      tx.behaviourEntry.findMany({ select: { id: true, visibility: true } }),
    );
    const anonRows = await applyRlsTx(runtime, null, (tx) =>
      tx.behaviourEntry.findMany({ select: { id: true } }),
    );

    if (headRows.length !== 2) {
      throw new Error(`Expected Head to see 2 entries, saw ${String(headRows.length)}`);
    }
    if (supRows.length !== 1 || supRows[0]?.visibility !== 'General') {
      throw new Error(
        `Expected Supervisor to see 1 General entry, saw ${JSON.stringify(supRows)}`,
      );
    }
    if (anonRows.length !== 0) {
      throw new Error(`Expected anonymous context to see 0 entries, saw ${String(anonRows.length)}`);
    }

    console.warn(
      'Context RLS smoke passed: Head=2, Supervisor=1 (General), anonymous=0.',
    );
  } finally {
    await runtime.$disconnect();
    await owner.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
