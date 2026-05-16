import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import {
  AccessDeniedError,
  canUseAllStudentSupervisorWorkflow,
  canUseFullPaceAccess,
  canonicalSchoolYear,
  displaySchoolYearLabel,
  isStaff,
  paceProgressStatusForYear,
  paceRecordInput,
  paceUpdateRecordInput,
  requireSelfStudent,
  rowsForMerit,
  schoolYearStorageAliases,
  type SessionUser,
} from '@oasis/domain';
import type { AppContext, RlsTx } from '../context.js';
import { authedProcedure, fullAdminProcedure, router } from '../trpc.js';

const DEFAULT_POLICY = {
  dailyTestLimitEnabled: false,
  maxTestsPerStudentPerDay: 2,
  samePaceSameDayBlockEnabled: true,
  passThreshold: 80,
};
const AUTOMATIC_PACE_MERIT_CATEGORY = 'Academic Excellence';

type AuthedContext = AppContext & { user: SessionUser };
type PaceTestType = 'SelfTest' | 'FinalTest';
type PaceProgressLifecycle = {
  id: string;
  finalTestAttempts: number;
  completedAt: Date | null;
};

const paceRosterInput = z
  .object({
    date: z.coerce.date().optional(),
  })
  .optional();

const paceForStudentInput = paceRecordInput
  .pick({ studentId: true })
  .extend({ date: z.coerce.date().optional() });
const paceRecordByIdInput = z.object({ recordId: z.string().trim().min(1) });
const paceApprovalInput = paceRecordByIdInput.extend({
  notes: z.string().trim().min(1).max(3000),
});

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

function canUseFullPaceWorkflowAccess(user: SessionUser): boolean {
  return canUseFullPaceAccess(user) || canUseAllStudentSupervisorWorkflow(user);
}

function canEditPaceWorkflowDate(user: SessionUser): boolean {
  return user.role === 'Supervisor' || canUseFullPaceAccess(user);
}

function meritsForPaceScore(testType: PaceTestType, score: number): number {
  if (testType === 'FinalTest') {
    if (score === 100) return 10;
    if (score >= 90) return 5;
    if (score >= 80) return 1;
    return 0;
  }

  if (score === 100) return 3;
  if (score >= 90) return 2;
  if (score >= 80) return 1;
  return 0;
}

function automaticPaceMeritCategory(testType: PaceTestType, score: number): string {
  const testTypeLabel = testType === 'FinalTest' ? 'PACE Test' : 'Self-Test';
  return `${AUTOMATIC_PACE_MERIT_CATEGORY} - ${testTypeLabel} ${String(score)}`;
}

function testTypeForRecord(record: {
  selfTestScore: number | null;
  paceTestScore: number | null;
}): PaceTestType {
  if (record.selfTestScore !== null) return 'SelfTest';
  if (record.paceTestScore !== null) return 'FinalTest';
  throw new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: 'PACE record has no score',
  });
}

function scoreForRecord(record: {
  selfTestScore: number | null;
  paceTestScore: number | null;
}): number {
  const score = record.selfTestScore ?? record.paceTestScore;
  if (score === null) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'PACE record has no score',
    });
  }
  return score;
}

function scoreDataForTestType(
  testType: PaceTestType,
  score: number,
): { selfTestScore: number | null; paceTestScore: number | null } {
  return testType === 'SelfTest'
    ? { selfTestScore: score, paceTestScore: null }
    : { selfTestScore: null, paceTestScore: score };
}

function mapApproval(
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
    approvedByName: decryptRequired(ctx.db.$enc.decrypt, approval.approvedBy.fullNameEnc, 'user'),
    approvedByRole: approval.approvedBy.role,
    notes: decryptRequired(ctx.db.$enc.decrypt, approval.notesEnc, 'approval notes'),
  };
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
  canEditDate: boolean;
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

function daysBetween(start: Date, end: Date): number {
  const days = (end.getTime() - start.getTime()) / 86_400_000;
  return Math.max(0, Math.round(days * 10) / 10);
}

function paceProgressKey(subjectId: string, paceNumber: number): string {
  return `${subjectId}:${String(paceNumber)}`;
}

async function ensurePaceProgressStarted(
  tx: RlsTx,
  params: {
    studentId: string;
    subjectId: string;
    paceNumber: number;
    startedAt: Date;
  },
): Promise<PaceProgressLifecycle> {
  const existing = await tx.paceProgress.findUnique({
    where: {
      studentId_subjectId_paceNumber: {
        studentId: params.studentId,
        subjectId: params.subjectId,
        paceNumber: params.paceNumber,
      },
    },
    select: { id: true, finalTestAttempts: true, completedAt: true },
  });
  if (existing) return existing;

  return tx.paceProgress.create({
    data: {
      studentId: params.studentId,
      subjectId: params.subjectId,
      paceNumber: params.paceNumber,
      startedAt: params.startedAt,
    },
    select: { id: true, finalTestAttempts: true, completedAt: true },
  });
}

