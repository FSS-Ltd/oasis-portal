import { TRPCError } from '@trpc/server';
import { ACE_SUBJECT_CODES, sortPaceNumbers } from '@oasis/domain';
import {
  applySerializableRlsTx,
  RlsSerializationConflictError,
  type AppContext,
  type RlsTx,
} from '../context.js';

type GapInput = { studentId: string; subjectId: string };
const ACE_SUBJECT_CODE_SET: ReadonlySet<string> = new Set(ACE_SUBJECT_CODES);

export interface PaceGapContext {
  planId: string;
  jumpToPaceNumber: number;
  remainingPaceNumbers: number[];
  completedCount: number;
  totalCount: number;
}

export async function setPaceGapScope(
  tx: RlsTx,
  studentId: string,
  mode: 'read' | 'write',
): Promise<void> {
  const setting =
    mode === 'read' ? 'app.pace_gap_read_student_id' : 'app.pace_gap_write_student_id';
  await tx.$executeRaw`SELECT set_config(${setting}, ${studentId}, true)`;
}

export async function completedPaceNumbers(
  tx: RlsTx,
  studentId: string,
  subjectId: string,
): Promise<Set<number>> {
  const policy = await tx.pacePolicy.findUnique({
    where: { id: 'default' },
    select: { passThreshold: true },
  });
  const [progress, records] = await Promise.all([
    tx.paceProgress.findMany({
      where: { studentId, subjectId, completedAt: { not: null } },
      select: { paceNumber: true },
    }),
    tx.paceRecord.findMany({
      where: {
        studentId,
        subjectId,
        paceTestScore: { not: null },
        OR: [
          { paceTestScore: { gte: policy?.passThreshold ?? 80 } },
          { advancementApproval: { isNot: null } },
        ],
      },
      select: { paceNumber: true },
    }),
  ]);
  return new Set([
    ...progress.map((row) => row.paceNumber),
    ...records.map((row) => row.paceNumber),
  ]);
}

export async function isPaceCompleted(
  tx: RlsTx,
  input: GapInput & { paceNumber: number; passThreshold: number },
): Promise<boolean> {
  const progress = await tx.paceProgress.findUnique({
    where: {
      studentId_subjectId_paceNumber: {
        studentId: input.studentId,
        subjectId: input.subjectId,
        paceNumber: input.paceNumber,
      },
    },
    select: { completedAt: true },
  });
  if (progress?.completedAt) return true;
  const passingRecord = await tx.paceRecord.findFirst({
    where: {
      studentId: input.studentId,
      subjectId: input.subjectId,
      paceNumber: input.paceNumber,
      OR: [
        { paceTestScore: { gte: input.passThreshold } },
        { advancementApproval: { isNot: null } },
      ],
    },
    select: { id: true },
  });
  return passingRecord !== null;
}

export async function hasSuccessfulPaceRecord(
  tx: RlsTx,
  input: GapInput & { paceNumber: number; passThreshold: number },
): Promise<boolean> {
  const record = await tx.paceRecord.findFirst({
    where: {
      studentId: input.studentId,
      subjectId: input.subjectId,
      paceNumber: input.paceNumber,
      OR: [
        { paceTestScore: { gte: input.passThreshold } },
        { advancementApproval: { isNot: null } },
      ],
    },
    select: { id: true },
  });
  return record !== null;
}

export async function flagInvalidatedGapCompletion(
  tx: RlsTx,
  input: GapInput & { paceNumber: number; actorUserId: string },
): Promise<number> {
  const affectedItems = await tx.paceGapPlanItem.findMany({
    where: {
      paceNumber: input.paceNumber,
      removedAt: null,
      plan: {
        studentId: input.studentId,
        subjectId: input.subjectId,
        status: { not: 'Cancelled' },
        reviewRequiredAt: null,
      },
    },
    select: { planId: true },
  });
  const planIds = [...new Set(affectedItems.map((item) => item.planId))];
  if (planIds.length === 0) return 0;
  const updated = await tx.paceGapPlan.updateMany({
    where: { id: { in: planIds } },
    data: {
      reviewRequiredAt: new Date(),
      updatedById: input.actorUserId,
      version: { increment: 1 },
    },
  });
  for (const planId of planIds) {
    await tx.auditLog.create({
      data: {
        userId: input.actorUserId,
        action: 'Update',
        entity: 'PaceGapPlan',
        entityId: planId,
        meta: {
          reason: 'completed-gap-reopened-by-test-correction',
          paceNumber: input.paceNumber,
          reviewRequired: true,
        },
      },
    });
  }
  return updated.count;
}

