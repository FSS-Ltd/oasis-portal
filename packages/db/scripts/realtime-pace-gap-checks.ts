import assert from 'node:assert/strict';
import type { Prisma } from '@prisma/client';

export async function verifyPaceGapEvents(
  tx: Prisma.TransactionClient,
  fixture: {
    prefix: string;
    guardian: string;
    studentUser: string;
    studentId: string;
    subjectId: string;
    head: string;
  },
): Promise<void> {
  const plan = await tx.paceGapPlan.create({
    data: {
      studentId: fixture.studentId,
      subjectId: fixture.subjectId,
      jumpToPaceNumber: 1100,
      createdById: fixture.head,
      updatedById: fixture.head,
      items: { create: { paceNumber: 1003 } },
    },
    include: { items: true },
  });
  await tx.$executeRaw`SELECT set_config('app.user_role','Head',true),set_config('app.pace_gap_read_student_id','caller-read-scope',true),set_config('app.pace_gap_write_student_id','caller-write-scope',true)`;
  const assertReaders = async (): Promise<void> => {
    const events = await tx.$queryRaw<{ topic: string; payload: { areas: string[] } }[]>`
      SELECT topic,payload FROM realtime.messages WHERE event = 'oasis.data_changed' AND topic LIKE ${`oasis:user:${fixture.prefix}%`}
    `;
    for (const id of [fixture.guardian, fixture.studentUser])
      assert(
        events.some(
          (event) => event.topic === `oasis:user:${id}` && event.payload.areas.includes('pace'),
        ),
        'Gap-only updates must notify authorized self-student and linked guardian readers.',
      );
    const [scope] = await tx.$queryRaw<
      { read_scope: string; write_scope: string }[]
    >`SELECT current_setting('app.pace_gap_read_student_id',true) AS read_scope,current_setting('app.pace_gap_write_student_id',true) AS write_scope`;
    assert(scope);
    assert.equal(scope.read_scope, 'caller-read-scope');
    assert.equal(scope.write_scope, 'caller-write-scope');
  };
  await tx.$executeRaw`DELETE FROM realtime.messages WHERE topic LIKE ${`oasis:user:${fixture.prefix}%`}`;
  await tx.paceGapPlan.update({ where: { id: plan.id }, data: { jumpToPaceNumber: 1101 } });
  await assertReaders();
  await tx.$executeRaw`DELETE FROM realtime.messages WHERE topic LIKE ${`oasis:user:${fixture.prefix}%`}`;
  assert(plan.items[0]);
  await tx.paceGapPlanItem.update({
    where: { id: plan.items[0].id },
    data: { removedAt: new Date() },
  });
  await assertReaders();
  const enrolled = await tx.studentSubject.findUniqueOrThrow({
    where: { studentId_subjectId: { studentId: fixture.studentId, subjectId: fixture.subjectId } },
  });
  assert.equal(
    enrolled.currentPaceNumber,
    1002,
    'Gap updates must be visible without changing the current assigned pace.',
  );
  await tx.$executeRaw`SELECT set_config('app.user_role','',true),set_config('app.pace_gap_read_student_id','',true),set_config('app.pace_gap_write_student_id','',true)`;
}
