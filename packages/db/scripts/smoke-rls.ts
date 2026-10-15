import { randomBytes } from 'node:crypto';
import { PrismaClient, type Prisma } from '@prisma/client';
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
type RuntimeSession = {
  complianceAdmin?: boolean;
  fullAdmin: boolean;
  role: string;
  userId: string;
};

function assertVisibleCount({
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

async function withRuntimeSession<T>(
  client: PrismaClient,
  session: RuntimeSession,
  run: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return client.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.user_id', ${session.userId}, true)`;
    await tx.$executeRaw`SELECT set_config('app.user_role', ${session.role}, true)`;
    await tx.$executeRaw`SELECT set_config('app.full_admin', ${String(session.fullAdmin)}, true)`;
    await tx.$executeRaw`SELECT set_config('app.compliance_admin', ${String(session.complianceAdmin ?? false)}, true)`;

    return run(tx);
  });
}

async function countVisibleBehaviour(
  client: PrismaClient,
  userId: string,
  role: string,
  fullAdmin: boolean,
  visibility: string,
) {
  const rows = await withRuntimeSession(
    client,
    { fullAdmin, role, userId },
    (tx) =>
      tx.$queryRaw<CountRow[]>`
      SELECT COUNT(*)::bigint AS count
      FROM "BehaviourEntry"
      WHERE "visibility" = ${visibility}::"BehaviourVisibility"
    `,
  );

  return Number(rows[0]?.count ?? 0n);
}

async function countVisiblePersonalTasks(
  client: PrismaClient,
  session: RuntimeSession,
): Promise<number> {
  const rows = await withRuntimeSession(
    client,
    session,
    (tx) =>
      tx.$queryRaw<CountRow[]>`
      SELECT COUNT(*)::bigint AS count
      FROM "PersonalTask"
    `,
  );

  return Number(rows[0]?.count ?? 0n);
}

async function insertPersonalTask(
  client: PrismaClient,
  session: RuntimeSession,
  id: string,
  title: string,
): Promise<void> {
  const inserted = await withRuntimeSession(
    client,
    session,
    (tx) =>
      tx.$executeRaw`
      INSERT INTO "PersonalTask" ("id", "ownerId", "title", "updatedAt")
      VALUES (${id}, ${session.userId}, ${title}, NOW())
    `,
  );

  if (inserted !== 1) {
    throw new Error(`Expected to insert personal task ${id}`);
  }
}

async function assertPersonalTaskIsolation(client: PrismaClient): Promise<void> {
  const authorSession: RuntimeSession = {
    fullAdmin: false,
    role: 'Supervisor',
    userId: 'ci-sup-author',
  };

  const crossOwnerRead = await withRuntimeSession(
    client,
    authorSession,
    (tx) =>
      tx.$queryRaw<{ id: string }[]>`
      SELECT "id"
      FROM "PersonalTask"
      WHERE "id" = 'ci-task-other'
    `,
  );
  if (crossOwnerRead.length !== 0) {
    throw new Error('cross-owner personal task read unexpectedly returned a task');
  }

  const crossOwnerUpdate = await withRuntimeSession(
    client,
    authorSession,
    (tx) =>
      tx.$executeRaw`
      UPDATE "PersonalTask"
      SET "title" = 'Unexpected update'
      WHERE "id" = 'ci-task-other'
    `,
  );
  if (crossOwnerUpdate !== 0) {
    throw new Error('cross-owner personal task update unexpectedly succeeded');
  }

  let crossOwnerInsertBlocked = false;
  try {
    await withRuntimeSession(
      client,
      authorSession,
      (tx) =>
        tx.$executeRaw`
        INSERT INTO "PersonalTask" ("id", "ownerId", "title", "updatedAt")
        VALUES ('ci-task-intrusion', 'ci-sup-other', 'Unexpected insert', NOW())
      `,
    );
  } catch {
    crossOwnerInsertBlocked = true;
  }
  if (!crossOwnerInsertBlocked) {
    throw new Error('cross-owner personal task insert unexpectedly succeeded');
  }
}

