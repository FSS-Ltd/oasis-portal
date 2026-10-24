import assert from 'node:assert/strict';
import type { Prisma } from '@prisma/client';

export async function verifyOperationalEvents(
  tx: Prisma.TransactionClient,
  fixture: {
    prefix: string;
    head: string;
    guardian: string;
    studentUser: string;
    studentId: string;
  },
): Promise<void> {
  const clear = async (): Promise<void> => {
    await tx.$executeRaw`DELETE FROM realtime.messages WHERE topic LIKE ${`oasis:user:${fixture.prefix}%`}`;
  };
  const messages = (): Promise<{ topic: string; payload: { areas: string[] } }[]> => tx.$queryRaw`
    SELECT topic,payload FROM realtime.messages WHERE event = 'oasis.data_changed' AND topic LIKE ${`oasis:user:${fixture.prefix}%`}
  `;
  await clear();
  await tx.auditLog.create({
    data: { userId: fixture.head, action: 'DecryptPii', entity: 'User' },
  });
  assert.equal(
    (await messages()).length,
    0,
    'Reading audit records must not cause audit refresh loops.',
  );
  await tx.auditLog.create({ data: { userId: fixture.head, action: 'Create', entity: 'Student' } });
  assert.deepEqual(
    (await messages()).map((event) => event.topic),
    [`oasis:user:${fixture.head}`],
  );
  await clear();
  const usage = await tx.studentPortalUsageMinute.create({
    data: { studentId: fixture.studentId, minuteStartedAt: new Date() },
  });
  let events = await messages();
  assert(
    events.some(
      (event) =>
        event.topic === `oasis:user:${fixture.guardian}` &&
        event.payload.areas.includes('studentSettings'),
    ),
  );
  assert(
    !events.some((event) => event.topic === `oasis:user:${fixture.studentUser}`),
    'Minute tracking must not re-enter the student heartbeat gate.',
  );
  await clear();
  await tx.studentPortalUsageMinute.update({
    where: { id: usage.id },
    data: { lastSeenAt: new Date() },
  });
  assert.equal((await messages()).length, 0, 'Usage heartbeat updates never refresh queries.');
  const agreement = await tx.userAgreement.create({
    data: { titleEnc: 'fixture', kind: 'UserAgreement', createdById: fixture.head },
  });
  const version = await tx.userAgreementVersion.create({
    data: {
      agreementId: agreement.id,
      version: 1,
      originalFileNameEnc: 'fixture',
      storagePath: fixture.prefix,
      sha256: 'fixture',
    },
  });
  const request = await tx.userAgreementRequest.create({
    data: { versionId: version.id, recipientId: fixture.guardian, delivery: { create: {} } },
  });
  await clear();
  await tx.userAgreementDelivery.update({
    where: { requestId: request.id },
    data: { claimUntil: new Date() },
  });
  assert.equal(
    (await messages()).length,
    0,
    'Claiming a delivery lease never refreshes signing registers.',
  );
  await tx.userAgreementDelivery.update({
    where: { requestId: request.id },
    data: { attempts: 1 },
  });
  events = await messages();
  for (const id of [fixture.head, fixture.guardian])
    assert(
      events.some(
        (event) =>
          event.topic === `oasis:user:${id}` && event.payload.areas.includes('userAgreement'),
      ),
    );
}