export async function loadPaceGapContext(
  tx: RlsTx,
  input: GapInput,
): Promise<{ active: PaceGapContext | null; reviewRequired: boolean }> {
  await setPaceGapScope(tx, input.studentId, 'read');
  const [plans, completed] = await Promise.all([
    tx.paceGapPlan.findMany({
      where: {
        studentId: input.studentId,
        subjectId: input.subjectId,
        status: { not: 'Cancelled' },
      },
      include: { items: { orderBy: { paceNumber: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    }),
    completedPaceNumbers(tx, input.studentId, input.subjectId),
  ]);
  const activePlan = plans.find((plan) => plan.status === 'Active');
  const reviewRequired = plans.some((plan) => plan.reviewRequiredAt !== null);
  if (!activePlan) return { active: null, reviewRequired };

  const activeItems = activePlan.items.filter((item) => item.removedAt === null);
  const remainingPaceNumbers = activeItems
    .filter((item) => !completed.has(item.paceNumber))
    .map((item) => item.paceNumber);
  return {
    active: {
      planId: activePlan.id,
      jumpToPaceNumber: activePlan.jumpToPaceNumber,
      remainingPaceNumbers,
      completedCount: activeItems.length - remainingPaceNumbers.length,
      totalCount: activeItems.length,
    },
    reviewRequired,
  };
}

export async function hasBlockingPaceGapPlan(tx: RlsTx, input: GapInput): Promise<boolean> {
  await setPaceGapScope(tx, input.studentId, 'read');
  const plan = await tx.paceGapPlan.findFirst({
    where: {
      studentId: input.studentId,
      subjectId: input.subjectId,
      OR: [{ status: 'Active' }, { status: { not: 'Cancelled' }, reviewRequiredAt: { not: null } }],
    },
    select: { id: true },
  });
  return plan !== null;
}

function requireHead(ctx: AppContext): string {
  if (ctx.user?.role !== 'Head') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Only the Head can manage gap PACEs.' });
  }
  return ctx.user.id;
}

async function withSerializableGapPlanTx<T>(
  ctx: AppContext,
  operation: (tx: RlsTx) => Promise<T>,
): Promise<T> {
  try {
    return await applySerializableRlsTx(ctx.db, ctx.user, operation);
  } catch (error) {
    if (error instanceof RlsSerializationConflictError) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'Gap plan state changed. Refresh and review the updated state before retrying.',
      });
    }
    throw error;
  }
}

async function requireAssignment(
  tx: RlsTx,
  input: GapInput,
): Promise<{ id: string; currentPaceNumber: number }> {
  const [student, subject] = await Promise.all([
    tx.student.findUnique({ where: { id: input.studentId }, select: { id: true, active: true } }),
    tx.subject.findUnique({ where: { id: input.subjectId }, select: { active: true, code: true } }),
  ]);
  if (!student || !subject) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Student or subject not found.' });
  }
  if (!student.active)
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Student is inactive.' });
  if (!subject.active || !ACE_SUBJECT_CODE_SET.has(subject.code)) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Choose an active ACE subject.' });
  }
  const assignment = await tx.studentSubject.findUnique({
    where: { studentId_subjectId: input },
    select: { id: true, currentPaceNumber: true },
  });
  if (!assignment) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Assign this subject before setting gaps.',
    });
  }
  return assignment;
}

function requireExpectedVersion(actual: number, expected: number): void {
  if (actual !== expected) {
    throw new TRPCError({
      code: 'CONFLICT',
      message: 'The gap plan changed. Refresh it and review the current PACEs before saving.',
    });
  }
}

