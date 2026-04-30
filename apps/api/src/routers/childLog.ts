import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import {
  AccessDeniedError,
  canViewSensitiveChildNotes,
  isStaff,
  type SessionUser,
} from '@oasis/domain';
import type { AppContext } from '../context.js';
import { authedProcedure, router } from '../trpc.js';

type AuthedContext = AppContext & { user: SessionUser };

const snapshotInput = z
  .object({
    studentId: z.string().min(1),
    from: z.coerce.date(),
    to: z.coerce.date(),
  })
  .refine((input) => normalizeDate(input.from).getTime() <= normalizeDate(input.to).getTime(), {
    message: 'from must be on or before to',
    path: ['to'],
  });

function normalizeDate(date: Date): Date {
  return new Date(`${date.toISOString().slice(0, 10)}T00:00:00.000Z`);
}

function dayEnd(date: Date): Date {
  const end = normalizeDate(date);
  end.setUTCDate(end.getUTCDate() + 1);
  return end;
}

function dateKey(date: Date): string {
  return normalizeDate(date).toISOString().slice(0, 10);
}

function decryptRequired(
  decrypt: (value: string | null | undefined) => string | null,
  value: string,
  entity: string,
): string {
  const decrypted = decrypt(value);
  if (!decrypted) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `${entity} decrypt failed` });
  }
  return decrypted;
}

async function requireSnapshotWorkflow(ctx: AuthedContext): Promise<void> {
  if (isStaff(ctx.user)) return;
  const denied = new AccessDeniedError('child snapshot requires full-admin or Supervisor');
  await ctx.db.auditLog.create({
    data: {
      userId: ctx.user.id,
      action: 'PermissionDenied',
      entity: 'childLog.snapshot',
      meta: { role: ctx.user.role, reason: denied.message },
    },
  });
  throw new TRPCError({ code: 'FORBIDDEN', message: denied.message, cause: denied });
}

export const childLogRouter = router({
  snapshot: authedProcedure.input(snapshotInput).query(async ({ ctx, input }) => {
    await requireSnapshotWorkflow(ctx);

    const from = normalizeDate(input.from);
    const to = dayEnd(input.to);
    const student = await ctx.db.student.findUnique({
      where: { id: input.studentId },
      select: { id: true, active: true, fullNameEnc: true, yearGroup: true },
    });
    if (!student) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'student not found' });
    }
    if (!student.active) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'student is inactive' });
    }

    const policy = await ctx.db.pacePolicy.findUnique({ where: { id: 'default' } });
    const passThreshold = policy?.passThreshold ?? 80;
    const canReadSensitiveNotes = canViewSensitiveChildNotes(ctx.user);

    const [attendance, paceTests, behaviour, notes] = await Promise.all([
      ctx.db.attendance.findMany({
        where: {
          studentId: input.studentId,
          date: { gte: from, lt: to },
        },
        select: { id: true, date: true, status: true, recordedById: true, createdAt: true },
        orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
      }),
      ctx.db.paceRecord.findMany({
        where: {
          studentId: input.studentId,
          completedAt: { gte: from, lt: to },
          paceTestScore: { gte: passThreshold },
        },
        include: { subject: { select: { id: true, code: true, name: true } } },
        orderBy: [{ completedAt: 'asc' }, { createdAt: 'asc' }],
      }),
      ctx.db.behaviourEntry.findMany({
        where: {
          studentId: input.studentId,
          createdAt: { gte: from, lt: to },
        },
        select: {
          id: true,
          type: true,
          category: true,
          visibility: true,
          meritDelta: true,
          recordedById: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
      }),
      ctx.db.childNote.findMany({
        where: {
          studentId: input.studentId,
          createdAt: { gte: from, lt: to },
          ...(canReadSensitiveNotes ? {} : { sensitive: false }),
        },
        include: { createdBy: { select: { id: true, fullNameEnc: true, role: true } } },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    const sensitiveNoteCount = notes.filter((note) => note.sensitive).length;
    if (sensitiveNoteCount > 0) {
      await ctx.db.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'ReadSensitive',
          entity: 'ChildNote',
          meta: { studentId: input.studentId, count: sensitiveNoteCount, source: 'childLog.snapshot' },
        },
      });
    }

    await ctx.db.auditLog.create({
      data: {
        userId: ctx.user.id,
        action: 'DecryptPii',
        entity: 'Student',
        entityId: input.studentId,
        meta: {
          source: 'childLog.snapshot',
          fields: ['student.fullName', 'childNote.note', 'childNote.createdBy.fullName'],
          noteCount: notes.length,
        },
      },
    });

    return {
      student: {
        id: student.id,
        fullName: decryptRequired(ctx.db.$enc.decrypt, student.fullNameEnc, 'student PII'),
        yearGroup: student.yearGroup,
      },
      range: {
        from: dateKey(from),
        to: dateKey(input.to),
      },
      attendance: attendance.map((row) => ({
        id: row.id,
        date: dateKey(row.date),
        status: row.status,
        recordedById: row.recordedById,
        recordedAt: row.createdAt,
      })),
      tardiness: attendance
        .filter((row) => row.status === 'Late')
        .map((row) => ({
          id: row.id,
          date: dateKey(row.date),
          recordedById: row.recordedById,
          recordedAt: row.createdAt,
        })),
      passedTests: paceTests.map((record) => ({
        id: record.id,
        date: record.completedAt ? dateKey(record.completedAt) : dateKey(record.createdAt),
        subjectId: record.subjectId,
        subjectCode: record.subject.code,
        subjectName: record.subject.name,
        paceNumber: record.paceNumber,
        score: record.paceTestScore,
        completedAt: record.completedAt,
        createdAt: record.createdAt,
      })),
      behaviour: behaviour.map((entry) => ({
        id: entry.id,
        type: entry.type,
        category: entry.category,
        visibility: entry.visibility,
        meritDelta: entry.meritDelta,
        recordedById: entry.recordedById,
        createdAt: entry.createdAt,
      })),
      notes: notes.map((note) => ({
        id: note.id,
        note: decryptRequired(ctx.db.$enc.decrypt, note.noteEnc, 'child note'),
        sensitive: note.sensitive,
        createdById: note.createdById,
        createdByName: decryptRequired(ctx.db.$enc.decrypt, note.createdBy.fullNameEnc, 'user PII'),
        createdByRole: note.createdBy.role,
        createdAt: note.createdAt,
      })),
    };
  }),
});
