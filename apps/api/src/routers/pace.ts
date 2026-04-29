import { TRPCError } from '@trpc/server';
import { isStaff, paceRecordInput } from '@oasis/domain';
import { authedProcedure, router } from '../trpc.js';

const DEFAULT_POLICY = {
  dailyTestLimitEnabled: false,
  maxTestsPerStudentPerDay: 2,
  samePaceSameDayBlockEnabled: true,
  passThreshold: 80,
};

function utcDayBounds(date: Date): { dayKey: string; dayStart: Date; dayEnd: Date } {
  const dayKey = date.toISOString().slice(0, 10);
  const dayStart = new Date(`${dayKey}T00:00:00.000Z`);
  const dayEnd = new Date(dayStart);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
  return { dayKey, dayStart, dayEnd };
}

export const paceRouter = router({
  forStudent: authedProcedure
    .input(paceRecordInput.pick({ studentId: true }))
    .query(async ({ ctx, input }) => {
      if (!isStaff(ctx.user)) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'PACE progress requires full-admin or Supervisor',
        });
      }

      const student = await ctx.db.student.findUnique({
        where: { id: input.studentId },
        select: {
          id: true,
          active: true,
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
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'student is not active' });
      }

      const storedPolicy = await ctx.db.pacePolicy.findUnique({ where: { id: 'default' } });
      const policy = storedPolicy ?? DEFAULT_POLICY;
      const { dayKey, dayStart, dayEnd } = utcDayBounds(new Date());

      const todayCount = await ctx.db.paceRecord.count({
        where: {
          studentId: input.studentId,
          completedAt: { gte: dayStart, lt: dayEnd },
        },
      });

      const subjects = await Promise.all(
        student.subjects.map(async (assignment) => {
          const recentRecords = await ctx.db.paceRecord.findMany({
            where: {
              studentId: input.studentId,
              subjectId: assignment.subjectId,
              OR: [{ selfTestScore: { not: null } }, { paceTestScore: { not: null } }],
            },
            orderBy: [{ completedAt: 'desc' }, { createdAt: 'desc' }],
            take: 5,
            select: {
              id: true,
              paceNumber: true,
              selfTestScore: true,
              paceTestScore: true,
              completedAt: true,
              createdAt: true,
            },
          });

          return {
            subjectId: assignment.subjectId,
            code: assignment.subject.code,
            name: assignment.subject.name,
            active: assignment.subject.active,
            currentPaceNumber: assignment.currentPaceNumber,
            recentRecords: recentRecords.map((record) => {
              const isSelfTest = record.selfTestScore !== null;
              const score = record.selfTestScore ?? record.paceTestScore;
              if (score === null) {
                throw new TRPCError({
                  code: 'INTERNAL_SERVER_ERROR',
                  message: 'PACE record has no score',
                });
              }
              return {
                id: record.id,
                paceNumber: record.paceNumber,
                testType: isSelfTest ? ('SelfTest' as const) : ('FinalTest' as const),
                score,
                completedAt: record.completedAt,
                createdAt: record.createdAt,
              };
            }),
          };
        }),
      );

      const remaining = policy.dailyTestLimitEnabled
        ? Math.max(policy.maxTestsPerStudentPerDay - todayCount, 0)
        : null;

      return {
        studentId: student.id,
        subjects,
        today: {
          date: dayKey,
          testCount: todayCount,
        },
        policy: {
          dailyTestLimitEnabled: policy.dailyTestLimitEnabled,
          maxTestsPerStudentPerDay: policy.maxTestsPerStudentPerDay,
          samePaceSameDayBlockEnabled: policy.samePaceSameDayBlockEnabled,
          passThreshold: policy.passThreshold,
        },
        warnings: {
          dailyLimitEnabled: policy.dailyTestLimitEnabled,
          count: todayCount,
          limit: policy.maxTestsPerStudentPerDay,
          remaining,
          atLimit: policy.dailyTestLimitEnabled && todayCount >= policy.maxTestsPerStudentPerDay,
        },
      };
    }),

  record: authedProcedure.input(paceRecordInput).mutation(async ({ ctx, input }) => {
    if (!isStaff(ctx.user)) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'PACE recording requires full-admin or Supervisor',
      });
    }

    const { studentId, subjectId, paceNumber, testType, score, completedAt } = input;
    const recordedAt = completedAt ?? new Date();

    // Validate active student
    const student = await ctx.db.student.findUnique({
      where: { id: studentId },
      select: { id: true, active: true },
    });
    if (!student) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'student not found' });
    }
    if (!student.active) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'student is not active' });
    }

    // Validate active subject
    const subject = await ctx.db.subject.findUnique({
      where: { id: subjectId },
      select: { id: true, active: true },
    });
    if (!subject) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'subject not found' });
    }
    if (!subject.active) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'subject is not active' });
    }

    // Validate student is assigned to this subject
    const assignment = await ctx.db.studentSubject.findUnique({
      where: { studentId_subjectId: { studentId, subjectId } },
      select: { id: true, currentPaceNumber: true },
    });
    if (!assignment) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'student is not assigned to this subject',
      });
    }

    // Load effective policy
    const storedPolicy = await ctx.db.pacePolicy.findUnique({ where: { id: 'default' } });
    const policy = storedPolicy ?? DEFAULT_POLICY;

    // Day boundary for policy checks, based on the recorded completion date.
    const { dayStart, dayEnd } = utcDayBounds(recordedAt);

    // Daily limit check
    if (policy.dailyTestLimitEnabled) {
      const todayCount = await ctx.db.paceRecord.count({
        where: {
          studentId,
          completedAt: { gte: dayStart, lt: dayEnd },
        },
      });
      if (todayCount >= policy.maxTestsPerStudentPerDay) {
        await ctx.db.auditLog.create({
          data: {
            userId: ctx.user.id,
            action: 'PermissionDenied',
            entity: 'PaceRecord',
            meta: {
              reason: 'daily-test-limit',
              studentId,
              subjectId,
              paceNumber,
              testType,
              todayCount,
              limit: policy.maxTestsPerStudentPerDay,
            },
          },
        });
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `daily test limit of ${String(policy.maxTestsPerStudentPerDay)} reached`,
        });
      }
    }

    // Same-pace same-day self/final block
    if (policy.samePaceSameDayBlockEnabled) {
      const oppositeType = testType === 'SelfTest' ? 'FinalTest' : 'SelfTest';
      const oppositeScore =
        oppositeType === 'SelfTest' ? { selfTestScore: { not: null } } : { paceTestScore: { not: null } };
      const sameDay = await ctx.db.paceRecord.findFirst({
        where: {
          studentId,
          subjectId,
          paceNumber,
          completedAt: { gte: dayStart, lt: dayEnd },
          ...oppositeScore,
        },
        select: { id: true },
      });
      if (sameDay) {
        await ctx.db.auditLog.create({
          data: {
            userId: ctx.user.id,
            action: 'PermissionDenied',
            entity: 'PaceRecord',
            meta: {
              reason: 'same-pace-same-day-block',
              studentId,
              subjectId,
              paceNumber,
              testType,
              blockedBy: oppositeType,
            },
          },
        });
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `cannot record ${testType} for the same PACE number on the same day as a ${oppositeType}`,
        });
      }
    }

    // Write PaceRecord and conditionally advance currentPaceNumber in one transaction
    const selfTestScore = testType === 'SelfTest' ? score : undefined;
    const paceTestScore = testType === 'FinalTest' ? score : undefined;

    const isPassing = testType === 'FinalTest' && score >= policy.passThreshold;
    const shouldAdvance = isPassing && paceNumber >= assignment.currentPaceNumber;

    const [record] = await ctx.db.$transaction(async (tx) => {
      const created = await tx.paceRecord.create({
        data: {
          studentId,
          subjectId,
          paceNumber,
          selfTestScore: selfTestScore ?? null,
          paceTestScore: paceTestScore ?? null,
          completedAt: recordedAt,
          recordedById: ctx.user.id,
        },
        select: {
          id: true,
          studentId: true,
          subjectId: true,
          paceNumber: true,
          selfTestScore: true,
          paceTestScore: true,
          completedAt: true,
          createdAt: true,
        },
      });

      if (shouldAdvance) {
        await tx.studentSubject.update({
          where: { studentId_subjectId: { studentId, subjectId } },
          data: { currentPaceNumber: paceNumber + 1 },
        });
      }

      return [created] as const;
    });

    await ctx.db.auditLog.create({
      data: {
        userId: ctx.user.id,
        action: 'Create',
        entity: 'PaceRecord',
        entityId: record.id,
        meta: {
          studentId,
          subjectId,
          paceNumber,
          testType,
          score,
          advanced: shouldAdvance,
          ...(shouldAdvance ? { newPaceNumber: paceNumber + 1 } : {}),
        },
      },
    });

    if (shouldAdvance) {
      await ctx.db.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'Update',
          entity: 'StudentSubject',
          entityId: assignment.id,
          meta: {
            studentId,
            subjectId,
            previousPaceNumber: assignment.currentPaceNumber,
            newPaceNumber: paceNumber + 1,
            triggeredBy: record.id,
          },
        },
      });
    }

    return {
      ...record,
      advanced: shouldAdvance,
      newPaceNumber: shouldAdvance ? paceNumber + 1 : undefined,
    };
  }),
});