async function ensureProgressStarted(
  tx: RlsTx,
  input: GapInput & { paceNumber: number },
): Promise<void> {
  const now = new Date();
  await tx.paceProgress.upsert({
    where: { studentId_subjectId_paceNumber: input },
    create: {
      studentId: input.studentId,
      subjectId: input.subjectId,
      paceNumber: input.paceNumber,
      startedAt: now,
    },
    update: {},
  });
}

async function moveAssignment(tx: RlsTx, input: GapInput & { paceNumber: number }): Promise<void> {
  await ensureProgressStarted(tx, input);
  await tx.studentSubject.update({
    where: {
      studentId_subjectId: { studentId: input.studentId, subjectId: input.subjectId },
    },
    data: { currentPaceNumber: input.paceNumber },
  });
}

export async function getGapPlanSummary(ctx: AppContext, input: GapInput) {
  requireHead(ctx);
  return ctx.withRls(async (tx) => {
    const assignment = await requireAssignment(tx, input);
    const [plans, completedPaces] = await Promise.all([
      tx.paceGapPlan.findMany({
        where: { studentId: input.studentId, subjectId: input.subjectId },
        include: { items: { orderBy: { paceNumber: 'asc' } } },
        orderBy: { createdAt: 'desc' },
      }),
      completedPaceNumbers(tx, input.studentId, input.subjectId),
    ]);
    return {
      currentPaceNumber: assignment.currentPaceNumber,
      completedPaceNumbers: [...completedPaces].sort((a, b) => a - b),
      plans: plans.map((plan) => ({
        id: plan.id,
        jumpToPaceNumber: plan.jumpToPaceNumber,
        status: plan.status,
        version: plan.version,
        reviewRequired: plan.reviewRequiredAt !== null,
        items: plan.items.map((item) => ({
          paceNumber: item.paceNumber,
          removed: item.removedAt !== null,
          completed: completedPaces.has(item.paceNumber),
        })),
        completedAt: plan.completedAt,
        cancelledAt: plan.cancelledAt,
      })),
    };
  });
}

export async function createGapPlan(
  ctx: AppContext,
  input: GapInput & {
    paceNumbers: number[];
    jumpToPaceNumber: number;
    expectedCurrentPaceNumber: number;
  },
) {
  const userId = requireHead(ctx);
  try {
    return await withSerializableGapPlanTx(ctx, async (tx) => {
      const assignment = await requireAssignment(tx, input);
      if (assignment.currentPaceNumber !== input.expectedCurrentPaceNumber) {
        throw new TRPCError({
          code: 'CONFLICT',
          message:
            'The current PACE changed. Refresh the plan and review the updated state before retrying.',
        });
      }
      const active = await tx.paceGapPlan.findFirst({
        where: { studentId: input.studentId, subjectId: input.subjectId, status: 'Active' },
        select: { id: true },
      });
      const priorReview = await tx.paceGapPlan.findFirst({
        where: {
          studentId: input.studentId,
          subjectId: input.subjectId,
          status: { not: 'Cancelled' },
          reviewRequiredAt: { not: null },
        },
        select: { id: true },
      });
      if (active || priorReview) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Resolve or cancel the existing gap plan before starting another.',
        });
      }
      const completed = await completedPaceNumbers(tx, input.studentId, input.subjectId);
      if (input.paceNumbers.some((paceNumber) => completed.has(paceNumber))) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Remove PACEs already completed from the gap selection.',
        });
      }
      if (completed.has(input.jumpToPaceNumber)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Choose an incomplete PACE as the jump destination.',
        });
      }
      const paceNumbers = sortPaceNumbers(input.paceNumbers);
      const plan = await tx.paceGapPlan.create({
        data: {
          studentId: input.studentId,
          subjectId: input.subjectId,
          jumpToPaceNumber: input.jumpToPaceNumber,
          createdById: userId,
          updatedById: userId,
          items: { create: paceNumbers.map((paceNumber) => ({ paceNumber })) },
        },
        select: { id: true, version: true },
      });
      const firstGapPaceNumber = paceNumbers[0];
      if (firstGapPaceNumber === undefined) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Select at least one gap PACE.' });
      }
      await moveAssignment(tx, {
        studentId: input.studentId,
        subjectId: input.subjectId,
        paceNumber: firstGapPaceNumber,
      });
      await tx.auditLog.create({
        data: {
          userId,
          action: 'Create',
          entity: 'PaceGapPlan',
          entityId: plan.id,
          meta: {
            studentId: input.studentId,
            subjectId: input.subjectId,
            paceNumbers,
            jumpToPaceNumber: input.jumpToPaceNumber,
            version: plan.version,
          },
        },
      });
      return plan;
    });
  } catch (error) {
    if (error instanceof TRPCError) throw error;
    if (isUniqueConflict(error))
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'A gap plan changed concurrently. Refresh and review the current state.',
      });
    throw error;
  }
}

