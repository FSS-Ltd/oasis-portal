import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import type { Prisma } from '@oasis/db';
import {
  AccessDeniedError,
  academicYearStart,
  attendanceRate,
  canUseAdminOperations,
  canViewAnyStudentDrillThrough,
  canViewSensitiveChildNotes,
  canViewStudentDrillThrough,
  currentOasisAcademicPeriod,
  demeritPolicyEscalationEntryIds,
  demeritPolicyStatusForEntries,
  isFullAdmin,
  isOasisOperatingDay,
  isStaff,
  type DemeritPolicyStage,
  type Role,
  type SessionUser,
} from '@oasis/domain';
import type { AppContext } from '../context.js';
import {
  dateKey,
  dayEnd,
  loadDailyYearBandScope,
  normalizeDate,
  studentMatchesDailyScope,
  studentWhereForDailyScope,
} from '../lib/daily-year-band-scope.js';
import { localDayBounds } from '../lib/local-day.js';
import { authedProcedure, router } from '../trpc.js';

type AuthedContext = AppContext & { user: SessionUser };

function parseDemeritPolicyStage(value: number): DemeritPolicyStage | null {
  if (value === 1 || value === 2 || value === 3 || value === 4 || value === 5) return value;
  return null;
}

const DRILLTHROUGH_MERIT_ACCOUNTS = [
  'Spend',
  'Saving',
  'Investment',
  'ShopReserved',
  'TithePaid',
  'Given',
] as const;
const PARENT_DASHBOARD_RECENT_LIMIT = 3;
type ParentDashboardAttendanceStatus = 'Present' | 'Absent' | 'Late';
type ParentDashboardTodayStatus =
  | { date: string; kind: 'halfTerm'; label: 'Half Term' }
  | { date: string; kind: 'holiday'; label: string }
  | { date: string; kind: 'closed'; label: 'Closed' }
  | { date: string; kind: 'attendance'; label: ParentDashboardAttendanceStatus }
  | { date: string; kind: 'unmarked'; label: 'No mark' };

const studentListInclude = {
  subjects: {
    include: { subject: true },
    orderBy: { subject: { code: 'asc' } },
  },
} as const;

const supervisorNotesHistoryNoteInclude = {
  createdBy: { select: { id: true, fullNameEnc: true, role: true } },
  seenBy: { select: { id: true, fullNameEnc: true, role: true } },
  student: { select: { id: true, fullNameEnc: true, yearGroup: true } },
} satisfies Prisma.ChildNoteInclude;

const supervisorNotesHistoryMarkInclude = {
  recordedBy: { select: { id: true, fullNameEnc: true, role: true } },
  seenBy: { select: { id: true, fullNameEnc: true, role: true } },
  student: { select: { id: true, fullNameEnc: true, yearGroup: true } },
} satisfies Prisma.BehaviourEntryInclude;

type SensitiveReviewMarkRow = Prisma.BehaviourEntryGetPayload<{
  include: typeof supervisorNotesHistoryMarkInclude;
}>;

const listAccessibleStudentsInput = z.object({ linkedOnly: z.boolean().default(false) }).optional();

const snapshotRangeShape = {
  from: z.coerce.date(),
  to: z.coerce.date(),
};

const snapshotRangeInput = z
  .object({
    ...snapshotRangeShape,
  })
  .refine((input) => normalizeDate(input.from).getTime() <= normalizeDate(input.to).getTime(), {
    message: 'from must be on or before to',
    path: ['to'],
  });

const snapshotInput = z
  .object({
    ...snapshotRangeShape,
    studentId: z.string().min(1),
  })
  .refine((input) => normalizeDate(input.from).getTime() <= normalizeDate(input.to).getTime(), {
    message: 'from must be on or before to',
    path: ['to'],
  });

const reviewSensitiveItemInput = z.object({
  kind: z.enum(['note', 'mark']),
  id: z.string().min(1),
  comment: z.string().trim().max(3000).optional(),
});

function parentDashboardTodayStatus(
  date: Date,
  hasHalfTermToday: boolean,
  attendanceStatus: ParentDashboardAttendanceStatus | undefined,
): ParentDashboardTodayStatus {
  const key = dateKey(date);
  if (hasHalfTermToday) return { date: key, kind: 'halfTerm', label: 'Half Term' };
  const academicPeriod = currentOasisAcademicPeriod(date);
  if (academicPeriod?.kind === 'halfTerm')
    return { date: key, kind: 'halfTerm', label: 'Half Term' };
  if (academicPeriod?.kind === 'holiday') {
    return { date: key, kind: 'holiday', label: academicPeriod.label };
  }
  if (!isOasisOperatingDay(date)) return { date: key, kind: 'closed', label: 'Closed' };
  if (attendanceStatus) return { date: key, kind: 'attendance', label: attendanceStatus };
  return { date: key, kind: 'unmarked', label: 'No mark' };
}