async function assertComplianceAdminCapability(client: PrismaClient): Promise<void> {
  const staff = { fullAdmin: false, role: 'Supervisor', userId: 'ci-sup-author' };
  const tagged = { ...staff, complianceAdmin: true };
  const updateCompliance = (session: RuntimeSession) =>
    withRuntimeSession(
      client,
      session,
      (tx) =>
        tx.$executeRaw`UPDATE "AdultCompliance" SET "firstAidLevel" = 'Level 2' WHERE "userId" = 'ci-sup-other'`,
    );
  assertVisibleCount({
    actual: await updateCompliance(staff),
    expected: 0,
    label: 'untagged compliance update',
  });
  assertVisibleCount({
    actual: await updateCompliance(tagged),
    expected: 1,
    label: 'tagged compliance update',
  });

  const updateDraft = (session: RuntimeSession) =>
    withRuntimeSession(
      client,
      session,
      (tx) =>
        tx.$executeRaw`UPDATE "IncidentReport" SET "locationEnc" = 'updated' WHERE "id" = 'ci-incident-other'`,
    );
  assertVisibleCount({
    actual: await updateDraft(staff),
    expected: 0,
    label: 'untagged cross-author draft update',
  });
  assertVisibleCount({
    actual: await updateDraft(tagged),
    expected: 1,
    label: 'tagged cross-author draft update',
  });

  const agreementCount = (session: RuntimeSession) =>
    withRuntimeSession(client, session, (tx) =>
      tx.userAgreement.count({ where: { id: 'ci-agreement' } }),
    );
  assertVisibleCount({
    actual: await agreementCount(staff),
    expected: 0,
    label: 'untagged agreement read',
  });
  assertVisibleCount({
    actual: await agreementCount(tagged),
    expected: 1,
    label: 'tagged agreement read',
  });

  const unrelatedTasks = await countVisiblePersonalTasks(client, tagged);
  assertVisibleCount({
    actual: unrelatedTasks,
    expected: 1,
    label: 'tagged personal task isolation',
  });
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

    await withRuntimeSession(
      prisma,
      { fullAdmin: true, role: 'Head', userId: 'ci-head' },
      async (tx) => {
        await tx.adultCompliance.create({ data: { userId: 'ci-sup-other' } });
        await tx.userAgreement.create({
          data: {
            id: 'ci-agreement',
            titleEnc: encryptField('CI Agreement'),
            kind: 'UserAgreement',
            createdById: 'ci-head',
          },
        });
      },
    );
    await withRuntimeSession(
      prisma,
      { fullAdmin: false, role: 'Supervisor', userId: 'ci-sup-other' },
      (tx) =>
        tx.incidentReport.create({
          data: {
            id: 'ci-incident-other',
            reportNumber: 'CI-INCIDENT-1',
            type: 'AccidentFirstAid',
            severity: 'Low',
            occurredAt: new Date(),
            locationEnc: encryptField('Medical room'),
            factualAccountEnc: encryptField('First aid given'),
            recordedById: 'ci-sup-other',
          },
        }),
    );

    await insertPersonalTask(
      runtimePrisma,
      { fullAdmin: true, role: 'Head', userId: 'ci-head' },
      'ci-task-head',
      'Head task',
    );
    await insertPersonalTask(
      runtimePrisma,
      { fullAdmin: false, role: 'Supervisor', userId: 'ci-sup-author' },
      'ci-task-author',
      'Author task',
    );
    await insertPersonalTask(
      runtimePrisma,
      { fullAdmin: false, role: 'Supervisor', userId: 'ci-sup-other' },
      'ci-task-other',
      'Other task',
    );
    await assertPersonalTaskIsolation(runtimePrisma);
    await assertComplianceAdminCapability(runtimePrisma);

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

    assertVisibleCount({ actual: fullAdminSensitive, expected: 2, label: 'full admin' });
    assertVisibleCount({ actual: hodSensitive, expected: 2, label: 'HOD' });
    assertVisibleCount({ actual: principalSensitive, expected: 2, label: 'Principal' });
    assertVisibleCount({
      actual: authorSupervisorSensitive,
      expected: 2,
      label: 'author supervisor',
    });
    assertVisibleCount({
      actual: otherSupervisorSensitive,
      expected: 0,
      label: 'other supervisor',
    });
    assertVisibleCount({ actual: supervisorGeneral, expected: 1, label: 'supervisor' });

    const headTasks = await countVisiblePersonalTasks(runtimePrisma, {
      fullAdmin: true,
      role: 'Head',
      userId: 'ci-head',
    });
    const authorTasks = await countVisiblePersonalTasks(runtimePrisma, {
      fullAdmin: false,
      role: 'Supervisor',
      userId: 'ci-sup-author',
    });
    const otherTasks = await countVisiblePersonalTasks(runtimePrisma, {
      fullAdmin: false,
      role: 'Supervisor',
      userId: 'ci-sup-other',
    });

    assertVisibleCount({ actual: headTasks, expected: 1, label: 'Head personal tasks' });
    assertVisibleCount({
      actual: authorTasks,
      expected: 1,
      label: 'author personal tasks',
    });
    assertVisibleCount({ actual: otherTasks, expected: 1, label: 'other personal tasks' });

    console.warn(
      'RLS smoke passed: sensitive behaviour, personal tasks, and Compliance Admin access are enforced.',
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
