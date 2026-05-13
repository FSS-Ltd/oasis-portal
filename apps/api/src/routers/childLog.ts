import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import type { Prisma } from '@oasis/db';
import {
  AccessDeniedError,
  canViewAnyStudentDrillThrough,
  canViewSensitiveChildNotes,
  canViewStudentDrillThrough,
  isFullAdmin,
  isStaff,
  type SessionUser,
} from '@oasis/domain';
import type { AppContext } from '../context.js';
import {
  loadDailyYearBandScope,
  studentMatchesDailyScope,
  studentWhereForDailyScope,
} from '../lib/daily-year-band-scope.js';
import { authedProcedure, router } from '../trpc.js';

type AuthedContext = AppContext & { user: SessionUser };

const DRILLTHROUGH_MERIT_ACCOUNTS = ['Spend', 'Saving', 'Investment'] as const;
const PARENT_DASHBOARD_RECENT_LIMIT = 3;

const studentListInclude = {
  subjects: {
    include: { subject: true },
    orderBy: { subject: { code: 'asc' } },
  },
} as const;

const listAccessibleStudentsInput = z.object({ linkedOnly: z.boolean().default(false) }).optional();

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

function academicYearStart(referenceDate = new Date()): Date {
  const year =
    referenceDate.getUTCMonth() >= 8
      ? referenceDate.getUTCFullYear()
      : referenceDate.getUTCFullYear() - 1;
  return new Date(`${String(year)}-09-01T00:00:00.000Z`);
}

