import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type CountRow = { count: bigint };

async function countVisibleBehaviour(role: string, fullAdmin: boolean, visibility: string) {
  const rows = await prisma.$transaction(async (tx) => {
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
  try {
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

    const fullAdminSensitive = await countVisibleBehaviour('Head', true, 'Sensitive');
    const supervisorSensitive = await countVisibleBehaviour('Supervisor', false, 'Sensitive');
    const supervisorGeneral = await countVisibleBehaviour('Supervisor', false, 'General');

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
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
