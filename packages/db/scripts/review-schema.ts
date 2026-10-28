/**
 * Creates or updates the app store review tenant: a `review` schema in the same database as `public`.
 * See docs/app-review-tenant.md.
 *
 * Tables come from schema.prisma via `prisma db push`, because historical migrations hardcode
 * `public.` and cannot be replayed into another schema. RLS comes from rls.sql. Nothing here touches
 * `public`: every statement runs on a connection whose current_schema() is checked to be `review`.
 */
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { REVIEW_SCHEMA, reviewDatabaseUrl } from '../src/database-url.js';
import { splitSqlStatements } from './apply-rls.js';

const here = dirname(fileURLToPath(import.meta.url));
const prismaDir = join(here, '..', 'prisma');

// Copy of the SECURITY DEFINER helper from migration 20261028090000, bound to the review tables.
const PERMISSION_SLIP_HELPER = `
CREATE OR REPLACE FUNCTION review.oasis_guardian_can_see_permission_slip(slip_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = review
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM review."PermissionSlipRecipient" psr
    JOIN review."Guardian" g ON g."studentId" = psr."studentId"
    WHERE psr."slipId" = slip_id
      AND g."userId" = current_setting('app.user_id', true)
  )
$$`;

const GRANTS = `
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'oasis_app') THEN
    GRANT USAGE ON SCHEMA review TO oasis_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA review TO oasis_app;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA review TO oasis_app;
    GRANT EXECUTE ON FUNCTION review.oasis_guardian_can_see_permission_slip(TEXT) TO oasis_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON SCHEMA review FROM anon, authenticated;
    REVOKE ALL ON ALL TABLES IN SCHEMA review FROM anon, authenticated;
  END IF;
END
$$`;

/** rls.sql adapted to the review schema. Throws if it gains a `public.` reference we do not map. */
export function reviewRlsStatements(rlsSql: string): string[] {
  const sql = rlsSql.replaceAll(
    'public.oasis_guardian_can_see_permission_slip(',
    'review.oasis_guardian_can_see_permission_slip(',
  );
  if (/\bpublic\./u.test(sql)) {
    throw new Error('rls.sql references public.* objects; map them in review-schema.ts first.');
  }
  return splitSqlStatements(sql);
}

async function main(): Promise<void> {
  const ownerUrl = process.env['DIRECT_URL'] ?? process.env['DATABASE_URL'];
  if (!ownerUrl) throw new Error('DIRECT_URL or DATABASE_URL is required.');
  const reviewUrl = reviewDatabaseUrl(ownerUrl);

  const owner = new PrismaClient({ datasources: { db: { url: ownerUrl } } });
  try {
    // --recreate rebuilds the sandbox when a schema change cannot be pushed in place. The
    // identifier is the hardcoded constant, never input, so this can only ever drop `review`.
    if (process.argv.includes('--recreate')) {
      await owner.$executeRawUnsafe(`DROP SCHEMA IF EXISTS ${REVIEW_SCHEMA} CASCADE`);
    }
    await owner.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS ${REVIEW_SCHEMA}`);
  } finally {
    await owner.$disconnect();
  }

  // --accept-data-loss is scoped to the review schema by the URL; the sandbox is reseeded anyway.
  execFileSync('pnpm', ['exec', 'prisma', 'db', 'push', '--skip-generate', '--accept-data-loss'], {
    cwd: join(here, '..'),
    env: { ...process.env, DATABASE_URL: reviewUrl, DIRECT_URL: reviewUrl },
    stdio: 'inherit',
  });

  const review = new PrismaClient({ datasources: { db: { url: reviewUrl } } });
  try {
    const rows = await review.$queryRaw<{ schema: string }[]>`SELECT current_schema() AS schema`;
    if (rows[0]?.schema !== REVIEW_SCHEMA) {
      throw new Error(`Expected schema "${REVIEW_SCHEMA}", got "${String(rows[0]?.schema)}".`);
    }

    await review.$executeRawUnsafe(PERMISSION_SLIP_HELPER);
    const statements = reviewRlsStatements(await readFile(join(prismaDir, 'rls.sql'), 'utf8'));
    for (const statement of statements) await review.$executeRawUnsafe(statement);
    await review.$executeRawUnsafe(GRANTS);
    console.warn(`Review schema ready: ${String(statements.length)} RLS statements applied.`);
  } finally {
    await review.$disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
