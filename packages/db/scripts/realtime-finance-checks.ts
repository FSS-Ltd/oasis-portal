import assert from 'node:assert/strict';
import type { Prisma } from '@prisma/client';

export async function verifyFeeConfigurationEvents(
  tx: Prisma.TransactionClient,
  fixture: { prefix: string; guardian: string },
): Promise<void> {
  const unlinkedParent = `${fixture.prefix}-unlinked-parent`;
  await tx.user.create({
    data: { id: unlinkedParent, clerkId: unlinkedParent, role: 'Parent', fullNameEnc: 'fixture' },
  });
  const config = await tx.schoolFeeYearFeeConfig.create({
    data: {
      schoolYear: -2_000_000_000,
      annualAmountPence: 100,
      termAmountPence: 50,
      monthlyAmountPence: 10,
    },
  });
  await tx.$executeRaw`DELETE FROM realtime.messages WHERE topic LIKE ${`oasis:user:${fixture.prefix}%`}`;
  await tx.schoolFeeYearFeeConfig.update({
    where: { id: config.id },
    data: { annualAmountPence: 200 },
  });
  const events = await tx.$queryRaw<{ topic: string; payload: { areas: string[] } }[]>`
    SELECT topic,payload FROM realtime.messages WHERE event = 'oasis.data_changed' AND topic LIKE ${`oasis:user:${fixture.prefix}%`}
  `;
  assert(
    events.some(
      (event) =>
        event.topic === `oasis:user:${fixture.guardian}` && event.payload.areas.includes('invoice'),
    ),
    'Global fee changes must refresh linked guardians family invoice summaries.',
  );
  assert(
    !events.some((event) => event.topic === `oasis:user:${unlinkedParent}`),
    'Parents without linked children must not receive global fee configuration changes.',
  );
}