function isUniqueConflict(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}

export async function updateGapPlan(
  ctx: AppContext,
  input: {
    planId: string;
    expectedVersion: number;
    remainingPaceNumbers: number[];
    jumpToPaceNumber: number;
  },
) {
  const userId = requireHead(ctx);
  return withSerializableGapPlanTx(ctx, async (tx) => {
    const plan = await tx.paceGapPlan.findUnique({
      where: { id: input.planId },
      include: { items: true },
    });
    if (!plan) throw new TRPCError({ code: 'NOT_FOUND', message: 'Gap plan not found.' });
    requireExpectedVersion(plan.version, input.expectedVersion);
    if (plan.status !== 'Active' || plan.reviewRequiredAt !== null) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'Refresh and review this gap plan before editing it.',
      });
    }
    const completed = await completedPaceNumbers(tx, plan.studentId, plan.subjectId);
    const retained = plan.items.filter(
      (item) => item.removedAt === null && completed.has(item.paceNumber),
    );
    const desired = sortPaceNumbers(input.remainingPaceNumbers);
    if (
      desired.some(
        (paceNumber) =>
          completed.has(paceNumber) && !retained.some((item) => item.paceNumber === paceNumber),
      )
    ) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'A completed PACE cannot be added as a new gap.',
      });
    }
    const allGaps = sortPaceNumbers([...retained.map((item) => item.paceNumber), ...desired]);
    if (allGaps.length === retained.length)
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Cancel the plan to remove all remaining gaps.',
      });
    const highestGapPaceNumber = allGaps.at(-1);
    if (highestGapPaceNumber === undefined || input.jumpToPaceNumber <= highestGapPaceNumber)
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'The jump destination must be higher than every gap PACE.',
      });
    if (
      (await completedPaceNumbers(tx, plan.studentId, plan.subjectId)).has(input.jumpToPaceNumber)
    ) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Choose an incomplete PACE as the jump destination.',
      });
    }
    for (const item of plan.items) {
      if (completed.has(item.paceNumber)) continue;
      const keep = desired.includes(item.paceNumber);
      await tx.paceGapPlanItem.update({
        where: { id: item.id },
        data: { removedAt: keep ? null : new Date() },
      });
    }
    const existing = new Set(plan.items.map((item) => item.paceNumber));
    for (const paceNumber of desired) {
      if (!existing.has(paceNumber))
        await tx.paceGapPlanItem.create({ data: { planId: plan.id, paceNumber } });
    }
    const next = desired[0] ?? retained[0]?.paceNumber;
    if (next === undefined) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Cancel the plan to remove all remaining gaps.',
      });
    }
    await tx.paceGapPlan.update({
      where: { id: plan.id },
      data: {
        jumpToPaceNumber: input.jumpToPaceNumber,
        version: { increment: 1 },
        updatedById: userId,
      },
    });
    await moveAssignment(tx, {
      studentId: plan.studentId,
      subjectId: plan.subjectId,
      paceNumber: next,
    });
    await tx.auditLog.create({
      data: {
        userId,
        action: 'Update',
        entity: 'PaceGapPlan',
        entityId: plan.id,
        meta: {
          remainingPaceNumbers: desired,
          retainedCompletedPaceNumbers: retained.map((item) => item.paceNumber),
          jumpToPaceNumber: input.jumpToPaceNumber,
          version: plan.version + 1,
        },
      },
    });
    return { id: plan.id, version: plan.version + 1, currentPaceNumber: next };
  });
}

