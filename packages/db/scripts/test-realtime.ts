/** Dedicated test databases only. All fixtures are removed before exit. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PrismaClient, type Prisma } from '@prisma/client';
import { verifyRecipientIsolation } from './realtime-privacy-checks.js';

interface Broadcast {
  topic: string;
  payload: { areas: string[]; eventId: string; occurredAt: string };
}

async function main(): Promise<void> {
  const url = process.env['OASIS_REALTIME_TEST_DATABASE_URL'];
  if (!url)
    throw new Error('Set OASIS_REALTIME_TEST_DATABASE_URL to a dedicated, migrated test database.');
  const client = new PrismaClient({ datasources: { db: { url } } });
  const prefix = `event-test-${randomUUID()}`;
  const owner = `${prefix}-owner`;
  const outsider = `${prefix}-outsider`;
  const student = `${prefix}-student`;
  let localStub = false;
  try {
    const [transport] = await client.$queryRaw<
      { exists: boolean }[]
    >`SELECT to_regclass('realtime.messages') IS NOT NULL AS exists`;
    if (!transport?.exists) {
      const host = new URL(url).hostname;
      assert(
        ['127.0.0.1', 'localhost', '[::1]'].includes(host),
        'A missing transport may only be stubbed on localhost.',
      );
      await client.$executeRawUnsafe('CREATE SCHEMA realtime');
      await client.$executeRawUnsafe(
        'CREATE TABLE realtime.messages (topic text, event text, payload jsonb)',
      );
      await client.$executeRawUnsafe(
        `CREATE FUNCTION realtime.send(payload jsonb,event text,topic text,private boolean) RETURNS void LANGUAGE sql AS $$ INSERT INTO realtime.messages VALUES (topic,event,payload); $$`,
      );
      localStub = true;
    }
    await verifyRecipientIsolation(client, prefix);
    await client.user.createMany({
      data: [owner, outsider].map(
        (id): Prisma.UserCreateManyInput => ({
          id,
          clerkId: id,
          role: 'Parent',
          fullNameEnc: 'fixture',
        }),
      ),
    });
    await client.student.create({
      data: {
        id: student,
        fullNameEnc: 'fixture',
        nameBidx: prefix,
        dobEnc: 'fixture',
        yearGroup: '1',
        enrolmentDate: new Date(),
      },
    });
    await client.guardian.create({
      data: { id: `${prefix}-guardian`, userId: owner, studentId: student },
    });
    const messages = (): Promise<Broadcast[]> => client.$queryRaw`
      SELECT topic,payload FROM realtime.messages WHERE event = 'oasis.data_changed' AND topic IN (${`oasis:user:${owner}`},${`oasis:user:${outsider}`})
    `;
    const clear = async (): Promise<void> => {
      await client.$executeRaw`DELETE FROM realtime.messages WHERE topic IN (${`oasis:user:${owner}`},${`oasis:user:${outsider}`})`;
    };
    await clear();
    const bulkStarted = performance.now();
    await client.$transaction(
      async (tx) => {
        for (let index = 0; index < 100; index += 1) {
          await tx.student.update({
            where: { id: student },
            data: { yearGroup: index === 99 ? '3' : `bulk-${String(index)}` },
          });
        }
      },
      { timeout: 30_000 },
    );
    const bulkElapsed = performance.now() - bulkStarted;
    let emitted = await messages();
    assert.equal(
      emitted.length,
      1,
      'Bulk changes coalesce into one event per recipient per transaction.',
    );
    const firstEvent = emitted[0];
    assert(firstEvent);
    assert.equal(
      firstEvent.topic,
      `oasis:user:${owner}`,
      'Unrelated guardians never receive student updates.',
    );
    assert(firstEvent.payload.areas.includes('student'));
    const [bulkPending] = await client.$queryRaw<
      { count: bigint }[]
    >`SELECT count(*) FROM oasis_private.pending_change`;
    assert.equal(bulkPending?.count, 0n, 'Bulk commit drains the entire transient accumulator.');
    process.stdout.write(
      `Bulk probe: 100 real student updates, ${String(emitted.length)} recipient event, zero queued rows, ${bulkElapsed.toFixed(1)} ms.\n`,
    );
    assert.match(firstEvent.payload.eventId, /^[0-9a-f-]{36}$/);
    assert(Number.isFinite(Date.parse(firstEvent.payload.occurredAt)));
    assert.deepEqual(Object.keys(firstEvent.payload).sort(), ['areas', 'eventId', 'occurredAt']);
    await clear();
    await assert.rejects(
      client.$transaction(async (tx) => {
        await tx.student.update({ where: { id: student }, data: { yearGroup: '4' } });
        throw new Error('intentional rollback');
      }),
      /intentional rollback/,
    );
    assert.equal((await messages()).length, 0, 'Rolled-back changes never notify.');
    await client.student.update({ where: { id: student }, data: { yearGroup: '3' } });
    assert.equal((await messages()).length, 0, 'Unchanged business state never notifies.');
    await client.guardian.delete({ where: { id: `${prefix}-guardian` } });
    emitted = await messages();
    assert.equal(emitted.length, 1, 'Removing access reaches the previous guardian.');
    await clear();
    await client.user.update({ where: { id: owner }, data: { active: false } });
    emitted = await messages();
    assert.equal(emitted.length, 1, 'Account revocation reaches an existing connection.');
    assert.deepEqual(emitted[0]?.payload.areas, ['profile']);
    const [pending] = await client.$queryRaw<
      { count: bigint }[]
    >`SELECT count(*) FROM oasis_private.pending_change`;
    assert.equal(pending?.count, 0n, 'The accumulator never retains committed rows.');
    // Restore configuration through rollback; this must not change the environment.
    await assert.rejects(
      client.$transaction(async (tx) => {
        await tx.$executeRaw`UPDATE oasis_private.realtime_configuration SET enforce_2fa = true`;
        for (const [fva, expected] of [
          [[0, 0], true],
          [[0, -1], false],
          [['0', 0], false],
          [null, false],
        ] as const) {
          const claims = JSON.stringify({ sub: outsider, fva });
          const [result] = await tx.$queryRaw<
            { allowed: boolean }[]
          >`SELECT oasis_private.receive_allowed(${claims}::jsonb) AS allowed`;
          assert.equal(result?.allowed, expected, `2FA claim ${JSON.stringify(fva)}`);
        }
        throw new Error('restore configuration');
      }),
      /restore configuration/,
    );
    process.stdout.write(
      'Realtime integration passed: commit, rollback, coalescing, no-op, guardian isolation, revocation, 2FA, accumulator cleanup.\n',
    );
  } finally {
    await client.guardian.deleteMany({ where: { studentId: student } });
    await client.student.deleteMany({ where: { id: student } });
    await client.user.deleteMany({ where: { id: { in: [owner, outsider] } } });
    if (localStub) await client.$executeRawUnsafe('DROP SCHEMA realtime CASCADE');
    await client.$disconnect();
  }
}
main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
  );
  process.exitCode = 1;
});
