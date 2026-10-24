import assert from 'node:assert/strict';
import type { Prisma } from '@prisma/client';

export async function verifyGlobalReferenceEvents(
  tx: Prisma.TransactionClient,
  fixture: {
    prefix: string;
    guardian: string;
    studentUser: string;
    subjectId: string;
    head: string;
    staff: string;
    otherStaff: string;
  },
): Promise<void> {
  const clear = async (): Promise<void> => {
    await tx.$executeRaw`DELETE FROM realtime.messages WHERE topic LIKE ${`oasis:user:${fixture.prefix}%`}`;
  };
  const messages = (): Promise<{ topic: string; payload: { areas: string[] } }[]> => tx.$queryRaw`
    SELECT topic,payload FROM realtime.messages WHERE event = 'oasis.data_changed' AND topic LIKE ${`oasis:user:${fixture.prefix}%`}
  `;
  const assertPaceReaders = async (): Promise<void> => {
    const events = await messages();
    for (const user of [fixture.guardian, fixture.studentUser])
      assert(
        events.some(
          (event) =>
            event.topic === `oasis:user:${user}` && event.payload.areas.includes('student'),
        ),
        'Global pace inputs must refresh both self-student and linked-guardian dashboards.',
      );
    assert(
      !events.some((event) => event.topic === `oasis:user:${fixture.prefix}-unlinked-parent`),
      'Global pace inputs must not notify unlinked parents.',
    );
  };
  await clear();
  await tx.subject.update({
    where: { id: fixture.subjectId },
    data: { name: `${fixture.prefix}-renamed` },
  });
  await assertPaceReaders();
  const policy = await tx.pacePolicy.create({ data: { id: fixture.prefix } });
  await clear();
  await tx.pacePolicy.update({ where: { id: policy.id }, data: { passThreshold: 81 } });
  await assertPaceReaders();
  const event = await tx.calendarEvent.create({
    data: {
      title: fixture.prefix,
      audience: 'Custom',
      startDate: new Date(),
      endDate: new Date(),
      createdById: fixture.head,
      requiredPeople: { create: { userId: fixture.staff, taggedById: fixture.head } },
    },
  });
  await clear();
  await tx.calendarEvent.update({
    where: { id: event.id },
    data: { title: `${fixture.prefix}-updated` },
  });
  let events = await messages();
  assert(
    events.some(
      (item) =>
        item.topic === `oasis:user:${fixture.staff}` && item.payload.areas.includes('calendar'),
    ),
    'Editing a custom calendar event must notify its selected staff recipient.',
  );
  assert(
    !events.some((item) => item.topic === `oasis:user:${fixture.otherStaff}`),
    'Custom calendar edits must exclude unselected staff.',
  );
  await clear();
  await tx.calendarEventRequiredPerson.delete({
    where: { eventId_userId: { eventId: event.id, userId: fixture.staff } },
  });
  events = await messages();
  assert(
    events.some(
      (item) =>
        item.topic === `oasis:user:${fixture.staff}` && item.payload.areas.includes('calendar'),
    ),
    'Removing a calendar recipient must invalidate their previous view.',
  );
}
