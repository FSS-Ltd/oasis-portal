import assert from 'node:assert/strict';
import type { PrismaClient } from '@prisma/client';
import { verifyPaceGapEvents } from './realtime-pace-gap-checks.js';
import { verifyGlobalReferenceEvents } from './realtime-reference-checks.js';
import { verifyFeeConfigurationEvents } from './realtime-finance-checks.js';
import { verifyOperationalEvents } from './realtime-operational-checks.js';

/** Fixture transaction is always rolled back; no student or staff data survives. */
export async function verifyRecipientIsolation(
  client: PrismaClient,
  prefix: string,
): Promise<void> {
  await assert.rejects(
    client.$transaction(
      async (tx) => {
        const head = `${prefix}-head`;
        const guardian = `${prefix}-guardian-user`;
        const own = `${prefix}-self`;
        const staff = `${prefix}-assigned`;
        const other = `${prefix}-unassigned`;
        await tx.user.createMany({
          data: [
            { id: head, clerkId: head, fullNameEnc: 'fixture', role: 'Head' },
            { id: own, clerkId: own, fullNameEnc: 'fixture', role: 'Student' },
            { id: guardian, clerkId: guardian, fullNameEnc: 'fixture', role: 'Parent' },
            { id: staff, clerkId: staff, fullNameEnc: 'fixture', role: 'Supervisor' },
            { id: other, clerkId: other, fullNameEnc: 'fixture', role: 'Supervisor' },
          ],
        });
        const band = await tx.yearGroupBand.create({ data: { name: prefix, colour: '#000000' } });
        const student = await tx.student.create({
          data: {
            userId: own,
            fullNameEnc: 'fixture',
            nameBidx: prefix,
            dobEnc: 'fixture',
            yearGroup: '1',
            enrolmentDate: new Date(),
            ageBandId: band.id,
          },
        });
        await tx.guardian.create({ data: { userId: guardian, studentId: student.id } });
        const [clock] = await tx.$queryRaw<
          { date: Date }[]
        >`SELECT (now() AT TIME ZONE 'Europe/London')::date AS date`;
        assert(clock);
        await tx.staffShift.create({
          data: {
            staffUserId: staff,
            yearGroupBandId: band.id,
            date: clock.date,
            startsAt: new Date(),
            endsAt: new Date(Date.now() + 3_600_000),
          },
        });
        const subject = await tx.subject.create({ data: { code: prefix, name: prefix } });
        const enrolled = await tx.studentSubject.create({
          data: { studentId: student.id, subjectId: subject.id },
        });
        // Exercise the installed row policies for every model, including correlated
        // subqueries. Missing aliases or mismatched app context must fail this test.
        await tx.$queryRaw`SELECT model,oasis_private.row_visible(model,'{}'::jsonb,${head}) FROM oasis_private.model_coverage`;
        await tx.$executeRawUnsafe('SET CONSTRAINTS ALL IMMEDIATE');
        await tx.$executeRaw`DELETE FROM realtime.messages WHERE topic LIKE ${`oasis:user:${prefix}%`}`;
        await tx.studentSubject.update({
          where: { id: enrolled.id },
          data: { currentPaceNumber: 1002 },
        });
        const events = await tx.$queryRaw<{ topic: string; payload: { areas: string[] } }[]>`
      SELECT topic,payload FROM realtime.messages WHERE event = 'oasis.data_changed' AND topic LIKE ${`oasis:user:${prefix}%`}
    `;
        for (const id of [head, guardian, own, staff]) {
          assert(
            events.some(
              (event) =>
                event.topic === `oasis:user:${id}` && event.payload.areas.includes('student'),
            ),
            `StudentSubject must refresh student dashboards for ${id}.`,
          );
        }
        assert(
          !events.some((event) => event.topic === `oasis:user:${other}`),
          'Unassigned staff never receive student-specific changes.',
        );
        await verifyFeeConfigurationEvents(tx, { prefix, guardian });
        await verifyGlobalReferenceEvents(tx, {
          prefix,
          guardian,
          studentUser: own,
          subjectId: subject.id,
          head,
          staff,
          otherStaff: other,
        });
        await verifyPaceGapEvents(tx, {
          prefix,
          guardian,
          studentUser: own,
          studentId: student.id,
          subjectId: subject.id,
          head,
        });
        await verifyOperationalEvents(tx, {
          prefix,
          head,
          guardian,
          studentUser: own,
          studentId: student.id,
        });
        throw new Error('rollback privacy fixtures');
      },
      { timeout: 30_000 },
    ),
    /rollback privacy fixtures/,
  );
}