async function syncAutomaticPaceMerit(
  tx: RlsTx,
  params: {
    studentId: string;
    paceRecordId: string;
    testType: PaceTestType;
    score: number;
    recordedById: string;
  },
): Promise<{
  behaviourEntryId: string;
  created: boolean;
  ledgerCorrectionRows: number;
} | null> {
  const awardedMerits = meritsForPaceScore(params.testType, params.score);
  const category = automaticPaceMeritCategory(params.testType, params.score);
  const existing = await tx.behaviourEntry.findFirst({
    where: { paceRecordId: params.paceRecordId, type: 'Merit' },
    include: {
      ledgerRows: { select: { account: true, delta: true, studentId: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  if (!existing && awardedMerits === 0) return null;

  if (!existing) {
    const behaviour = await tx.behaviourEntry.create({
      data: {
        studentId: params.studentId,
        type: 'Merit',
        category,
        noteEnc: null,
        visibility: 'General',
        meritDelta: awardedMerits,
        recordedById: params.recordedById,
        paceRecordId: params.paceRecordId,
      },
      select: { id: true },
    });
    await tx.meritLedger.createMany({
      data: rowsForMerit({
        studentId: params.studentId,
        amount: awardedMerits,
        reason: category,
        behaviourEntryId: behaviour.id,
      }),
    });
    return { behaviourEntryId: behaviour.id, created: true, ledgerCorrectionRows: 1 };
  }

  const ledgerTotal = existing.ledgerRows.reduce((sum, row) => sum + row.delta, 0);
  const ledgerDelta = awardedMerits - ledgerTotal;
  await tx.behaviourEntry.update({
    where: { id: existing.id },
    data: {
      category,
      meritDelta: awardedMerits,
      deletedAt: awardedMerits === 0 ? new Date() : null,
      deletedById: awardedMerits === 0 ? params.recordedById : null,
    },
    select: { id: true },
  });

  if (ledgerDelta !== 0) {
    await tx.meritLedger.createMany({
      data: [
        {
          studentId: params.studentId,
          account: 'Spend',
          delta: ledgerDelta,
          reason: `correction:${category}`,
          relatedEntryId: existing.id,
        },
      ],
    });
  }

  return {
    behaviourEntryId: existing.id,
    created: false,
    ledgerCorrectionRows: ledgerDelta === 0 ? 0 : 1,
  };
}

async function reverseAutomaticPaceMerit(
  tx: RlsTx,
  params: { paceRecordId: string; deletedById: string },
): Promise<{ behaviourEntryId: string; correctionRows: number } | null> {
  const existing = await tx.behaviourEntry.findFirst({
    where: { paceRecordId: params.paceRecordId, type: 'Merit' },
    include: {
      ledgerRows: { select: { studentId: true, account: true, delta: true, reason: true } },
    },
    orderBy: { createdAt: 'asc' },
  });
  if (!existing || existing.deletedAt !== null) return null;

  const correctionRows = existing.ledgerRows
    .filter((row) => row.delta !== 0)
    .map((row) => ({
      studentId: row.studentId,
      account: row.account,
      delta: -row.delta,
      reason: `correction:delete:${row.reason}`,
      relatedEntryId: existing.id,
    }));

  await tx.behaviourEntry.update({
    where: { id: existing.id },
    data: { deletedAt: new Date(), deletedById: params.deletedById },
    select: { id: true },
  });

  if (correctionRows.length > 0) {
    await tx.meritLedger.createMany({ data: correctionRows });
  }

  return { behaviourEntryId: existing.id, correctionRows: correctionRows.length };
}

async function recalculatePaceLifecycle(
  tx: RlsTx,
  params: {
    assignmentCurrentPaceNumber: number;
    passThreshold: number;
    paceNumber: number;
    startedAt: Date;
    studentId: string;
    subjectId: string;
  },
): Promise<{ advanced: boolean; newPaceNumber: number | undefined }> {
  const currentProgress = await ensurePaceProgressStarted(tx, {
    studentId: params.studentId,
    subjectId: params.subjectId,
    paceNumber: params.paceNumber,
    startedAt: params.startedAt,
  });
  const records = await tx.paceRecord.findMany({
    where: {
      studentId: params.studentId,
      subjectId: params.subjectId,
      paceNumber: params.paceNumber,
      OR: [{ selfTestScore: { not: null } }, { paceTestScore: { not: null } }],
    },
    orderBy: [{ completedAt: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      paceTestScore: true,
      completedAt: true,
      createdAt: true,
      advancementApproval: { select: { id: true, approvedAt: true } },
    },
  });
  const finalTestAttempts = records.filter((record) => record.paceTestScore !== null).length;
  const passingFinal =
    records.find(
      (record) => record.paceTestScore !== null && record.paceTestScore >= params.passThreshold,
    ) ?? null;
  const approvedFinal =
    records.find(
      (record) => record.paceTestScore !== null && record.advancementApproval !== null,
    ) ?? null;
  const completion = passingFinal
    ? {
        completedAt: passingFinal.completedAt ?? passingFinal.createdAt,
        completedByApprovalId: null,
        completedByRecordId: passingFinal.id,
      }
    : approvedFinal?.advancementApproval
      ? {
          completedAt: approvedFinal.advancementApproval.approvedAt,
          completedByApprovalId: approvedFinal.advancementApproval.id,
          completedByRecordId: null,
        }
      : null;

  await tx.paceProgress.update({
    where: { id: currentProgress.id },
    data: {
      startedAt: params.startedAt,
      finalTestAttempts,
      completedAt: completion?.completedAt ?? null,
      completedByRecordId: completion?.completedByRecordId ?? null,
      completedByApprovalId: completion?.completedByApprovalId ?? null,
    },
  });

  if (completion && params.paceNumber >= params.assignmentCurrentPaceNumber) {
    const nextStartedAt = completion.completedAt;
    const nextProgress = await ensurePaceProgressStarted(tx, {
      studentId: params.studentId,
      subjectId: params.subjectId,
      paceNumber: params.paceNumber + 1,
      startedAt: nextStartedAt,
    });
    await tx.paceProgress.update({
      where: { id: nextProgress.id },
      data: { startedAt: nextStartedAt },
    });
    await tx.studentSubject.update({
      where: { studentId_subjectId: { studentId: params.studentId, subjectId: params.subjectId } },
      data: { currentPaceNumber: params.paceNumber + 1 },
    });
    return { advanced: true, newPaceNumber: params.paceNumber + 1 };
  }

  if (!passingFinal && params.assignmentCurrentPaceNumber === params.paceNumber + 1) {
    await tx.studentSubject.update({
      where: { studentId_subjectId: { studentId: params.studentId, subjectId: params.subjectId } },
      data: { currentPaceNumber: params.paceNumber },
    });
    return { advanced: false, newPaceNumber: params.paceNumber };
  }

  return { advanced: false, newPaceNumber: undefined };
}

async function loadPaceScope(
  ctx: AuthedContext,
  inputDate: Date | undefined,
  entity: string,
): Promise<PaceScope> {
  if (!canUsePaceWorkflow(ctx.user)) {
    await denyPaceAccess(ctx, entity, 'PACE workflow requires staff or full PACE access', {});
  }

  const fullAccess = canUseFullPaceWorkflowAccess(ctx.user);
  const canEditDate = canEditPaceWorkflowDate(ctx.user);
  const today = normalizeDate(new Date());
  const selectedDate = canEditDate ? normalizeDate(inputDate ?? today) : today;
  if (!canEditDate && inputDate && dateKey(inputDate) !== dateKey(today)) {
    await denyPaceAccess(ctx, entity, 'PACE access is limited to today', {
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
      canEditDate,
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
    canEditDate,
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

async function loadPaceScopeForStudentRead(
  ctx: AuthedContext,
  inputDate: Date | undefined,
  student: { id: string; userId: string | null; yearGroup: string },
  entity: string,
): Promise<PaceScope> {
  if (ctx.user.role !== 'Student') {
    const scope = await loadPaceScope(ctx, inputDate, entity);
    await assertStudentInPaceScope(ctx, scope, student, entity);
    return scope;
  }

  const today = normalizeDate(new Date());
  if (inputDate && dateKey(inputDate) !== dateKey(today)) {
    await denyPaceAccess(ctx, entity, 'PACE access is limited to today', {
      requestedDate: dateKey(inputDate),
      today: dateKey(today),
    });
  }

  try {
    requireSelfStudent(ctx.user, student.id, student.userId);
  } catch (err) {
    if (err instanceof AccessDeniedError) {
      await denyPaceAccess(ctx, entity, err.message, { studentId: student.id });
    }
    throw err;
  }

  return {
    assignedBands: [],
    canEditDate: false,
    dayKey: dateKey(today),
    fullAccess: false,
    rowBands: [],
    scopedYears: null,
    selectedDate: today,
  };
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
      canEditDate: scope.canEditDate,
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

  forStudent: authedProcedure.input(paceForStudentInput).query(async ({ ctx, input }) => {
    const student = await ctx.db.student.findUnique({
      where: { id: input.studentId },
      select: {
        id: true,
        userId: true,
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
    const scope = await loadPaceScopeForStudentRead(ctx, input.date, student, 'pace.forStudent');

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
          });
    const progressRows =
      subjectIds.length === 0
        ? []
        : await ctx.db.paceProgress.findMany({
            where: {
              studentId: input.studentId,
              subjectId: { in: subjectIds },
            },
            orderBy: [{ startedAt: 'desc' }, { createdAt: 'desc' }],
            select: {
              id: true,
              subjectId: true,
              paceNumber: true,
              startedAt: true,
              completedAt: true,
              finalTestAttempts: true,
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
    const progressBySubjectAndPace = new Map<string, (typeof progressRows)[number]>();
    const progressBySubject = new Map<string, typeof progressRows>();
    for (const row of progressRows) {
      progressBySubjectAndPace.set(paceProgressKey(row.subjectId, row.paceNumber), row);
      const subjectProgress = progressBySubject.get(row.subjectId) ?? [];
      subjectProgress.push(row);
      progressBySubject.set(row.subjectId, subjectProgress);
    }

    const subjects = student.subjects.map((assignment) => {
      const records = recordsBySubject.get(assignment.subjectId) ?? [];
      const currentPaceRecords = records.filter(
        (record) => record.paceNumber === assignment.currentPaceNumber,
      );
      const latestSelfTest =
        currentPaceRecords.find((record) => record.selfTestScore !== null) ?? null;
      const latestFinalTest =
        currentPaceRecords.find((record) => record.paceTestScore !== null) ?? null;
      const latestRecord = currentPaceRecords[0] ?? null;
      const currentProgress =
        progressBySubjectAndPace.get(
          paceProgressKey(assignment.subjectId, assignment.currentPaceNumber),
        ) ?? null;
      const completedProgress = (progressBySubject.get(assignment.subjectId) ?? []).filter(
        (row) => row.completedAt !== null,
      );
      const completionDurations = completedProgress.map((row) =>
        daysBetween(row.startedAt, row.completedAt ?? row.startedAt),
      );
      const averagePaceCompletionDays =
        completionDurations.length === 0
          ? null
          : Math.round(
              (completionDurations.reduce((sum, days) => sum + days, 0) /
                completionDurations.length) *
                10,
            ) / 10;
      const status = paceProgressStatusForYear(assignment.currentPaceNumber, student.yearGroup);
      const recentRecordDtos = records.slice(0, 5).map((record) => {
        const testType = testTypeForRecord(record);
        const score = scoreForRecord(record);
        const progress =
          progressBySubjectAndPace.get(paceProgressKey(record.subjectId, record.paceNumber)) ??
          null;
        return {
          id: record.id,
          paceNumber: record.paceNumber,
          testType,
          score,
          passed: score >= policy.passThreshold,
          approval: mapApproval(ctx, record.advancementApproval),
          completedAt: record.completedAt,
          createdAt: record.createdAt,
          startedAt: progress?.startedAt ?? null,
        };
      });
      const currentScoreRecord = latestRecord
        ? {
            id: latestRecord.id,
            paceNumber: latestRecord.paceNumber,
            testType: testTypeForRecord(latestRecord),
            score: scoreForRecord(latestRecord),
            passed: scoreForRecord(latestRecord) >= policy.passThreshold,
            approval: mapApproval(ctx, latestRecord.advancementApproval),
            completedAt: latestRecord.completedAt,
            createdAt: latestRecord.createdAt,
            startedAt: currentProgress?.startedAt ?? null,
          }
        : null;

      return {
        subjectId: assignment.subjectId,
        code: assignment.subject.code,
        name: assignment.subject.name,
        active: assignment.subject.active,
        currentPaceNumber: assignment.currentPaceNumber,
        currentPaceStartedAt: currentProgress?.startedAt ?? null,
        currentPaceDays:
          currentProgress === null
            ? null
            : daysBetween(currentProgress.startedAt, scope.selectedDate),
        currentFinalTestAttempts: currentProgress?.finalTestAttempts ?? 0,
        completedPaceCount: completedProgress.length,
        averagePaceCompletionDays,
        selfTestPaceNumbers: [
          ...new Set(
            records
              .filter((record) => record.selfTestScore !== null)
              .map((record) => record.paceNumber),
          ),
        ].sort((left, right) => left - right),
        latestSelfTest: latestSelfTest
          ? {
              id: latestSelfTest.id,
              paceNumber: latestSelfTest.paceNumber,
              testType: 'SelfTest' as const,
              score: scoreForRecord(latestSelfTest),
              passed: scoreForRecord(latestSelfTest) >= policy.passThreshold,
              approval: mapApproval(ctx, latestSelfTest.advancementApproval),
              completedAt: latestSelfTest.completedAt,
              createdAt: latestSelfTest.createdAt,
              startedAt: currentProgress?.startedAt ?? null,
            }
          : null,
        latestFinalTest: latestFinalTest
          ? {
              id: latestFinalTest.id,
              paceNumber: latestFinalTest.paceNumber,
              testType: 'FinalTest' as const,
              score: scoreForRecord(latestFinalTest),
              passed: scoreForRecord(latestFinalTest) >= policy.passThreshold,
              approval: mapApproval(ctx, latestFinalTest.advancementApproval),
              completedAt: latestFinalTest.completedAt,
              createdAt: latestFinalTest.createdAt,
              startedAt: currentProgress?.startedAt ?? null,
            }
          : null,
        currentScoreRecord,
        latestCompletedAt: latestFinalTest?.completedAt ?? null,
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

    if (testType === 'FinalTest') {
      const prerequisiteSelfTest = await ctx.db.paceRecord.findFirst({
        where: {
          studentId,
          subjectId,
          paceNumber,
          selfTestScore: { not: null },
        },
        select: { id: true },
      });
      if (!prerequisiteSelfTest) {
        await ctx.db.auditLog.create({
          data: {
            userId: ctx.user.id,
            action: 'PermissionDenied',
            entity: 'PaceRecord',
            meta: {
              reason: 'missing-self-test-prerequisite',
              studentId,
              subjectId,
              paceNumber,
              testType,
            },
          },
        });
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'cannot record PACE Test before a Self-Test for the same subject PACE number',
        });
      }
    }

    // Same-pace same-day self/final block
    if (policy.samePaceSameDayBlockEnabled) {
      const oppositeType = testType === 'SelfTest' ? 'FinalTest' : 'SelfTest';
      const oppositeScore =
        oppositeType === 'SelfTest'
          ? { selfTestScore: { not: null } }
          : { paceTestScore: { not: null } };
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
    const awardedMerits = meritsForPaceScore(testType, score);
    const automaticMeritCategory = automaticPaceMeritCategory(testType, score);

    const [record, automaticMerit] = await ctx.withRls(async (tx) => {
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

      const currentProgress = await ensurePaceProgressStarted(tx, {
        studentId,
        subjectId,
        paceNumber,
        startedAt: recordedAt,
      });
      if (testType === 'FinalTest') {
        await tx.paceProgress.update({
          where: { id: currentProgress.id },
          data: {
            finalTestAttempts: { increment: 1 },
            ...(isPassing && currentProgress.completedAt === null
              ? { completedAt: recordedAt, completedByRecordId: created.id }
              : {}),
          },
        });
      }

      let meritResult: { behaviourEntryId: string; ledgerRowCount: number } | null = null;
      if (awardedMerits > 0) {
        const behaviour = await tx.behaviourEntry.create({
          data: {
            studentId,
            type: 'Merit',
            category: automaticMeritCategory,
            noteEnc: null,
            visibility: 'General',
            meritDelta: awardedMerits,
            recordedById: ctx.user.id,
            paceRecordId: created.id,
          },
          select: { id: true },
        });
        const ledgerRows = rowsForMerit({
          studentId,
          amount: awardedMerits,
          reason: automaticMeritCategory,
          behaviourEntryId: behaviour.id,
        });
        await tx.meritLedger.createMany({ data: ledgerRows });
        meritResult = { behaviourEntryId: behaviour.id, ledgerRowCount: ledgerRows.length };
      }

      if (shouldAdvance) {
        await ensurePaceProgressStarted(tx, {
          studentId,
          subjectId,
          paceNumber: paceNumber + 1,
          startedAt: recordedAt,
        });
        await tx.studentSubject.update({
          where: { studentId_subjectId: { studentId, subjectId } },
          data: { currentPaceNumber: paceNumber + 1 },
        });
      }

      return [created, meritResult] as const;
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
          awardedMerits,
          ...(shouldAdvance ? { newPaceNumber: paceNumber + 1 } : {}),
        },
      },
    });

    if (automaticMerit) {
      await ctx.db.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'Create',
          entity: 'BehaviourEntry',
          entityId: automaticMerit.behaviourEntryId,
          meta: {
            studentId,
            type: 'Merit',
            visibility: 'General',
            meritDelta: awardedMerits,
            source: 'pace.record',
            paceRecordId: record.id,
          },
        },
      });
      await ctx.db.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'Create',
          entity: 'MeritLedger',
          meta: {
            studentId,
            behaviourEntryId: automaticMerit.behaviourEntryId,
            paceRecordId: record.id,
            rowCount: automaticMerit.ledgerRowCount,
            source: 'pace.record',
          },
        },
      });
    }

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
      awardedMerits,
      newPaceNumber: shouldAdvance ? paceNumber + 1 : undefined,
    };
  }),

  updateRecord: authedProcedure.input(paceUpdateRecordInput).mutation(async ({ ctx, input }) => {
    const scope = await loadPaceScope(ctx, input.completedAt, 'pace.updateRecord');
    if (!scope.canEditDate && dateKey(input.startedAt) !== scope.dayKey) {
      await denyPaceAccess(ctx, 'pace.updateRecord', 'PACE access is limited to today', {
        requestedStartedDate: dateKey(input.startedAt),
        today: scope.dayKey,
      });
    }

    const existing = await ctx.db.paceRecord.findUnique({
      where: { id: input.recordId },
      select: {
        id: true,
        studentId: true,
        subjectId: true,
        paceNumber: true,
        selfTestScore: true,
        paceTestScore: true,
        completedAt: true,
        createdAt: true,
        student: { select: { id: true, active: true, yearGroup: true } },
        subject: { select: { id: true, active: true } },
      },
    });
    if (!existing) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'PACE record not found' });
    }
    if (!existing.student.active) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'student is not active' });
    }
    if (!existing.subject.active) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'subject is not active' });
    }
    if (
      !scope.canEditDate &&
      dateKey(existing.completedAt ?? existing.createdAt) !== scope.dayKey
    ) {
      await denyPaceAccess(ctx, 'pace.updateRecord', 'PACE access is limited to today', {
        recordId: existing.id,
        existingDate: dateKey(existing.completedAt ?? existing.createdAt),
        today: scope.dayKey,
      });
    }
    await assertStudentInPaceScope(ctx, scope, existing.student, 'pace.updateRecord');

    const assignment = await ctx.db.studentSubject.findUnique({
      where: {
        studentId_subjectId: { studentId: existing.studentId, subjectId: existing.subjectId },
      },
      select: { id: true, currentPaceNumber: true },
    });
    if (!assignment) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'student is not assigned to this subject',
      });
    }

    const storedPolicy = await ctx.db.pacePolicy.findUnique({ where: { id: 'default' } });
    const policy = storedPolicy ?? DEFAULT_POLICY;
    const testType = testTypeForRecord(existing);
    const previousScore = scoreForRecord(existing);
    const { dayStart, dayEnd } = utcDayBounds(input.completedAt);

    if (policy.samePaceSameDayBlockEnabled) {
      const oppositeScore =
        testType === 'SelfTest'
          ? { paceTestScore: { not: null } }
          : { selfTestScore: { not: null } };
      const sameDay = await ctx.db.paceRecord.findFirst({
        where: {
          id: { not: existing.id },
          studentId: existing.studentId,
          subjectId: existing.subjectId,
          paceNumber: existing.paceNumber,
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
              studentId: existing.studentId,
              subjectId: existing.subjectId,
              paceNumber: existing.paceNumber,
              testType,
              blockedBy: testType === 'SelfTest' ? 'FinalTest' : 'SelfTest',
              recordId: existing.id,
            },
          },
        });
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `cannot update ${testType} for the same PACE number on the same day as the opposite test type`,
        });
      }
    }

    const [record, meritResult, lifecycle] = await ctx.withRls(async (tx) => {
      const updated = await tx.paceRecord.update({
        where: { id: existing.id },
        data: {
          ...scoreDataForTestType(testType, input.score),
          completedAt: input.completedAt,
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

      const nextLifecycle = await recalculatePaceLifecycle(tx, {
        assignmentCurrentPaceNumber: assignment.currentPaceNumber,
        passThreshold: policy.passThreshold,
        paceNumber: existing.paceNumber,
        startedAt: input.startedAt,
        studentId: existing.studentId,
        subjectId: existing.subjectId,
      });
      const nextMeritResult = await syncAutomaticPaceMerit(tx, {
        studentId: existing.studentId,
        paceRecordId: existing.id,
        testType,
        score: input.score,
        recordedById: ctx.user.id,
      });

      return [updated, nextMeritResult, nextLifecycle] as const;
    });

    const awardedMerits = meritsForPaceScore(testType, input.score);
    await ctx.db.auditLog.create({
      data: {
        userId: ctx.user.id,
        action: 'Update',
        entity: 'PaceRecord',
        entityId: record.id,
        meta: {
          studentId: existing.studentId,
          subjectId: existing.subjectId,
          paceNumber: existing.paceNumber,
          testType,
          previousScore,
          score: input.score,
          previousCompletedAt: existing.completedAt,
          completedAt: input.completedAt,
          startedAt: input.startedAt,
          awardedMerits,
          ledgerCorrectionRows: meritResult?.ledgerCorrectionRows ?? 0,
        },
      },
    });

    if (meritResult) {
      await ctx.db.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: meritResult.created ? 'Create' : 'Update',
          entity: 'BehaviourEntry',
          entityId: meritResult.behaviourEntryId,
          meta: {
            studentId: existing.studentId,
            type: 'Merit',
            visibility: 'General',
            meritDelta: awardedMerits,
            source: 'pace.updateRecord',
            paceRecordId: record.id,
            ledgerCorrectionRows: meritResult.ledgerCorrectionRows,
          },
        },
      });
    }

    if (lifecycle.newPaceNumber !== undefined) {
      await ctx.db.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'Update',
          entity: 'StudentSubject',
          entityId: assignment.id,
          meta: {
            studentId: existing.studentId,
            subjectId: existing.subjectId,
            previousPaceNumber: assignment.currentPaceNumber,
            newPaceNumber: lifecycle.newPaceNumber,
            triggeredBy: record.id,
            source: 'pace.updateRecord',
          },
        },
      });
    }

    return {
      ...record,
      advanced: lifecycle.advanced,
      awardedMerits,
      newPaceNumber: lifecycle.newPaceNumber,
    };
  }),

  deleteRecord: fullAdminProcedure.input(paceRecordByIdInput).mutation(async ({ ctx, input }) => {
    const existing = await ctx.db.paceRecord.findUnique({
      where: { id: input.recordId },
      select: {
        id: true,
        studentId: true,
        subjectId: true,
        paceNumber: true,
        selfTestScore: true,
        paceTestScore: true,
        completedAt: true,
        createdAt: true,
        advancementApproval: { select: { id: true } },
        student: { select: { id: true, active: true, yearGroup: true } },
        subject: { select: { id: true, active: true } },
      },
    });
    if (!existing) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'PACE record not found' });
    }
    if (existing.advancementApproval) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'approved advancement records cannot be deleted',
      });
    }
    if (!existing.student.active) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'student is not active' });
    }
    if (!existing.subject.active) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'subject is not active' });
    }

    const assignment = await ctx.db.studentSubject.findUnique({
      where: {
        studentId_subjectId: { studentId: existing.studentId, subjectId: existing.subjectId },
      },
      select: { id: true, currentPaceNumber: true },
    });
    if (!assignment) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'student is not assigned to this subject',
      });
    }

    const [storedPolicy, progress] = await Promise.all([
      ctx.db.pacePolicy.findUnique({ where: { id: 'default' } }),
      ctx.db.paceProgress.findUnique({
        where: {
          studentId_subjectId_paceNumber: {
            studentId: existing.studentId,
            subjectId: existing.subjectId,
            paceNumber: existing.paceNumber,
          },
        },
        select: { startedAt: true },
      }),
    ]);
    const policy = storedPolicy ?? DEFAULT_POLICY;
    const testType = testTypeForRecord(existing);
    const previousScore = scoreForRecord(existing);
    const startedAt = progress?.startedAt ?? existing.completedAt ?? existing.createdAt;

    const [deleted, meritResult, lifecycle] = await ctx.withRls(async (tx) => {
      const nextMeritResult = await reverseAutomaticPaceMerit(tx, {
        paceRecordId: existing.id,
        deletedById: ctx.user.id,
      });
      const removed = await tx.paceRecord.delete({
        where: { id: existing.id },
        select: {
          id: true,
          studentId: true,
          subjectId: true,
          paceNumber: true,
          completedAt: true,
          createdAt: true,
        },
      });
      const nextLifecycle = await recalculatePaceLifecycle(tx, {
        assignmentCurrentPaceNumber: assignment.currentPaceNumber,
        passThreshold: policy.passThreshold,
        paceNumber: existing.paceNumber,
        startedAt,
        studentId: existing.studentId,
        subjectId: existing.subjectId,
      });
      return [removed, nextMeritResult, nextLifecycle] as const;
    });

    await ctx.db.auditLog.create({
      data: {
        userId: ctx.user.id,
        action: 'Delete',
        entity: 'PaceRecord',
        entityId: deleted.id,
        meta: {
          studentId: existing.studentId,
          subjectId: existing.subjectId,
          paceNumber: existing.paceNumber,
          testType,
          previousScore,
          previousCompletedAt: existing.completedAt,
          automaticMeritReversed: meritResult !== null,
          ledgerCorrectionRows: meritResult?.correctionRows ?? 0,
        },
      },
    });

    if (meritResult) {
      await ctx.db.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'Delete',
          entity: 'BehaviourEntry',
          entityId: meritResult.behaviourEntryId,
          meta: {
            studentId: existing.studentId,
            source: 'pace.deleteRecord',
            paceRecordId: existing.id,
            ledgerCorrectionRows: meritResult.correctionRows,
          },
        },
      });
    }

    if (lifecycle.newPaceNumber !== undefined) {
      await ctx.db.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'Update',
          entity: 'StudentSubject',
          entityId: assignment.id,
          meta: {
            studentId: existing.studentId,
            subjectId: existing.subjectId,
            previousPaceNumber: assignment.currentPaceNumber,
            newPaceNumber: lifecycle.newPaceNumber,
            triggeredBy: deleted.id,
            source: 'pace.deleteRecord',
          },
        },
      });
    }

    return {
      ...deleted,
      deleted: true,
      newPaceNumber: lifecycle.newPaceNumber,
    };
  }),

  approveFailedFinalTestAdvance: authedProcedure
    .input(paceApprovalInput)
    .mutation(async ({ ctx, input }) => {
      const scope = await loadPaceScope(ctx, undefined, 'pace.approveFailedFinalTestAdvance');
      const existing = await ctx.db.paceRecord.findUnique({
        where: { id: input.recordId },
        select: {
          id: true,
          studentId: true,
          subjectId: true,
          paceNumber: true,
          selfTestScore: true,
          paceTestScore: true,
          completedAt: true,
          createdAt: true,
          advancementApproval: { select: { id: true } },
          student: { select: { id: true, active: true, yearGroup: true } },
          subject: { select: { id: true, active: true } },
        },
      });
      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'PACE record not found' });
      }
      if (!existing.student.active) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'student is not active' });
      }
      if (!existing.subject.active) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'subject is not active' });
      }
      if (
        !scope.fullAccess &&
        dateKey(existing.completedAt ?? existing.createdAt) !== scope.dayKey
      ) {
        await denyPaceAccess(
          ctx,
          'pace.approveFailedFinalTestAdvance',
          'PACE access is limited to today',
          {
            recordId: existing.id,
            existingDate: dateKey(existing.completedAt ?? existing.createdAt),
            today: scope.dayKey,
          },
        );
      }
      await assertStudentInPaceScope(
        ctx,
        scope,
        existing.student,
        'pace.approveFailedFinalTestAdvance',
      );

      const assignment = await ctx.db.studentSubject.findUnique({
        where: {
          studentId_subjectId: { studentId: existing.studentId, subjectId: existing.subjectId },
        },
        select: { id: true, currentPaceNumber: true },
      });
      if (!assignment) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'student is not assigned to this subject',
        });
      }

      const [storedPolicy, progress] = await Promise.all([
        ctx.db.pacePolicy.findUnique({ where: { id: 'default' } }),
        ctx.db.paceProgress.findUnique({
          where: {
            studentId_subjectId_paceNumber: {
              studentId: existing.studentId,
              subjectId: existing.subjectId,
              paceNumber: existing.paceNumber,
            },
          },
          select: { startedAt: true },
        }),
      ]);
      const policy = storedPolicy ?? DEFAULT_POLICY;
      const testType = testTypeForRecord(existing);
      const score = scoreForRecord(existing);
      if (testType !== 'FinalTest') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'only failed PACE Tests can be approved for advancement',
        });
      }
      if (score >= policy.passThreshold) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'passing PACE Tests advance without supervisor approval',
        });
      }
      if (existing.advancementApproval) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'PACE Test already has an advancement approval',
        });
      }
      if (assignment.currentPaceNumber !== existing.paceNumber) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'approved advancement must match the current PACE number',
        });
      }

      const startedAt = progress?.startedAt ?? existing.completedAt ?? existing.createdAt;
      const [approval, lifecycle] = await ctx.withRls(async (tx) => {
        const created = await tx.paceAdvancementApproval.create({
          data: {
            paceRecordId: existing.id,
            studentId: existing.studentId,
            subjectId: existing.subjectId,
            paceNumber: existing.paceNumber,
            notesEnc: ctx.db.$enc.encrypt(input.notes),
            approvedById: ctx.user.id,
          },
          select: {
            id: true,
            paceRecordId: true,
            studentId: true,
            subjectId: true,
            paceNumber: true,
            approvedAt: true,
            approvedById: true,
          },
        });
        const nextLifecycle = await recalculatePaceLifecycle(tx, {
          assignmentCurrentPaceNumber: assignment.currentPaceNumber,
          passThreshold: policy.passThreshold,
          paceNumber: existing.paceNumber,
          startedAt,
          studentId: existing.studentId,
          subjectId: existing.subjectId,
        });
        return [created, nextLifecycle] as const;
      });

      await ctx.db.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'Create',
          entity: 'PaceAdvancementApproval',
          entityId: approval.id,
          meta: {
            paceRecordId: existing.id,
            studentId: existing.studentId,
            subjectId: existing.subjectId,
            paceNumber: existing.paceNumber,
            score,
            notesPresent: true,
            advanced: lifecycle.advanced,
            newPaceNumber: lifecycle.newPaceNumber,
          },
        },
      });

      if (lifecycle.newPaceNumber !== undefined) {
        await ctx.db.auditLog.create({
          data: {
            userId: ctx.user.id,
            action: 'Update',
            entity: 'StudentSubject',
            entityId: assignment.id,
            meta: {
              studentId: existing.studentId,
              subjectId: existing.subjectId,
              previousPaceNumber: assignment.currentPaceNumber,
              newPaceNumber: lifecycle.newPaceNumber,
              triggeredBy: approval.id,
              source: 'pace.approveFailedFinalTestAdvance',
            },
          },
        });
      }

      return {
        ...approval,
        advanced: lifecycle.advanced,
        newPaceNumber: lifecycle.newPaceNumber,
        notes: input.notes,
      };
    }),
});
