import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import {
  canUseFullPaceAccess,
  canonicalSchoolYear,
  displaySchoolYearLabel,
  isStaff,
  paceProgressStatusForYear,
  paceRecordInput,
  schoolYearStorageAliases,
  type SessionUser,
} from '@oasis/domain';
import type { AppContext } from '../context.js';
import { authedProcedure, router } from '../trpc.js';

const DEFAULT_POLICY = {
  dailyTestLimitEnabled: false,
  maxTestsPerStudentPerDay: 2,
  samePaceSameDayBlockEnabled: true,
  passThreshold: 80,
};

type AuthedContext = AppContext & { user: SessionUser };

const paceRosterInput = z
  .object({
    date: z.coerce.date().optional(),
  })
  .optional();

const paceForStudentInput = paceRecordInput
  .pick({ studentId: true })
  .extend({ date: z.coerce.date().optional() });

function utcDayBounds(date: Date): { dayKey: string; dayStart: Date; dayEnd: Date } {
  const dayKey = date.toISOString().slice(0, 10);
  const dayStart = new Date(`${dayKey}T00:00:00.000Z`);
  const dayEnd = new Date(dayStart);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
  return { dayKey, dayStart, dayEnd };
}

function normalizeDate(date: Date): Date {
  return new Date(`${date.toISOString().slice(0, 10)}T00:00:00.000Z`);
}

function dateKey(date: Date): string {
  return normalizeDate(date).toISOString().slice(0, 10);
}

function canUsePaceWorkflow(user: SessionUser): boolean {
  return isStaff(user) || canUseFullPaceAccess(user);
}

function decryptRequired(
  decrypt: (value: string | null | undefined) => string | null,
  value: string,
  entity: string,
): string {
  const decrypted = decrypt(value);
  if (!decrypted) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `${entity} PII decrypt failed` });
  }
  return decrypted;
}

async function denyPaceAccess(
  ctx: AuthedContext,
  entity: string,
  message: string,
  meta: Record<string, unknown>,
): Promise<never> {
  await ctx.db.auditLog.create({
    data: {
      userId: ctx.user.id,
      action: 'PermissionDenied',
      entity,
      meta: { ...meta, role: ctx.user.role, reason: message },
    },
  });
  throw new TRPCError({ code: 'FORBIDDEN', message });
}

type PaceBand = {
  id: string;
  name: string;
  standardYears: string[];
  colour: string;
};

type PaceScope = {
  assignedBands: PaceBand[];
  dayKey: string;
  fullAccess: boolean;
  rowBands: PaceBand[];
  scopedYears: Set<string> | null;
  selectedDate: Date;
};

function uniqueBands(bands: readonly (PaceBand & { active?: boolean })[]): PaceBand[] {
  const seen = new Set<string>();
  const result: PaceBand[] = [];
  for (const band of bands) {
    if (band.active === false || seen.has(band.id)) continue;
    seen.add(band.id);
    result.push({
      id: band.id,
      name: band.name,
      standardYears: band.standardYears,
      colour: band.colour,
    });
  }
  return result;
}

function bandForYear(yearGroup: string, bands: readonly PaceBand[]): PaceBand | null {
  const canonical = canonicalSchoolYear(yearGroup);
  return (
    bands.find(
      (band) =>
        band.standardYears.includes(yearGroup) ||
        (canonical !== null && band.standardYears.includes(canonical)),
    ) ?? null
  );
}

function effectivePaceRecordTime(record: { completedAt: Date | null; createdAt: Date }): number {
  return (record.completedAt ?? record.createdAt).getTime();
}

