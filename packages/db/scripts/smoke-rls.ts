import { PrismaClient } from '@prisma/client';

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

function runtimeDatabaseUrl(): string {
  if (process.env['RLS_DATABASE_URL']) return process.env['RLS_DATABASE_URL'];
  const rawUrl = process.env['DATABASE_URL'] ?? process.env['DIRECT_URL'];
  if (!rawUrl) throw new Error('Missing DATABASE_URL or DIRECT_URL for RLS smoke test');

  const url = new URL(rawUrl);
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
  await prisma.$executeRawUnsafe(
    `ALTER ROLE ${RUNTIME_ROLE} WITH LOGIN PASSWORD '${RUNTIME_PASSWORD}' NOBYPASSRLS`,
  );
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
  role: string,
  fullAdmin: boolean,
  visibility: string,
) {
  const rows = await client.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.user_id', 'ci-user', true)`;
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
    await prepareRuntimeRole();
    await prisma.$executeRawUnsafe('TRUNCATE "User" CASCADE');

    await prisma.$executeRaw`
      INSERT INTO "User" (
        "id", "clerkId", "role", "tags", "fullNameEnc", "emailEnc", "emailBidx", "updatedAt"
      )
      VALUES (
        'ci-head', 'ci-head-clerk', 'Head'::"Role", ARRAY[]::TEXT[],
        'enc:head', 'enc:head@example.test', 'bidx-head', NOW()
      )
    `;
    await prisma.$executeRaw`
      INSERT INTO "Student" (
        "id", "fullNameEnc", "nameBidx", "dobEnc", "yearGroup", "enrolmentDate", "updatedAt"
      )
      VALUES (
        'ci-student', 'enc:student', 'bidx-student', 'enc:dob', 'Y5', NOW(), NOW()
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
          ('ci-behaviour-sensitive', 'ci-student', 'Demerit'::"BehaviourType", 'Safeguarding', 'Sensitive'::"BehaviourVisibility", -5, 'ci-head')
      `;
    });

    const fullAdminSensitive = await countVisibleBehaviour(
      runtimePrisma,
      'Head',
      true,
      'Sensitive',
    );
    const supervisorSensitive = await countVisibleBehaviour(
      runtimePrisma,
      'Supervisor',
      false,
      'Sensitive',
    );
    const supervisorGeneral = await countVisibleBehaviour(
      runtimePrisma,
      'Supervisor',
      false,
      'General',
    );

    if (fullAdminSensitive !== 1) {
      throw new Error(
        `Expected full admin to see 1 sensitive row, saw ${String(fullAdminSensitive)}`,
      );
    }
    if (supervisorSensitive !== 0) {
      throw new Error(
        `Expected supervisor to see 0 sensitive rows, saw ${String(supervisorSensitive)}`,
      );
    }
    if (supervisorGeneral !== 1) {
      throw new Error(`Expected supervisor to see 1 general row, saw ${String(supervisorGeneral)}`);
    }

    console.warn('RLS smoke passed: full admin sees Sensitive; supervisor sees General only.');
  } finally {
    await runtimePrisma.$disconnect();
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