export async function cancelGapPlan(
  ctx: AppContext,
  input: { planId: string; expectedVersion: number },
) {
  const userId = requireHead(ctx);
  return withSerializableGapPlanTx(ctx, async (tx) => {
    const plan = await tx.paceGapPlan.findUnique({ where: { id: input.planId } });
    if (!plan) throw new TRPCError({ code: 'NOT_FOUND', message: 'Gap plan not found.' });
    requireExpectedVersion(plan.version, input.expectedVersion);
    if (
      plan.status === 'Cancelled' ||
      (plan.status === 'Completed' && plan.reviewRequiredAt === null)
    )
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'Only an active plan or a plan requiring review can be cancelled.',
      });
    const active = plan.status === 'Active';
    await tx.paceGapPlan.update({
      where: { id: plan.id },
      data: {
        status: 'Cancelled',
        cancelledAt: new Date(),
        reviewRequiredAt: null,
        version: { increment: 1 },
        updatedById: userId,
      },
    });
    let currentPaceNumber: number | undefined;
    if (active) {
      currentPaceNumber = plan.jumpToPaceNumber;
      await moveAssignment(tx, {
        studentId: plan.studentId,
        subjectId: plan.subjectId,
        paceNumber: currentPaceNumber,
      });
    }
    if (plan.reviewRequiredAt !== null) {
      const [otherReview, otherActive, assignment, policy] = await Promise.all([
        tx.paceGapPlan.findFirst({
          where: {
            studentId: plan.studentId,
            subjectId: plan.subjectId,
            id: { not: plan.id },
            status: { not: 'Cancelled' },
            reviewRequiredAt: { not: null },
          },
          select: { id: true },
        }),
        tx.paceGapPlan.findFirst({
          where: { studentId: plan.studentId, subjectId: plan.subjectId, status: 'Active' },
          select: { id: true },
        }),
        tx.studentSubject.findUnique({
          where: { studentId_subjectId: { studentId: plan.studentId, subjectId: plan.subjectId } },
          select: { currentPaceNumber: true },
        }),
        tx.pacePolicy.findUnique({ where: { id: 'default' }, select: { passThreshold: true } }),
      ]);
      if (!otherReview && !otherActive && assignment) {
        const completed = await isPaceCompleted(tx, {
          studentId: plan.studentId,
          subjectId: plan.subjectId,
          paceNumber: assignment.currentPaceNumber,
          passThreshold: policy?.passThreshold ?? 80,
        });
        if (completed && assignment.currentPaceNumber < 1144) {
          currentPaceNumber = assignment.currentPaceNumber + 1;
          await moveAssignment(tx, {
            studentId: plan.studentId,
            subjectId: plan.subjectId,
            paceNumber: currentPaceNumber,
          });
        }
      }
    }
    await tx.auditLog.create({
      data: {
        userId,
        action: 'Update',
        entity: 'PaceGapPlan',
        entityId: plan.id,
        meta: {
          status: 'Cancelled',
          currentPaceNumber: currentPaceNumber ?? null,
          version: plan.version + 1,
        },
      },
    });
    return { id: plan.id, currentPaceNumber };
  });
}