async function loadPaceScope(
  ctx: AuthedContext,
  inputDate: Date | undefined,
  entity: string,
): Promise<PaceScope> {
  if (!canUsePaceWorkflow(ctx.user)) {
    await denyPaceAccess(ctx, entity, 'PACE workflow requires staff or full PACE access', {});
  }

  const fullAccess = canUseFullPaceAccess(ctx.user);
  const today = normalizeDate(new Date());
  const selectedDate = fullAccess ? normalizeDate(inputDate ?? today) : today;
  if (!fullAccess && inputDate && dateKey(inputDate) !== dateKey(today)) {
    await denyPaceAccess(ctx, entity, 'Supervisor PACE access is limited to today', {
      requestedDate: dateKey(inputDate),
      today: dateKey(today),
    });
  }

  const rowBands = uniqueBands(
    await ctx.db.yearGroupBand.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, standardYears: true, colour: true, active: true },
    }),
  );

  if (fullAccess) {
    return {
      assignedBands: [],
      dayKey: dateKey(selectedDate),
      fullAccess,
      rowBands,
      scopedYears: null,
      selectedDate,
    };
  }

  const shifts = await ctx.db.staffShift.findMany({
    where: {
      staffUserId: ctx.user.id,
      date: selectedDate,
    },
    orderBy: [{ startsAt: 'asc' }],
    select: {
      yearGroupBand: {
        select: {
          id: true,
          name: true,
          standardYears: true,
          colour: true,
          active: true,
        },
      },
    },
  });
  const assignedBands = uniqueBands(shifts.map((shift) => shift.yearGroupBand));

  return {
    assignedBands,
    dayKey: dateKey(selectedDate),
    fullAccess,
    rowBands,
    scopedYears: new Set(
      assignedBands.flatMap((band) =>
        band.standardYears.flatMap((year) => schoolYearStorageAliases(year)),
      ),
    ),
    selectedDate,
  };
}

async function assertStudentInPaceScope(
  ctx: AuthedContext,
  scope: PaceScope,
  student: { id: string; yearGroup: string },
  entity: string,
): Promise<void> {
  const canonicalYearGroup = canonicalSchoolYear(student.yearGroup);
  if (
    scope.fullAccess ||
    scope.scopedYears?.has(student.yearGroup) ||
    (canonicalYearGroup !== null && scope.scopedYears?.has(canonicalYearGroup))
  ) {
    return;
  }

  await denyPaceAccess(ctx, entity, "Student is outside today's assigned PACE scope", {
    studentId: student.id,
    studentYearGroup: student.yearGroup,
    assignedBands: scope.assignedBands.map((band) => band.id),
    date: scope.dayKey,
  });
}

