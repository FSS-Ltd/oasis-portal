import { randomBytes } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { blindIndex, encryptField } from '../src/encryption.js';

function prismaWithOptionalUrl(url: string | undefined): PrismaClient {
  return url
    ? new PrismaClient({
        datasources: {
          db: { url },
        },
      })
    : new PrismaClient();
}

const prisma = prismaWithOptionalUrl(process.env['DIRECT_URL'] ?? process.env['DATABASE_URL']);
const RUNTIME_ROLE = 'oasis_app';
const RUNTIME_PASSWORD = 'oasis_app_ci_password';

type CountRow = { count: bigint };

function assertVisibleBehaviourCount({
  actual,
  expected,
  label,
}: {
  actual: number;
  expected: number;
  label: string;
}) {
  if (actual !== expected) {
    throw new Error(`Expected ${label} to see ${String(expected)} rows, saw ${String(actual)}`);
  }
}

function ensureSmokeEncryptionEnv() {
  process.env['OASIS_MASTER_KEY'] ??= randomBytes(32).toString('base64');
  process.env['OASIS_MASTER_KEY_VERSION'] ??= '1';
  process.env['OASIS_BIDX_PEPPER'] ??= randomBytes(32).toString('hex');
}

function runtimeDatabaseUrl(): string {
  if (process.env['RLS_DATABASE_URL']) return process.env['RLS_DATABASE_URL'];
  const rawUrl = process.env['DATABASE_URL'] ?? process.env['DIRECT_URL'];
  if (!rawUrl) throw new Error('Missing DATABASE_URL or DIRECT_URL for RLS smoke test');

  const url = new URL(rawUrl);
  if (url.username === RUNTIME_ROLE) return url.toString();

  url.username = RUNTIME_ROLE;
  url.password = RUNTIME_PASSWORD;
  return url.toString();
}

async function prepareRuntimeRole() {
  if (process.env['RLS_DATABASE_URL']) return;

  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${RUNTIME_ROLE}') THEN
        CREATE ROLE ${RUNTIME_ROLE} LOGIN PASSWORD '${RUNTIME_PASSWORD}' NOBYPASSRLS;
      END IF;
    END
    $$;
  `);
  await prisma.$executeRawUnsafe(`GRANT USAGE ON SCHEMA public TO ${RUNTIME_ROLE}`);
  await prisma.$executeRawUnsafe(
    `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${RUNTIME_ROLE}`,
  );
  await prisma.$executeRawUnsafe(`
    ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${RUNTIME_ROLE}
  `);
}

async function countVisibleBehaviour(
  client: PrismaClient,
  userId: string,
  role: string,
  fullAdmin: boolean,
  visibility: string,
) {
  const rows = await client.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.user_id', ${userId}, true)`;
    await tx.$executeRaw`SELECT set_config('app.user_role', ${role}, true)`;
    await tx.$executeRaw`SELECT set_config('app.full_admin', ${String(fullAdmin)}, true)`;

    return tx.$queryRaw<CountRow[]>`
      SELECT COUNT(*)::bigint AS count
      FROM "BehaviourEntry"
      WHERE "visibility" = ${visibility}::"BehaviourVisibility"
    `;
  });

  return Number(rows[0]?.count ?? 0n);
}