export async function reopenGapPlan(
  ctx: AppContext,
  input: { planId: string; expectedVersion: number; jumpToPaceNumber?: number | undefined },
) {
  const userId = requireHead(ctx);
  return withSerializableGapPlanTx(ctx, async (tx) => {
    const plan = await tx.paceGapPlan.findUnique({
      where: { id: input.planId },
      include: { items: true },
    });
    if (!plan) throw new TRPCError({ code: 'NOT_FOUND', message: 'Gap plan not found.' });
    requireExpectedVersion(plan.version, input.expectedVersion);
    if (plan.reviewRequiredAt === null || plan.status === 'Cancelled') {
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'Refresh and review this gap plan before reopening it.',
      });
    }
    const active = await tx.paceGapPlan.findFirst({
      where: {
        studentId: plan.studentId,
        subjectId: plan.subjectId,
        status: 'Active',
        id: { not: plan.id },
      },
      select: { id: true },
    });
    if (active)
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'Cancel the active gap plan before reopening this plan.',
      });
    const allReviews = await tx.paceGapPlan.findMany({
      where: {
        studentId: plan.studentId,
        subjectId: plan.subjectId,
        status: { not: 'Cancelled' },
        reviewRequiredAt: { not: null },
      },
      select: { id: true },
    });
    if (allReviews.some((review) => review.id !== plan.id)) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'Resolve the other flagged gap plans before reopening this one.',
      });
    }
    const completed = await completedPaceNumbers(tx, plan.studentId, plan.subjectId);
    const remaining = plan.items
      .filter((item) => item.removedAt === null && !completed.has(item.paceNumber))
      .map((item) => item.paceNumber);
    const assignment = await requireAssignment(tx, plan);
    const status = remaining.length > 0 ? 'Active' : 'Completed';
    const target = remaining[0] ?? assignment.currentPaceNumber;
    const retainedPaceNumbers = plan.items
      .filter((item) => item.removedAt === null)
      .map((item) => item.paceNumber);
    const jumpToPaceNumber =
      input.jumpToPaceNumber ??
      (plan.status === 'Completed' ? assignment.currentPaceNumber : plan.jumpToPaceNumber);
    const completedNumbers = await completedPaceNumbers(tx, plan.studentId, plan.subjectId);
    const returningToHeldCompletion =
      plan.status === 'Completed' && jumpToPaceNumber === assignment.currentPaceNumber;
    if (
      retainedPaceNumbers.some((paceNumber) => paceNumber >= jumpToPaceNumber) ||
      (completedNumbers.has(jumpToPaceNumber) && !returningToHeldCompletion)
    ) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Choose an incomplete jump destination higher than every retained gap PACE.',
      });
    }
    await tx.paceGapPlan.update({
      where: { id: plan.id },
      data: {
        status,
        jumpToPaceNumber,
        reviewRequiredAt: null,
        completedAt: status === 'Completed' ? new Date() : null,
        cancelledAt: null,
        version: { increment: 1 },
        updatedById: userId,
      },
    });
    if (status === 'Active')
      await moveAssignment(tx, {
        studentId: plan.studentId,
        subjectId: plan.subjectId,
        paceNumber: target,
      });
    let reconciledCurrentPaceNumber = target;
    if (status === 'Completed') {
      reconciledCurrentPaceNumber = assignment.currentPaceNumber;
      if (plan.status === 'Active') {
        reconciledCurrentPaceNumber = jumpToPaceNumber;
        await moveAssignment(tx, {
          studentId: plan.studentId,
          subjectId: plan.subjectId,
          paceNumber: reconciledCurrentPaceNumber,
        });
      }
      const policy = await tx.pacePolicy.findUnique({
        where: { id: 'default' },
        select: { passThreshold: true },
      });
      const currentIsComplete = await isPaceCompleted(tx, {
        studentId: plan.studentId,
        subjectId: plan.subjectId,
        paceNumber: reconciledCurrentPaceNumber,
        passThreshold: policy?.passThreshold ?? 80,
      });
      if (currentIsComplete && reconciledCurrentPaceNumber < 1144) {
        const nextPaceNumber = reconciledCurrentPaceNumber + 1;
        await moveAssignment(tx, {
          studentId: plan.studentId,
          subjectId: plan.subjectId,
          paceNumber: nextPaceNumber,
        });
        reconciledCurrentPaceNumber = nextPaceNumber;
        await tx.auditLog.create({
          data: {
            userId,
            action: 'Update',
            entity: 'StudentSubject',
            meta: {
              studentId: plan.studentId,
              subjectId: plan.subjectId,
              previousPaceNumber: reconciledCurrentPaceNumber,
              newPaceNumber: nextPaceNumber,
              triggeredBy: plan.id,
            },
          },
        });
      }
    }
    await tx.auditLog.create({
      data: {
        userId,
        action: 'Update',
        entity: 'PaceGapPlan',
        entityId: plan.id,
        meta: {
          decision: 'Reopen',
          status,
          currentPaceNumber: status === 'Active' ? target : reconciledCurrentPaceNumber,
          version: plan.version + 1,
        },
      },
    });
    return {
      id: plan.id,
      status,
      currentPaceNumber: status === 'Active' ? target : reconciledCurrentPaceNumber,
      version: plan.version + 1,
    };
  });
}