export const paceRouter = router({
  roster: authedProcedure.input(paceRosterInput).query(async ({ ctx, input }) => {
    const scope = await loadPaceScope(ctx, input?.date, 'pace.roster');
    const scopedYears = scope.scopedYears ? [...scope.scopedYears] : null;
    const students =
      scopedYears && scopedYears.length === 0
        ? []
        : await ctx.db.student.findMany({
            where: {
              active: true,
              ...(scopedYears ? { yearGroup: { in: scopedYears } } : {}),
            },
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              fullNameEnc: true,
              yearGroup: true,
            },
          });

    const rows = students.map((student) => {
      const band = bandForYear(student.yearGroup, scope.rowBands);
      const canonicalYearGroup = canonicalSchoolYear(student.yearGroup) ?? student.yearGroup;
      return {
        studentId: student.id,
        studentName: decryptRequired(ctx.db.$enc.decrypt, student.fullNameEnc, 'student'),
        yearGroup: canonicalYearGroup,
        yearGroupLabel: displaySchoolYearLabel(student.yearGroup),
        band: band
          ? {
              id: band.id,
              name: band.name,
              colour: band.colour,
            }
          : null,
      };
    });

    await ctx.db.auditLog.create({
      data: {
        userId: ctx.user.id,
        action: 'DecryptPii',
        entity: 'Student',
        meta: { count: rows.length, source: 'pace.roster', date: scope.dayKey },
      },
    });

    return {
      fullAccess: scope.fullAccess,
      date: scope.dayKey,
      assignedBands: scope.assignedBands.map((band) => ({
        id: band.id,
        name: band.name,
        colour: band.colour,
        standardYears: band.standardYears,
      })),
      students: rows,
    };
  }),

  forStudent: authedProcedure
    .input(paceForStudentInput)
    .query(async ({ ctx, input }) => {
      const scope = await loadPaceScope(ctx, input.date, 'pace.forStudent');

      const student = await ctx.db.student.findUnique({
        where: { id: input.studentId },
        select: {
          id: true,
          active: true,
          fullNameEnc: true,
          yearGroup: true,
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
      await assertStudentInPaceScope(ctx, scope, student, 'pace.forStudent');

      const storedPolicy = await ctx.db.pacePolicy.findUnique({ where: { id: 'default' } });
      const policy = storedPolicy ?? DEFAULT_POLICY;
      const { dayKey, dayStart, dayEnd } = utcDayBounds(scope.selectedDate);

      const todayCount = await ctx.db.paceRecord.count({
        where: {
          studentId: input.studentId,
          completedAt: { gte: dayStart, lt: dayEnd },
        },
      });

      const subjectIds = student.subjects.map((assignment) => assignment.subjectId);
      const fetchedRecords =
        subjectIds.length === 0
          ? []
          : await ctx.db.paceRecord.findMany({
              where: {
                studentId: input.studentId,
                subjectId: { in: subjectIds },
                OR: [{ selfTestScore: { not: null } }, { paceTestScore: { not: null } }],
              },
              orderBy: [{ completedAt: 'desc' }, { createdAt: 'desc' }],
              select: {
                id: true,
                subjectId: true,
                paceNumber: true,
                selfTestScore: true,
                paceTestScore: true,
                completedAt: true,
                createdAt: true,
              },
            });
      const recentRecords = [...fetchedRecords].sort((left, right) => {
        const timeDifference = effectivePaceRecordTime(right) - effectivePaceRecordTime(left);
        if (timeDifference !== 0) return timeDifference;
        return right.createdAt.getTime() - left.createdAt.getTime();
      });
      const recordsBySubject = new Map<string, typeof recentRecords>();
      for (const record of recentRecords) {
        const subjectRecords = recordsBySubject.get(record.subjectId) ?? [];
        subjectRecords.push(record);
        recordsBySubject.set(record.subjectId, subjectRecords);
      }

      const subjects = student.subjects.map((assignment) => {
        const records = recordsBySubject.get(assignment.subjectId) ?? [];
        const latestSelfTest = records.find((record) => record.selfTestScore !== null) ?? null;
        const latestFinalTest = records.find((record) => record.paceTestScore !== null) ?? null;
        const latestRecord = records[0] ?? null;
        const status = paceProgressStatusForYear(assignment.currentPaceNumber, student.yearGroup);
        const recentRecordDtos = records.slice(0, 5).map((record) => {
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
        });

        return {
          subjectId: assignment.subjectId,
          code: assignment.subject.code,
          name: assignment.subject.name,
          active: assignment.subject.active,
          currentPaceNumber: assignment.currentPaceNumber,
          latestSelfTest: latestSelfTest
            ? {
                paceNumber: latestSelfTest.paceNumber,
                score: latestSelfTest.selfTestScore,
                completedAt: latestSelfTest.completedAt,
                createdAt: latestSelfTest.createdAt,
              }
            : null,
          latestFinalTest: latestFinalTest
            ? {
                paceNumber: latestFinalTest.paceNumber,
                score: latestFinalTest.paceTestScore,
                completedAt: latestFinalTest.completedAt,
                createdAt: latestFinalTest.createdAt,
              }
            : null,
          latestCompletedAt: latestRecord?.completedAt ?? latestRecord?.createdAt ?? null,
          status,
          recentRecords: recentRecordDtos,
        };
      });

      const remaining = policy.dailyTestLimitEnabled
        ? Math.max(policy.maxTestsPerStudentPerDay - todayCount, 0)
        : null;
      const studentName = decryptRequired(ctx.db.$enc.decrypt, student.fullNameEnc, 'student');

      await ctx.db.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'DecryptPii',
          entity: 'Student',
          entityId: student.id,
          meta: { count: 1, source: 'pace.forStudent', date: scope.dayKey },
        },
      });

      return {
        studentId: student.id,
        studentName,
        yearGroup: canonicalSchoolYear(student.yearGroup) ?? student.yearGroup,
        yearGroupLabel: displaySchoolYearLabel(student.yearGroup),
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
    const { studentId, subjectId, paceNumber, testType, score, completedAt } = input;
    const recordedAt = completedAt ?? new Date();
    const scope = await loadPaceScope(ctx, recordedAt, 'pace.record');

    // Validate active student
    const student = await ctx.db.student.findUnique({
      where: { id: studentId },
      select: { id: true, active: true, yearGroup: true },
    });
    if (!student) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'student not found' });
    }
    if (!student.active) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'student is not active' });
    }
    await assertStudentInPaceScope(ctx, scope, student, 'pace.record');

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