function paceProgressKey(record: {
  paceNumber: number;
  studentId: string;
  subjectId: string;
}): string {
  return `${record.studentId}:${record.subjectId}:${String(record.paceNumber)}`;
}

function countPassedFinalPaceTests(
  records: readonly { paceTestScore: number | null }[],
  passThreshold: number,
): number {
  return records.filter(
    (record) => record.paceTestScore !== null && record.paceTestScore >= passThreshold,
  ).length;
}

async function loadPaceStartedAtByKey(
  ctx: AuthedContext,
  records: readonly {
    paceNumber: number;
    studentId: string;
    subjectId: string;
  }[],
): Promise<Map<string, Date>> {
  const uniqueKeys = new Map<
    string,
    { paceNumber: number; studentId: string; subjectId: string }
  >();
  for (const record of records) {
    uniqueKeys.set(paceProgressKey(record), record);
  }
  const keys = [...uniqueKeys.values()];
  if (keys.length === 0) return new Map();

  const progressRows = await ctx.db.paceProgress.findMany({
    where: {
      OR: keys.map((record) => ({
        studentId: record.studentId,
        subjectId: record.subjectId,
        paceNumber: record.paceNumber,
      })),
    },
    select: {
      studentId: true,
      subjectId: true,
      paceNumber: true,
      startedAt: true,
    },
  });

  return new Map(progressRows.map((row) => [paceProgressKey(row), row.startedAt]));
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

function decryptOptional(
  decrypt: (value: string | null | undefined) => string | null,
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  return decrypt(value);
}

function mapPaceApproval(
  ctx: AuthedContext,
  approval: {
    id: string;
    approvedAt: Date;
    approvedById: string;
    notesEnc: string;
    approvedBy: { fullNameEnc: string; role: string };
  } | null,
): {
  id: string;
  approvedAt: Date;
  approvedById: string;
  approvedByName: string;
  approvedByRole: string;
  notes: string;
} | null {
  if (!approval) return null;
  return {
    id: approval.id,
    approvedAt: approval.approvedAt,
    approvedById: approval.approvedById,
    approvedByName: decryptRequired(
      ctx.db.$enc.decrypt,
      approval.approvedBy.fullNameEnc,
      'user PII',
    ),
    approvedByRole: approval.approvedBy.role,
    notes: decryptRequired(ctx.db.$enc.decrypt, approval.notesEnc, 'PACE approval notes'),
  };
}

async function requireSnapshotWorkflow(ctx: AuthedContext): Promise<void> {
  if (isStaff(ctx.user) || canUseAdminOperations(ctx.user)) return;
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

async function requireCentreSnapshotWorkflow(ctx: AuthedContext): Promise<void> {
  if (isFullAdmin(ctx.user)) return;
  const denied = new AccessDeniedError('centre snapshot requires full-admin access');
  await ctx.db.auditLog.create({
    data: {
      userId: ctx.user.id,
      action: 'PermissionDenied',
      entity: 'childLog.centreSnapshot',
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

function sensitiveSupervisorMarkWhere(): Prisma.BehaviourEntryWhereInput {
  return {
    visibility: 'Sensitive',
    recordedBy: { role: { in: ['Supervisor', 'ClubsAdmin'] } },
  };
}

function policyEscalationMarkIds(rows: readonly SensitiveReviewMarkRow[]): Set<string> {
  return demeritPolicyEscalationEntryIds(
    rows.map((row) => ({
      category: row.category,
      createdAt: row.createdAt,
      id: row.id,
      meritDelta: row.meritDelta,
      studentId: row.studentId,
      type: row.type,
    })),
  );
}

function shouldIncludeSensitiveReviewMark(
  row: SensitiveReviewMarkRow,
  escalationIds: ReadonlySet<string>,
): boolean {
  const sensitiveSupervisor =
    row.visibility === 'Sensitive' && ['Supervisor', 'ClubsAdmin'].includes(row.recordedBy.role);
  return sensitiveSupervisor || escalationIds.has(row.id);
}

export const childLogRouter = router({
  listSnapshotStudents: authedProcedure.query(async ({ ctx }) => {
    await requireSnapshotWorkflow(ctx);
    const scope = await loadDailyYearBandScope(ctx, new Date());
    const scopeWhere = studentWhereForDailyScope(scope);
    const students = await ctx.db.student.findMany({
      where: { active: true, ...scopeWhere },
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

  centreSnapshot: authedProcedure.input(snapshotRangeInput).query(async ({ ctx, input }) => {
    await requireCentreSnapshotWorkflow(ctx);

    const from = normalizeDate(input.from);
    const to = dayEnd(input.to);
    const students = await ctx.db.student.findMany({
      where: { active: true },
      include: studentListInclude,
      orderBy: { createdAt: 'desc' },
    });
    const studentIds = students.map((student) => student.id);
    const studentSummaries = students.map((student) => mapStudentSummary(ctx, student));
    const studentSummaryById = new Map(studentSummaries.map((student) => [student.id, student]));

    const emptySummary = {
      activeStudentCount: students.length,
      attendance: { present: 0, late: 0, absent: 0, recorded: 0 },
      meritsEarned: 0,
      demeritsTotal: 0,
      netMerits: 0,
      averagePaceScore: null as number | null,
      behaviourCount: 0,
      paceCount: 0,
      notesCount: 0,
    };

    if (studentIds.length === 0) {
      await ctx.db.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'DecryptPii',
          entity: 'Student',
          meta: {
            count: 0,
            source: 'childLog.centreSnapshot',
            fields: ['student.fullName'],
          },
        },
      });
      return {
        summary: emptySummary,
        range: { from: dateKey(from), to: dateKey(input.to) },
        students: [],
        attendance: [],
        behaviour: [],
        passedTests: [],
        notes: [],
      };
    }

    const canReadSensitiveNotes = canViewSensitiveChildNotes(ctx.user);
    const [attendance, paceTests, behaviour, notes, meritBalances] = await Promise.all([
      ctx.db.attendance.findMany({
        where: {
          studentId: { in: studentIds },
          date: { gte: from, lt: to },
        },
        select: {
          id: true,
          studentId: true,
          date: true,
          status: true,
          recordedById: true,
          createdAt: true,
        },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      }),
      ctx.db.paceRecord.findMany({
        where: {
          studentId: { in: studentIds },
          completedAt: { gte: from, lt: to },
          OR: [{ paceTestScore: { not: null } }, { selfTestScore: { not: null } }],
        },
        include: {
          subject: { select: { id: true, code: true, name: true } },
          recordedBy: { select: { id: true, fullNameEnc: true, role: true } },
          advancementApproval: {
            select: {
              id: true,
              approvedAt: true,
              approvedById: true,
              notesEnc: true,
              approvedBy: { select: { fullNameEnc: true, role: true } },
            },
          },
        },
        orderBy: [{ completedAt: 'desc' }, { createdAt: 'desc' }],
      }),
      ctx.withRls((tx) =>
        tx.behaviourEntry.findMany({
          where: {
            studentId: { in: studentIds },
            createdAt: { gte: from, lt: to },
            ...visibleBehaviourWhere(ctx.user),
          },
          select: {
            id: true,
            studentId: true,
            type: true,
            category: true,
            noteEnc: true,
            visibility: true,
            meritDelta: true,
            recordedById: true,
            createdAt: true,
            recordedBy: { select: { id: true, fullNameEnc: true, role: true } },
          },
          orderBy: { createdAt: 'desc' },
        }),
      ),
      ctx.db.childNote.findMany({
        where: {
          studentId: { in: studentIds },
          createdAt: { gte: from, lt: to },
          deletedAt: null,
          ...(canReadSensitiveNotes ? {} : { sensitive: false }),
        },
        include: { createdBy: { select: { id: true, fullNameEnc: true, role: true } } },
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
    ]);

    function requireStudent(studentId: string) {
      const student = studentSummaryById.get(studentId);
      if (!student) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'student summary missing' });
      }
      return student;
    }

    const meritBalanceByStudent = new Map<string, number>();
    for (const row of meritBalances) {
      meritBalanceByStudent.set(
        row.studentId,
        (meritBalanceByStudent.get(row.studentId) ?? 0) + (row._sum.delta ?? 0),
      );
    }
    const paceStartedAtByKey = await loadPaceStartedAtByKey(ctx, paceTests);

    const meritsEarned = behaviour
      .filter((entry) => entry.meritDelta > 0)
      .reduce((sum, entry) => sum + entry.meritDelta, 0);
    const demeritsTotal = behaviour
      .filter((entry) => entry.meritDelta < 0)
      .reduce((sum, entry) => sum + entry.meritDelta, 0);
    const paceScores = paceTests.map((record) => record.paceTestScore ?? record.selfTestScore ?? 0);
    const sensitiveNoteCount = notes.filter((note) => note.sensitive).length;

    if (sensitiveNoteCount > 0) {
      await ctx.db.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'ReadSensitive',
          entity: 'ChildNote',
          meta: {
            count: sensitiveNoteCount,
            source: 'childLog.centreSnapshot',
          },
        },
      });
    }

    await ctx.db.auditLog.create({
      data: {
        userId: ctx.user.id,
        action: 'DecryptPii',
        entity: 'Student',
        meta: {
          count: students.length,
          source: 'childLog.centreSnapshot',
          fields: [
            'student.fullName',
            'behaviour.note',
            'behaviour.recordedBy.fullName',
            'childNote.note',
            'childNote.createdBy.fullName',
            'paceRecord.recordedBy.fullName',
          ],
          behaviourCount: behaviour.length,
          noteCount: notes.length,
          paceCount: paceTests.length,
        },
      },
    });

    return {
      summary: {
        activeStudentCount: students.length,
        attendance: {
          present: attendance.filter((row) => row.status === 'Present').length,
          late: attendance.filter((row) => row.status === 'Late').length,
          absent: attendance.filter((row) => row.status === 'Absent').length,
          recorded: attendance.length,
        },
        meritsEarned,
        demeritsTotal,
        netMerits: meritsEarned + demeritsTotal,
        averagePaceScore:
          paceScores.length > 0
            ? Math.round(paceScores.reduce((sum, score) => sum + score, 0) / paceScores.length)
            : null,
        behaviourCount: behaviour.length,
        paceCount: paceTests.length,
        notesCount: notes.length,
      },
      range: {
        from: dateKey(from),
        to: dateKey(input.to),
      },
      students: studentSummaries.map((student) => {
        const studentAttendance = attendance.filter((row) => row.studentId === student.id);
        const studentBehaviour = behaviour.filter((entry) => entry.studentId === student.id);
        const studentPace = paceTests.filter((record) => record.studentId === student.id);
        const studentNotes = notes.filter((note) => note.studentId === student.id);
        const studentScores = studentPace.map(
          (record) => record.paceTestScore ?? record.selfTestScore ?? 0,
        );
        const studentMeritsEarned = studentBehaviour
          .filter((entry) => entry.meritDelta > 0)
          .reduce((sum, entry) => sum + entry.meritDelta, 0);
        const studentDemeritsTotal = studentBehaviour
          .filter((entry) => entry.meritDelta < 0)
          .reduce((sum, entry) => sum + entry.meritDelta, 0);

        return {
          student,
          metrics: {
            attendance: {
              present: studentAttendance.filter((row) => row.status === 'Present').length,
              late: studentAttendance.filter((row) => row.status === 'Late').length,
              absent: studentAttendance.filter((row) => row.status === 'Absent').length,
              recorded: studentAttendance.length,
            },
            meritsEarned: studentMeritsEarned,
            demeritsTotal: studentDemeritsTotal,
            netMerits: studentMeritsEarned + studentDemeritsTotal,
            totalMerits: meritBalanceByStudent.get(student.id) ?? 0,
            averagePaceScore:
              studentScores.length > 0
                ? Math.round(
                    studentScores.reduce((sum, score) => sum + score, 0) / studentScores.length,
                  )
                : null,
            behaviourCount: studentBehaviour.length,
            paceCount: studentPace.length,
            notesCount: studentNotes.length,
          },
        };
      }),
      attendance: attendance.map((row) => ({
        id: row.id,
        student: requireStudent(row.studentId),
        date: dateKey(row.date),
        status: row.status,
        recordedById: row.recordedById,
        recordedAt: row.createdAt,
      })),
      passedTests: paceTests.map((record) => ({
        id: record.id,
        student: requireStudent(record.studentId),
        date: record.completedAt ? dateKey(record.completedAt) : dateKey(record.createdAt),
        subjectId: record.subjectId,
        subjectCode: record.subject.code,
        subjectName: record.subject.name,
        paceNumber: record.paceNumber,
        score: record.paceTestScore ?? record.selfTestScore ?? 0,
        maxScore: 100,
        testType: record.paceTestScore !== null ? 'PACE Test' : 'Self-Test',
        approval: mapPaceApproval(ctx, record.advancementApproval),
        recordedById: record.recordedById,
        recordedByName: decryptRequired(
          ctx.db.$enc.decrypt,
          record.recordedBy.fullNameEnc,
          'user PII',
        ),
        recordedByRole: record.recordedBy.role,
        completedAt: record.completedAt,
        startedAt: paceStartedAtByKey.get(paceProgressKey(record)) ?? null,
        createdAt: record.createdAt,
      })),
      behaviour: behaviour.map((entry) => ({
        id: entry.id,
        student: requireStudent(entry.studentId),
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
        student: requireStudent(note.studentId),
        note: decryptRequired(ctx.db.$enc.decrypt, note.noteEnc, 'child note'),
        sensitive: note.sensitive,
        createdById: note.createdById,
        createdByName: decryptRequired(ctx.db.$enc.decrypt, note.createdBy.fullNameEnc, 'user PII'),
        createdByRole: note.createdBy.role,
        createdAt: note.createdAt,
      })),
    };
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
    const today = normalizeDate(new Date());
    const todayKey = dateKey(today);
    const to = dayEnd(today);

    await ctx.db.auditLog.create({
      data: {
        userId: ctx.user.id,
        action: 'DecryptPii',
        entity: 'Student',
        meta: { count: students.length, source: 'childLog.parentDashboard' },
      },
    });

    if (studentIds.length === 0) {
      return { children: [], range: { from: dateKey(from), to: todayKey } };
    }

    const [attendance, paceTests, behaviour, notes, meritBalances, policy, halfTermEvents] =
      await Promise.all([
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
        ctx.db.calendarEvent.findMany({
          where: {
            active: true,
            audience: { in: ['All', 'Parents'] },
            category: 'HalfTerm',
            startDate: { lte: today },
            endDate: { gte: today },
          },
          select: { id: true },
          take: 1,
        }),
      ]);

    const hasHalfTermToday = halfTermEvents.length > 0;
    const passThreshold = policy?.passThreshold ?? 80;
    const paceStartedAtByKey = await loadPaceStartedAtByKey(ctx, paceTests);
    return {
      children: students.map((student) => {
        const balances = {
          Spend: 0,
          Saving: 0,
          Investment: 0,
          ShopReserved: 0,
          TithePaid: 0,
          Given: 0,
        };
        for (const row of meritBalances) {
          if (row.studentId !== student.id) continue;
          if (
            row.account === 'Spend' ||
            row.account === 'Saving' ||
            row.account === 'Investment' ||
            row.account === 'ShopReserved' ||
            row.account === 'TithePaid' ||
            row.account === 'Given'
          ) {
            balances[row.account] = row._sum.delta ?? 0;
          }
        }

        const studentAttendance = attendance.filter((row) => row.studentId === student.id);
        const todayAttendance = studentAttendance.find((row) => dateKey(row.date) === todayKey);
        const presentDays = studentAttendance.filter((row) => row.status === 'Present').length;
        const lateDays = studentAttendance.filter((row) => row.status === 'Late').length;
        const attendedDays = presentDays + lateDays;
        const studentPace = paceTests.filter((record) => record.studentId === student.id);
        const pacesCompletedThisAcademicYear = countPassedFinalPaceTests(
          studentPace,
          passThreshold,
        );

        return {
          student: mapStudentSummary(ctx, student),
          metrics: {
            meritBalances: balances,
            totalMerits:
              balances.Spend + balances.Saving + balances.Investment + balances.ShopReserved,
            pacesCompletedThisAcademicYear,
            attendanceRate: attendanceRate({
              late: lateDays,
              present: presentDays,
              total: studentAttendance.length,
            }),
            attendedDays,
            presentDays,
            recordedAttendanceDays: studentAttendance.length,
          },
          todayStatus: parentDashboardTodayStatus(today, hasHalfTermToday, todayAttendance?.status),
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
            completedAt: record.completedAt,
            startedAt: paceStartedAtByKey.get(paceProgressKey(record)) ?? null,
            createdAt: record.createdAt,
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
      if (!student.active && !canUseAdminOperations(ctx.user)) {
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
            advancementApproval: {
              select: {
                id: true,
                approvedAt: true,
                approvedById: true,
                notesEnc: true,
                approvedBy: { select: { fullNameEnc: true, role: true } },
              },
            },
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
        ctx.db.pacePolicy.findUnique({
          where: { id: 'default' },
          select: { passThreshold: true },
        }),
      ]);

      const balances = {
        Spend: 0,
        Saving: 0,
        Investment: 0,
        ShopReserved: 0,
        TithePaid: 0,
        Given: 0,
      };
      for (const row of meritBalances) {
        if (
          row.account === 'Spend' ||
          row.account === 'Saving' ||
          row.account === 'Investment' ||
          row.account === 'ShopReserved' ||
          row.account === 'TithePaid' ||
          row.account === 'Given'
        ) {
          balances[row.account] = row._sum.delta ?? 0;
        }
      }

      const passThreshold = policy?.passThreshold ?? 80;
      const paceStartedAtByKey = await loadPaceStartedAtByKey(ctx, paceTests);
      const pacesCompletedThisAcademicYear = countPassedFinalPaceTests(paceTests, passThreshold);
      const presentDays = attendance.filter((row) => row.status === 'Present').length;
      const lateDays = attendance.filter((row) => row.status === 'Late').length;
      const attendedDays = presentDays + lateDays;
      const recordedAttendanceDays = attendance.length;
      const disciplineDay = localDayBounds(new Date());
      const disciplineDemerits = behaviour.filter(
        (entry) =>
          entry.type === 'Demerit' &&
          entry.createdAt >= disciplineDay.from &&
          entry.createdAt < disciplineDay.to,
      );
      const disciplineStageOverride = await ctx.withRls((tx) =>
        tx.demeritStageOverride.findUnique({
          where: {
            studentId_day: {
              studentId: input.studentId,
              day: disciplineDay.key,
            },
          },
          select: { stage: true },
        }),
      );
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
          totalMerits:
            balances.Spend + balances.Saving + balances.Investment + balances.ShopReserved,
          pacesCompletedThisAcademicYear,
          attendanceRate: attendanceRate({
            late: lateDays,
            present: presentDays,
            total: recordedAttendanceDays,
          }),
          attendedDays,
          presentDays,
          recordedAttendanceDays,
        },
        discipline: {
          date: disciplineDay.key,
          status: demeritPolicyStatusForEntries(
            disciplineDemerits,
            disciplineStageOverride ? parseDemeritPolicyStage(disciplineStageOverride.stage) : null,
          ),
          demerits: disciplineDemerits.map((entry) => ({
            id: entry.id,
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
          approval: mapPaceApproval(ctx, record.advancementApproval),
          recordedById: record.recordedById,
          recordedByName: decryptRequired(
            ctx.db.$enc.decrypt,
            record.recordedBy.fullNameEnc,
            'user PII',
          ),
          recordedByRole: record.recordedBy.role,
          completedAt: record.completedAt,
          startedAt: paceStartedAtByKey.get(paceProgressKey(record)) ?? null,
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
      select: {
        id: true,
        active: true,
        fullNameEnc: true,
        yearGroup: true,
        ageBandId: true,
        subjects: {
          include: { subject: true },
          orderBy: { subject: { code: 'asc' } },
        },
      },
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
          advancementApproval: {
            select: {
              id: true,
              approvedAt: true,
              approvedById: true,
              notesEnc: true,
              approvedBy: { select: { fullNameEnc: true, role: true } },
            },
          },
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
    const paceStartedAtByKey = await loadPaceStartedAtByKey(ctx, paceTests);
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
        subjects: student.subjects.map((assignment) => ({
          subjectId: assignment.subjectId,
          code: assignment.subject.code,
          name: assignment.subject.name,
          currentPaceNumber: assignment.currentPaceNumber,
        })),
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
        approval: mapPaceApproval(ctx, record.advancementApproval),
        recordedById: record.recordedById,
        recordedByName: decryptRequired(
          ctx.db.$enc.decrypt,
          record.recordedBy.fullNameEnc,
          'user PII',
        ),
        recordedByRole: record.recordedBy.role,
        completedAt: record.completedAt,
        startedAt: paceStartedAtByKey.get(paceProgressKey(record)) ?? null,
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

  sensitiveReviewQueue: authedProcedure.query(async ({ ctx }) => {
    await requireCentreSnapshotWorkflow(ctx);

    const [notes, marks] = await Promise.all([
      ctx.db.childNote.findMany({
        where: {
          sensitive: true,
          deletedAt: null,
          createdBy: { role: { in: ['Supervisor', 'ClubsAdmin'] } },
        },
        include: {
          createdBy: { select: { id: true, fullNameEnc: true, role: true } },
          seenBy: { select: { id: true, fullNameEnc: true, role: true } },
          student: { select: { id: true, fullNameEnc: true, yearGroup: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      ctx.withRls((tx) =>
        tx.behaviourEntry.findMany({
          where: {
            ...visibleBehaviourWhere(ctx.user),
            OR: [sensitiveSupervisorMarkWhere(), { type: 'Demerit' }],
          },
          include: {
            recordedBy: { select: { id: true, fullNameEnc: true, role: true } },
            seenBy: { select: { id: true, fullNameEnc: true, role: true } },
            student: { select: { id: true, fullNameEnc: true, yearGroup: true } },
          },
          orderBy: { createdAt: 'desc' },
        }),
      ),
    ]);
    const escalationIds = policyEscalationMarkIds(marks);
    const reviewMarks = marks.filter((mark) =>
      shouldIncludeSensitiveReviewMark(mark, escalationIds),
    );

    await ctx.db.auditLog.create({
      data: {
        userId: ctx.user.id,
        action: 'ReadSensitive',
        entity: 'SensitiveReview',
        meta: {
          source: 'childLog.sensitiveReviewQueue',
          noteCount: notes.length,
          markCount: reviewMarks.length,
        },
      },
    });

    const noteItems = notes.map((note) => ({
      id: note.id,
      kind: 'note' as const,
      student: {
        id: note.student.id,
        fullName: decryptRequired(ctx.db.$enc.decrypt, note.student.fullNameEnc, 'student PII'),
        yearGroup: note.student.yearGroup,
      },
      author: {
        id: note.createdById,
        fullName: decryptRequired(ctx.db.$enc.decrypt, note.createdBy.fullNameEnc, 'user PII'),
        role: note.createdBy.role,
      },
      body: decryptRequired(ctx.db.$enc.decrypt, note.noteEnc, 'child note'),
      category: 'Sensitive note',
      type: 'Note',
      meritDelta: 0,
      createdAt: note.createdAt,
      seenAt: note.seenAt,
      seenByName: note.seenBy
        ? decryptRequired(ctx.db.$enc.decrypt, note.seenBy.fullNameEnc, 'user PII')
        : null,
      headComment: decryptOptional(ctx.db.$enc.decrypt, note.headCommentEnc),
    }));
    const markItems = reviewMarks.map((mark) => ({
      id: mark.id,
      kind: 'mark' as const,
      student: {
        id: mark.student.id,
        fullName: decryptRequired(ctx.db.$enc.decrypt, mark.student.fullNameEnc, 'student PII'),
        yearGroup: mark.student.yearGroup,
      },
      author: {
        id: mark.recordedById,
        fullName: decryptRequired(ctx.db.$enc.decrypt, mark.recordedBy.fullNameEnc, 'user PII'),
        role: mark.recordedBy.role,
      },
      body: decryptOptional(ctx.db.$enc.decrypt, mark.noteEnc),
      category: mark.category,
      type: mark.type,
      meritDelta: mark.meritDelta,
      createdAt: mark.createdAt,
      seenAt: mark.seenAt,
      seenByName: mark.seenBy
        ? decryptRequired(ctx.db.$enc.decrypt, mark.seenBy.fullNameEnc, 'user PII')
        : null,
      headComment: decryptOptional(ctx.db.$enc.decrypt, mark.headCommentEnc),
      reviewReason: escalationIds.has(mark.id) ? 'Policy escalation' : 'Sensitive',
    }));

    return [...noteItems, ...markItems].sort(
      (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
    );
  }),

  reviewSensitiveItem: authedProcedure
    .input(reviewSensitiveItemInput)
    .mutation(async ({ ctx, input }) => {
      await requireCentreSnapshotWorkflow(ctx);
      const now = new Date();
      const comment = input.comment?.trim();
      const commentPatch =
        input.comment === undefined
          ? {}
          : { headCommentEnc: comment ? ctx.db.$enc.encrypt(comment) : null };

      if (input.kind === 'note') {
        const existing = await ctx.db.childNote.findUnique({
          where: { id: input.id },
          select: {
            id: true,
            studentId: true,
            sensitive: true,
            deletedAt: true,
            createdBy: { select: { role: true } },
          },
        });
        if (
          !existing ||
          existing.deletedAt !== null ||
          !existing.sensitive ||
          !['Supervisor', 'ClubsAdmin'].includes(existing.createdBy.role)
        ) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'sensitive note not found' });
        }

        const updated = await ctx.db.childNote.update({
          where: { id: input.id },
          data: { seenAt: now, seenById: ctx.user.id, ...commentPatch },
          select: { id: true, studentId: true, seenAt: true },
        });

        await ctx.db.auditLog.create({
          data: {
            userId: ctx.user.id,
            action: 'Update',
            entity: 'ChildNote',
            entityId: updated.id,
            meta: {
              source: 'childLog.reviewSensitiveItem',
              studentId: updated.studentId,
              commentChanged: input.comment !== undefined,
            },
          },
        });
        return { id: updated.id, kind: input.kind, seenAt: updated.seenAt };
      }

      const existing = await ctx.db.behaviourEntry.findUnique({
        where: { id: input.id },
        select: {
          id: true,
          category: true,
          createdAt: true,
          meritDelta: true,
          studentId: true,
          type: true,
          visibility: true,
          deletedAt: true,
          recordedBy: { select: { role: true } },
        },
      });
      let isPolicyEscalation = false;
      if (existing?.type === 'Demerit') {
        const from = normalizeDate(existing.createdAt);
        const to = dayEnd(existing.createdAt);
        const dayDemerits = await ctx.db.behaviourEntry.findMany({
          where: {
            studentId: existing.studentId,
            type: 'Demerit',
            deletedAt: null,
            createdAt: { gte: from, lt: to },
          },
          select: {
            category: true,
            createdAt: true,
            id: true,
            meritDelta: true,
            studentId: true,
            type: true,
          },
          orderBy: { createdAt: 'asc' },
        });
        isPolicyEscalation = demeritPolicyEscalationEntryIds(dayDemerits).has(existing.id);
      }
      if (
        !existing ||
        existing.deletedAt !== null ||
        (!(
          existing.visibility === 'Sensitive' &&
          ['Supervisor', 'ClubsAdmin'].includes(existing.recordedBy.role)
        ) &&
          !isPolicyEscalation)
      ) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'sensitive mark not found' });
      }

      const updated = await ctx.db.behaviourEntry.update({
        where: { id: input.id },
        data: { seenAt: now, seenById: ctx.user.id, ...commentPatch },
        select: { id: true, studentId: true, seenAt: true },
      });

      await ctx.db.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'Update',
          entity: 'BehaviourEntry',
          entityId: updated.id,
          meta: {
            source: 'childLog.reviewSensitiveItem',
            studentId: updated.studentId,
            commentChanged: input.comment !== undefined,
          },
        },
      });
      return { id: updated.id, kind: input.kind, seenAt: updated.seenAt };
    }),

  supervisorNotesHistory: authedProcedure.query(async ({ ctx }) => {
    await requireSnapshotWorkflow(ctx);
    if (!isStaff(ctx.user)) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'notes history requires staff access' });
    }
    const scope = await loadDailyYearBandScope(ctx, new Date());
    const scopeWhere = studentWhereForDailyScope(scope);
    const students = await ctx.db.student.findMany({
      where: { active: true, ...scopeWhere },
      select: { id: true, fullNameEnc: true, yearGroup: true },
      orderBy: { createdAt: 'desc' },
    });
    const studentIds = students.map((student) => student.id);
    const studentById = new Map(students.map((student) => [student.id, student]));
    if (studentIds.length === 0) return [];

    const supervisorAuthorRoles: Role[] = ['Supervisor', 'ClubsAdmin'];
    const noteWhere: Prisma.ChildNoteWhereInput = {
      studentId: { in: studentIds },
      deletedAt: null,
      ...(isFullAdmin(ctx.user)
        ? {
            OR: [
              { createdById: ctx.user.id },
              { createdBy: { role: { in: supervisorAuthorRoles } } },
            ],
          }
        : { createdById: ctx.user.id }),
    };
    const markWhere: Prisma.BehaviourEntryWhereInput = {
      studentId: { in: studentIds },
      visibility: 'Sensitive',
      ...visibleBehaviourWhere(ctx.user),
    };

    const [notes, marks] = await Promise.all([
      ctx.db.childNote.findMany({
        where: noteWhere,
        include: supervisorNotesHistoryNoteInclude,
        orderBy: { createdAt: 'desc' },
      }),
      ctx.withRls((tx) =>
        tx.behaviourEntry.findMany({
          where: markWhere,
          include: supervisorNotesHistoryMarkInclude,
          orderBy: { createdAt: 'desc' },
        }),
      ),
    ]);

    const studentMap = new Map<
      string,
      {
        fullName: string;
        id: string;
        latestAt: Date;
        notes: Array<{
          id: string;
          kind: 'note' | 'mark';
          body: string | null;
          category: string;
          type: string;
          meritDelta: number;
          sensitive: boolean;
          createdAt: Date;
          seenAt: Date | null;
          seenByName: string | null;
          headComment: string | null;
          author: { id: string; fullName: string; role: string };
        }>;
        yearGroup: string;
      }
    >();

    function ensureStudent(
      student: { id: string; fullNameEnc: string; yearGroup: string },
      date: Date,
    ) {
      const existing = studentMap.get(student.id);
      if (existing) {
        if (date.getTime() > existing.latestAt.getTime()) existing.latestAt = date;
        return existing;
      }
      const row = {
        id: student.id,
        fullName: decryptRequired(ctx.db.$enc.decrypt, student.fullNameEnc, 'student PII'),
        yearGroup: student.yearGroup,
        latestAt: date,
        notes: [],
      };
      studentMap.set(student.id, row);
      return row;
    }

    for (const note of notes) {
      const student = studentById.get(note.studentId);
      if (!student) continue;
      ensureStudent(student, note.createdAt).notes.push({
        id: note.id,
        kind: 'note',
        body: decryptRequired(ctx.db.$enc.decrypt, note.noteEnc, 'child note'),
        category: note.sensitive ? 'Sensitive note' : 'Supervisor note',
        type: 'Note',
        meritDelta: 0,
        sensitive: note.sensitive,
        createdAt: note.createdAt,
        seenAt: note.seenAt,
        seenByName: note.seenBy
          ? decryptRequired(ctx.db.$enc.decrypt, note.seenBy.fullNameEnc, 'user PII')
          : null,
        headComment: decryptOptional(ctx.db.$enc.decrypt, note.headCommentEnc),
        author: {
          id: note.createdBy.id,
          fullName: decryptRequired(ctx.db.$enc.decrypt, note.createdBy.fullNameEnc, 'user PII'),
          role: note.createdBy.role,
        },
      });
    }

    for (const mark of marks) {
      const student = studentById.get(mark.studentId);
      if (!student) continue;
      ensureStudent(student, mark.createdAt).notes.push({
        id: mark.id,
        kind: 'mark',
        body: decryptOptional(ctx.db.$enc.decrypt, mark.noteEnc),
        category: mark.category,
        type: mark.type,
        meritDelta: mark.meritDelta,
        sensitive: true,
        createdAt: mark.createdAt,
        seenAt: mark.seenAt,
        seenByName: mark.seenBy
          ? decryptRequired(ctx.db.$enc.decrypt, mark.seenBy.fullNameEnc, 'user PII')
          : null,
        headComment: decryptOptional(ctx.db.$enc.decrypt, mark.headCommentEnc),
        author: {
          id: mark.recordedBy.id,
          fullName: decryptRequired(ctx.db.$enc.decrypt, mark.recordedBy.fullNameEnc, 'user PII'),
          role: mark.recordedBy.role,
        },
      });
    }

    await ctx.db.auditLog.create({
      data: {
        userId: ctx.user.id,
        action: 'DecryptPii',
        entity: 'SupervisorNotesHistory',
        meta: {
          source: 'childLog.supervisorNotesHistory',
          noteCount: notes.length,
          markCount: marks.length,
        },
      },
    });

    return [...studentMap.values()]
      .map((student) => ({
        ...student,
        notes: student.notes.sort(
          (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
        ),
      }))
      .sort((left, right) => right.latestAt.getTime() - left.latestAt.getTime());
  }),
});