function percentage(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null;
  return Math.round((numerator / denominator) * 100);
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

async function denyOutOfSnapshotScope(
  ctx: AuthedContext,
  entity: string,
  meta: Record<string, unknown>,
): Promise<never> {
  const denied = new AccessDeniedError('student is outside supervisor assigned year band');
  await ctx.db.auditLog.create({
    data: {
      userId: ctx.user.id,
      action: 'PermissionDenied',
      entity,
      meta: { ...meta, role: ctx.user.role, reason: denied.message },
    },
  });
  throw new TRPCError({ code: 'FORBIDDEN', message: denied.message, cause: denied });
}

async function denyDrillThrough(ctx: AuthedContext, meta: Record<string, unknown>): Promise<never> {
  const denied = new AccessDeniedError(
    'student drill-through requires full-admin, tagged supervisor, or linked parent',
  );
  await ctx.db.auditLog.create({
    data: {
      userId: ctx.user.id,
      action: 'PermissionDenied',
      entity: 'childLog.drillThrough',
      meta: { ...meta, reason: denied.message },
    },
  });
  throw new TRPCError({ code: 'FORBIDDEN', message: denied.message, cause: denied });
}

async function requireDrillThroughAccess(ctx: AuthedContext, studentId: string): Promise<void> {
  if (!canViewStudentDrillThrough(ctx.user)) {
    await denyDrillThrough(ctx, { role: ctx.user.role, studentId });
  }
  if (canViewAnyStudentDrillThrough(ctx.user)) return;

  const guardian = await ctx.db.guardian.findUnique({
    where: { userId_studentId: { userId: ctx.user.id, studentId } },
    select: { id: true },
  });
  if (!guardian) {
    await denyDrillThrough(ctx, { role: ctx.user.role, studentId, source: 'guardian-link' });
  }
}

function mapStudentSummary(
  ctx: AuthedContext,
  student: {
    id: string;
    fullNameEnc: string;
    yearGroup: string;
    enrolmentDate: Date;
    active: boolean;
    subjects: Array<{
      subjectId: string;
      currentPaceNumber: number;
      subject: { code: string; name: string };
    }>;
  },
) {
  return {
    id: student.id,
    fullName: decryptRequired(ctx.db.$enc.decrypt, student.fullNameEnc, 'student PII'),
    yearGroup: student.yearGroup,
    enrolmentDate: dateKey(student.enrolmentDate),
    active: student.active,
    subjects: student.subjects.map((assignment) => ({
      subjectId: assignment.subjectId,
      code: assignment.subject.code,
      name: assignment.subject.name,
      currentPaceNumber: assignment.currentPaceNumber,
    })),
  };
}

function takeRecentByStudent<T extends { studentId: string }>(
  rows: readonly T[],
  studentId: string,
  limit = PARENT_DASHBOARD_RECENT_LIMIT,
): T[] {
  return rows.filter((row) => row.studentId === studentId).slice(0, limit);
}

function visibleBehaviourWhere(user: SessionUser): Prisma.BehaviourEntryWhereInput {
  if (isFullAdmin(user)) return { deletedAt: null };
  if (user.role === 'Supervisor' || user.role === 'ClubsAdmin') {
    return {
      deletedAt: null,
      OR: [
        { visibility: 'General' as const },
        {
          visibility: 'Sensitive' as const,
          recordedById: user.id,
          type: { in: ['Demerit', 'General'] },
        },
      ],
    };
  }
  return { deletedAt: null, visibility: 'General' as const };
}

export const childLogRouter = router({
  listSnapshotStudents: authedProcedure.query(async ({ ctx }) => {
    await requireSnapshotWorkflow(ctx);
    const scope = await loadDailyYearBandScope(ctx, new Date());
    const students = await ctx.db.student.findMany({
      where: { active: true, ...studentWhereForDailyScope(scope) },
      include: studentListInclude,
      orderBy: { createdAt: 'desc' },
    });

    await ctx.db.auditLog.create({
      data: {
        userId: ctx.user.id,
        action: 'DecryptPii',
        entity: 'Student',
        meta: { count: students.length, source: 'childLog.listSnapshotStudents' },
      },
    });

    return students.map((student) => mapStudentSummary(ctx, student));
  }),

  listAccessibleStudents: authedProcedure
    .input(listAccessibleStudentsInput)
    .query(async ({ ctx, input }) => {
      if (!canViewStudentDrillThrough(ctx.user)) {
        await denyDrillThrough(ctx, {
          role: ctx.user.role,
          source: 'childLog.listAccessibleStudents',
        });
      }

      if (canViewAnyStudentDrillThrough(ctx.user) && !input?.linkedOnly) {
        const students = await ctx.db.student.findMany({
          where: { active: true },
          include: studentListInclude,
          orderBy: { createdAt: 'desc' },
        });
        await ctx.db.auditLog.create({
          data: {
            userId: ctx.user.id,
            action: 'DecryptPii',
            entity: 'Student',
            meta: { count: students.length, source: 'childLog.listAccessibleStudents' },
          },
        });
        return students.map((student) => mapStudentSummary(ctx, student));
      }

      const guardians = await ctx.db.guardian.findMany({
        where: { userId: ctx.user.id, student: { active: true } },
        include: { student: { include: studentListInclude } },
        orderBy: { createdAt: 'desc' },
      });
      await ctx.db.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'DecryptPii',
          entity: 'Student',
          meta: { count: guardians.length, source: 'childLog.listAccessibleStudents' },
        },
      });
      return guardians.map((guardian) => mapStudentSummary(ctx, guardian.student));
    }),

  parentDashboard: authedProcedure.query(async ({ ctx }) => {
    if (!canViewStudentDrillThrough(ctx.user)) {
      await denyDrillThrough(ctx, {
        role: ctx.user.role,
        source: 'childLog.parentDashboard',
      });
    }

    const guardians = await ctx.db.guardian.findMany({
      where: { userId: ctx.user.id, student: { active: true } },
      include: { student: { include: studentListInclude } },
      orderBy: { createdAt: 'desc' },
    });
    const students = guardians.map((guardian) => guardian.student);
    const studentIds = students.map((student) => student.id);
    const from = academicYearStart();
    const to = dayEnd(new Date());

    await ctx.db.auditLog.create({
      data: {
        userId: ctx.user.id,
        action: 'DecryptPii',
        entity: 'Student',
        meta: { count: students.length, source: 'childLog.parentDashboard' },
      },
    });

    if (studentIds.length === 0) {
      return { children: [], range: { from: dateKey(from), to: dateKey(new Date()) } };
    }

    const [attendance, paceTests, behaviour, notes, meritBalances, policy] = await Promise.all([
      ctx.db.attendance.findMany({
        where: { studentId: { in: studentIds }, date: { gte: from, lt: to } },
        select: { id: true, studentId: true, date: true, status: true, createdAt: true },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      }),
      ctx.db.paceRecord.findMany({
        where: {
          studentId: { in: studentIds },
          completedAt: { gte: from, lt: to },
          OR: [{ paceTestScore: { not: null } }, { selfTestScore: { not: null } }],
        },
        include: { subject: { select: { id: true, code: true, name: true } } },
        orderBy: [{ completedAt: 'desc' }, { createdAt: 'desc' }],
      }),
      ctx.withRls((tx) =>
        tx.behaviourEntry.findMany({
          where: {
            studentId: { in: studentIds },
            createdAt: { gte: from, lt: to },
            deletedAt: null,
            visibility: 'General',
          },
          select: {
            id: true,
            studentId: true,
            type: true,
            category: true,
            noteEnc: true,
            meritDelta: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        }),
      ),
      ctx.db.childNote.findMany({
        where: {
          studentId: { in: studentIds },
          createdAt: { gte: from, lt: to },
          deletedAt: null,
          sensitive: false,
        },
        select: { id: true, studentId: true, noteEnc: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      }),
      ctx.db.meritLedger.groupBy({
        by: ['studentId', 'account'],
        where: {
          studentId: { in: studentIds },
          account: { in: [...DRILLTHROUGH_MERIT_ACCOUNTS] },
        },
        _sum: { delta: true },
      }),
      ctx.db.pacePolicy.findUnique({ where: { id: 'default' }, select: { passThreshold: true } }),
    ]);

    const passThreshold = policy?.passThreshold ?? 80;

    return {
      children: students.map((student) => {
        const balances = { Spend: 0, Saving: 0, Investment: 0 };
        for (const row of meritBalances) {
          if (row.studentId !== student.id) continue;
          if (row.account === 'Spend' || row.account === 'Saving' || row.account === 'Investment') {
            balances[row.account] = row._sum.delta ?? 0;
          }
        }

        const studentAttendance = attendance.filter((row) => row.studentId === student.id);
        const presentDays = studentAttendance.filter((row) => row.status === 'Present').length;
        const studentPace = paceTests.filter((record) => record.studentId === student.id);
        const pacesCompletedThisAcademicYear = studentPace.filter(
          (record) => record.paceTestScore !== null && record.paceTestScore >= passThreshold,
        ).length;

        return {
          student: mapStudentSummary(ctx, student),
          metrics: {
            meritBalances: balances,
            totalMerits: balances.Spend + balances.Saving + balances.Investment,
            pacesCompletedThisAcademicYear,
            attendanceRate: percentage(presentDays, studentAttendance.length),
            presentDays,
            recordedAttendanceDays: studentAttendance.length,
          },
          attendance: takeRecentByStudent(attendance, student.id).map((row) => ({
            id: row.id,
            date: dateKey(row.date),
            status: row.status,
            recordedAt: row.createdAt,
          })),
          behaviour: takeRecentByStudent(behaviour, student.id).map((entry) => ({
            id: entry.id,
            type: entry.type,
            category: entry.category,
            note: entry.noteEnc
              ? decryptRequired(ctx.db.$enc.decrypt, entry.noteEnc, 'behaviour note')
              : null,
            meritDelta: entry.meritDelta,
            createdAt: entry.createdAt,
          })),
          pace: takeRecentByStudent(studentPace, student.id).map((record) => ({
            id: record.id,
            date: record.completedAt ? dateKey(record.completedAt) : dateKey(record.createdAt),
            subjectId: record.subjectId,
            subjectCode: record.subject.code,
            subjectName: record.subject.name,
            paceNumber: record.paceNumber,
            score: record.paceTestScore ?? record.selfTestScore ?? 0,
            testType: record.paceTestScore !== null ? 'PACE Test' : 'Self-Test',
            passed: (record.paceTestScore ?? record.selfTestScore ?? 0) >= passThreshold,
          })),
          notes: takeRecentByStudent(notes, student.id).map((note) => ({
            id: note.id,
            note: decryptRequired(ctx.db.$enc.decrypt, note.noteEnc, 'child note'),
            createdAt: note.createdAt,
          })),
        };
      }),
      range: { from: dateKey(from), to: dateKey(new Date()) },
    };
  }),

  drillThrough: authedProcedure
    .input(z.object({ studentId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      await requireDrillThroughAccess(ctx, input.studentId);

      const from = academicYearStart();
      const to = dayEnd(new Date());
      const canReadSensitiveNotes = canViewSensitiveChildNotes(ctx.user);

      const student = await ctx.db.student.findUnique({
        where: { id: input.studentId },
        include: studentListInclude,
      });
      if (!student) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'student not found' });
      }
      if (!student.active && !isFullAdmin(ctx.user)) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'student is inactive' });
      }

      const [attendance, paceTests, behaviour, notes, meritBalances, policy] = await Promise.all([
        ctx.db.attendance.findMany({
          where: { studentId: input.studentId, date: { gte: from, lt: to } },
          select: { id: true, date: true, status: true, recordedById: true, createdAt: true },
          orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        }),
        ctx.db.paceRecord.findMany({
          where: {
            studentId: input.studentId,
            completedAt: { gte: from, lt: to },
            OR: [{ paceTestScore: { not: null } }, { selfTestScore: { not: null } }],
          },
          include: {
            subject: { select: { id: true, code: true, name: true } },
            recordedBy: { select: { id: true, fullNameEnc: true, role: true } },
          },
          orderBy: [{ completedAt: 'desc' }, { createdAt: 'desc' }],
        }),
        ctx.withRls((tx) =>
          tx.behaviourEntry.findMany({
            where: {
              studentId: input.studentId,
              createdAt: { gte: from, lt: to },
              ...visibleBehaviourWhere(ctx.user),
            },
            include: {
              recordedBy: { select: { id: true, fullNameEnc: true, role: true } },
            },
            orderBy: { createdAt: 'desc' },
          }),
        ),
        ctx.db.childNote.findMany({
          where: {
            studentId: input.studentId,
            createdAt: { gte: from, lt: to },
            deletedAt: null,
            ...(canReadSensitiveNotes ? {} : { sensitive: false }),
          },
          include: {
            createdBy: { select: { id: true, fullNameEnc: true, role: true } },
          },
          orderBy: { createdAt: 'desc' },
        }),
        ctx.db.meritLedger.groupBy({
          by: ['account'],
          where: {
            studentId: input.studentId,
            account: { in: [...DRILLTHROUGH_MERIT_ACCOUNTS] },
          },
          _sum: { delta: true },
        }),
        ctx.db.pacePolicy.findUnique({ where: { id: 'default' }, select: { passThreshold: true } }),
      ]);

      const balances = {
        Spend: 0,
        Saving: 0,
        Investment: 0,
      };
      for (const row of meritBalances) {
        if (row.account === 'Spend' || row.account === 'Saving' || row.account === 'Investment') {
          balances[row.account] = row._sum.delta ?? 0;
        }
      }

      const passThreshold = policy?.passThreshold ?? 80;
      const pacesCompletedThisAcademicYear = paceTests.filter(
        (record) => record.paceTestScore !== null && record.paceTestScore >= passThreshold,
      ).length;
      const presentDays = attendance.filter((row) => row.status === 'Present').length;
      const recordedAttendanceDays = attendance.length;
      const sensitiveBehaviourCount = behaviour.filter(
        (entry) => entry.visibility === 'Sensitive',
      ).length;
      const sensitiveNoteCount = notes.filter((note) => note.sensitive).length;

      if (sensitiveBehaviourCount > 0) {
        await ctx.db.auditLog.create({
          data: {
            userId: ctx.user.id,
            action: 'ReadSensitive',
            entity: 'BehaviourEntry',
            meta: {
              studentId: input.studentId,
              count: sensitiveBehaviourCount,
              source: 'childLog.drillThrough',
            },
          },
        });
      }

      if (sensitiveNoteCount > 0) {
        await ctx.db.auditLog.create({
          data: {
            userId: ctx.user.id,
            action: 'ReadSensitive',
            entity: 'ChildNote',
            meta: {
              studentId: input.studentId,
              count: sensitiveNoteCount,
              source: 'childLog.drillThrough',
            },
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
            source: 'childLog.drillThrough',
            fields: [
              'student.fullName',
              'behaviour.recordedBy.fullName',
              'pace.recordedBy.fullName',
              'childNote.note',
              'childNote.createdBy.fullName',
            ],
            behaviourCount: behaviour.length,
            noteCount: notes.length,
            paceCount: paceTests.length,
          },
        },
      });

      return {
        student: mapStudentSummary(ctx, student),
        range: {
          from: dateKey(from),
          to: dateKey(new Date()),
        },
        metrics: {
          meritBalances: balances,
          totalMerits: balances.Spend + balances.Saving + balances.Investment,
          pacesCompletedThisAcademicYear,
          attendanceRate: percentage(presentDays, recordedAttendanceDays),
          presentDays,
          recordedAttendanceDays,
        },
        attendance: attendance.map((row) => ({
          id: row.id,
          date: dateKey(row.date),
          status: row.status,
          recordedById: row.recordedById,
          recordedAt: row.createdAt,
        })),
        behaviour: behaviour.map((entry) => ({
          id: entry.id,
          type: entry.type,
          category: entry.category,
          note: entry.noteEnc
            ? decryptRequired(ctx.db.$enc.decrypt, entry.noteEnc, 'behaviour note')
            : null,
          visibility: entry.visibility,
          meritDelta: entry.meritDelta,
          recordedById: entry.recordedById,
          recordedByName: decryptRequired(
            ctx.db.$enc.decrypt,
            entry.recordedBy.fullNameEnc,
            'user PII',
          ),
          recordedByRole: entry.recordedBy.role,
          createdAt: entry.createdAt,
        })),
        pace: paceTests.map((record) => ({
          id: record.id,
          date: record.completedAt ? dateKey(record.completedAt) : dateKey(record.createdAt),
          subjectId: record.subjectId,
          subjectCode: record.subject.code,
          subjectName: record.subject.name,
          paceNumber: record.paceNumber,
          score: record.paceTestScore ?? record.selfTestScore ?? 0,
          maxScore: 100,
          testType: record.paceTestScore !== null ? 'PACE Test' : 'Self-Test',
          passed: (record.paceTestScore ?? record.selfTestScore ?? 0) >= passThreshold,
          recordedById: record.recordedById,
          recordedByName: decryptRequired(
            ctx.db.$enc.decrypt,
            record.recordedBy.fullNameEnc,
            'user PII',
          ),
          recordedByRole: record.recordedBy.role,
          completedAt: record.completedAt,
          createdAt: record.createdAt,
        })),
        notes: notes.map((note) => ({
          id: note.id,
          note: decryptRequired(ctx.db.$enc.decrypt, note.noteEnc, 'child note'),
          sensitive: note.sensitive,
          createdById: note.createdById,
          createdByName: decryptRequired(
            ctx.db.$enc.decrypt,
            note.createdBy.fullNameEnc,
            'user PII',
          ),
          createdByRole: note.createdBy.role,
          createdAt: note.createdAt,
        })),
      };
    }),

  snapshot: authedProcedure.input(snapshotInput).query(async ({ ctx, input }) => {
    await requireSnapshotWorkflow(ctx);
    const scope = await loadDailyYearBandScope(ctx, new Date());

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
    if (!studentMatchesDailyScope(scope, student)) {
      await denyOutOfSnapshotScope(ctx, 'childLog.snapshot', {
        studentId: input.studentId,
        studentYearGroup: student.yearGroup,
        date: scope.dayKey,
        assignedBands: scope.assignedBands.map((band) => band.id),
      });
    }

    const canReadSensitiveNotes = canViewSensitiveChildNotes(ctx.user);

    const [attendance, paceTests, behaviour, notes, meritBalance] = await Promise.all([
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
          OR: [{ paceTestScore: { not: null } }, { selfTestScore: { not: null } }],
        },
        include: {
          subject: { select: { id: true, code: true, name: true } },
          recordedBy: { select: { id: true, fullNameEnc: true, role: true } },
        },
        orderBy: [{ completedAt: 'asc' }, { createdAt: 'asc' }],
      }),
      ctx.withRls((tx) =>
        tx.behaviourEntry.findMany({
          where: {
            studentId: input.studentId,
            createdAt: { gte: from, lt: to },
            ...visibleBehaviourWhere(ctx.user),
          },
          select: {
            id: true,
            type: true,
            category: true,
            noteEnc: true,
            visibility: true,
            meritDelta: true,
            recordedById: true,
            createdAt: true,
            recordedBy: { select: { id: true, fullNameEnc: true, role: true } },
          },
          orderBy: { createdAt: 'asc' },
        }),
      ),
      ctx.db.childNote.findMany({
        where: {
          studentId: input.studentId,
          createdAt: { gte: from, lt: to },
          deletedAt: null,
          ...(canReadSensitiveNotes ? {} : { sensitive: false }),
        },
        include: { createdBy: { select: { id: true, fullNameEnc: true, role: true } } },
        orderBy: { createdAt: 'asc' },
      }),
      ctx.db.meritLedger.aggregate({
        where: {
          studentId: input.studentId,
          account: { in: ['Spend', 'Saving', 'Investment'] },
        },
        _sum: { delta: true },
      }),
    ]);

    const sensitiveNoteCount = notes.filter((note) => note.sensitive).length;
    if (sensitiveNoteCount > 0) {
      await ctx.db.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'ReadSensitive',
          entity: 'ChildNote',
          meta: {
            studentId: input.studentId,
            count: sensitiveNoteCount,
            source: 'childLog.snapshot',
          },
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
        supervisorName: notes[0]?.createdBy.fullNameEnc
          ? decryptRequired(ctx.db.$enc.decrypt, notes[0].createdBy.fullNameEnc, 'user PII')
          : behaviour[0]?.recordedBy.fullNameEnc
            ? decryptRequired(ctx.db.$enc.decrypt, behaviour[0].recordedBy.fullNameEnc, 'user PII')
            : paceTests[0]?.recordedBy.fullNameEnc
              ? decryptRequired(
                  ctx.db.$enc.decrypt,
                  paceTests[0].recordedBy.fullNameEnc,
                  'user PII',
                )
              : null,
        totalMerits: meritBalance._sum.delta ?? 0,
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
        score: record.paceTestScore ?? record.selfTestScore ?? 0,
        maxScore: 100,
        testType: record.paceTestScore !== null ? 'PACE Test' : 'Self-Test',
        recordedById: record.recordedById,
        recordedByName: decryptRequired(
          ctx.db.$enc.decrypt,
          record.recordedBy.fullNameEnc,
          'user PII',
        ),
        recordedByRole: record.recordedBy.role,
        completedAt: record.completedAt,
        createdAt: record.createdAt,
      })),
      behaviour: behaviour.map((entry) => ({
        id: entry.id,
        type: entry.type,
        category: entry.category,
        note: entry.noteEnc
          ? decryptRequired(ctx.db.$enc.decrypt, entry.noteEnc, 'behaviour note')
          : null,
        visibility: entry.visibility,
        meritDelta: entry.meritDelta,
        recordedById: entry.recordedById,
        recordedByName: decryptRequired(
          ctx.db.$enc.decrypt,
          entry.recordedBy.fullNameEnc,
          'user PII',
        ),
        recordedByRole: entry.recordedBy.role,
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