async function main() {
  const runtimePrisma = new PrismaClient({
    datasources: {
      db: {
        url: runtimeDatabaseUrl(),
      },
    },
  });

  try {
    ensureSmokeEncryptionEnv();
    await prepareRuntimeRole();
    await prisma.$executeRawUnsafe('TRUNCATE "User" CASCADE');

    await prisma.$executeRaw`
      INSERT INTO "User" (
        "id", "clerkId", "role", "tags", "fullNameEnc", "emailEnc", "emailBidx", "updatedAt"
      )
      VALUES
        (
          'ci-head', 'ci-head-clerk', 'Head'::"Role", ARRAY[]::TEXT[],
          ${encryptField('CI Head')}, ${encryptField('head@example.test')}, ${blindIndex('head@example.test')}, NOW()
        ),
        (
          'ci-hod', 'ci-hod-clerk', 'HeadOfDiscipline'::"Role", ARRAY[]::TEXT[],
          ${encryptField('CI HOD')}, ${encryptField('hod@example.test')}, ${blindIndex('hod@example.test')}, NOW()
        ),
        (
          'ci-principal', 'ci-principal-clerk', 'Principal'::"Role", ARRAY[]::TEXT[],
          ${encryptField('CI Principal')}, ${encryptField('principal@example.test')}, ${blindIndex('principal@example.test')}, NOW()
        ),
        (
          'ci-sup-author', 'ci-sup-author-clerk', 'Supervisor'::"Role", ARRAY[]::TEXT[],
          ${encryptField('CI Supervisor Author')}, ${encryptField('sup-author@example.test')}, ${blindIndex('sup-author@example.test')}, NOW()
        ),
        (
          'ci-sup-other', 'ci-sup-other-clerk', 'Supervisor'::"Role", ARRAY[]::TEXT[],
          ${encryptField('CI Supervisor Other')}, ${encryptField('sup-other@example.test')}, ${blindIndex('sup-other@example.test')}, NOW()
        )
    `;
    await prisma.$executeRaw`
      INSERT INTO "Student" (
        "id", "fullNameEnc", "nameBidx", "dobEnc", "yearGroup", "enrolmentDate", "updatedAt"
      )
      VALUES (
        'ci-student', ${encryptField('CI Student')}, ${blindIndex('CI Student')},
        ${encryptField('2015-01-01')}, 'Y5', NOW(), NOW()
      )
    `;

    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.user_id', 'ci-head', true)`;
      await tx.$executeRaw`SELECT set_config('app.user_role', 'Head', true)`;
      await tx.$executeRaw`SELECT set_config('app.full_admin', 'true', true)`;

      await tx.$executeRaw`
        INSERT INTO "BehaviourEntry" (
          "id", "studentId", "type", "category", "visibility", "meritDelta", "recordedById"
        )
        VALUES
          ('ci-behaviour-general', 'ci-student', 'Merit'::"BehaviourType", 'Kindness', 'General'::"BehaviourVisibility", 5, 'ci-head'),
          ('ci-behaviour-sensitive', 'ci-student', 'Demerit'::"BehaviourType", 'Safeguarding', 'Sensitive'::"BehaviourVisibility", -5, 'ci-sup-author'),
          ('ci-behaviour-sensitive-general', 'ci-student', 'General'::"BehaviourType", 'Misc', 'Sensitive'::"BehaviourVisibility", 0, 'ci-sup-author')
      `;
    });

    const fullAdminSensitive = await countVisibleBehaviour(
      runtimePrisma,
      'ci-head',
      'Head',
      true,
      'Sensitive',
    );
    const hodSensitive = await countVisibleBehaviour(
      runtimePrisma,
      'ci-hod',
      'HeadOfDiscipline',
      true,
      'Sensitive',
    );
    const principalSensitive = await countVisibleBehaviour(
      runtimePrisma,
      'ci-principal',
      'Principal',
      true,
      'Sensitive',
    );
    const authorSupervisorSensitive = await countVisibleBehaviour(
      runtimePrisma,
      'ci-sup-author',
      'Supervisor',
      false,
      'Sensitive',
    );
    const otherSupervisorSensitive = await countVisibleBehaviour(
      runtimePrisma,
      'ci-sup-other',
      'Supervisor',
      false,
      'Sensitive',
    );
    const supervisorGeneral = await countVisibleBehaviour(
      runtimePrisma,
      'ci-sup-other',
      'Supervisor',
      false,
      'General',
    );

    assertVisibleBehaviourCount({ actual: fullAdminSensitive, expected: 2, label: 'full admin' });
    assertVisibleBehaviourCount({ actual: hodSensitive, expected: 2, label: 'HOD' });
    assertVisibleBehaviourCount({ actual: principalSensitive, expected: 2, label: 'Principal' });
    assertVisibleBehaviourCount({
      actual: authorSupervisorSensitive,
      expected: 2,
      label: 'author supervisor',
    });
    assertVisibleBehaviourCount({
      actual: otherSupervisorSensitive,
      expected: 0,
      label: 'other supervisor',
    });
    assertVisibleBehaviourCount({ actual: supervisorGeneral, expected: 1, label: 'supervisor' });

    console.warn(
      'RLS smoke passed: full admins and author supervisor see Sensitive demerits and General marks; other supervisor does not.',
    );
  } finally {
    await runtimePrisma.$disconnect();
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
