import { TRPCError } from '@trpc/server';
import {
  AccessDeniedError,
  canUseLinkedChildGuardianAccess,
  isFullAdmin,
  type SessionUser,
  type TithePercentage,
} from '@oasis/domain';
import { z } from 'zod';
import type { AppContext } from '../context.js';
import {
  DEFAULT_TITHE_PERCENTAGE,
  TITHE_CADENCE,
  runWeeklyTithe,
  toTithePercentage,
} from '../services/tithe-run.js';
import { authedProcedure, router } from '../trpc.js';

const tithePercentageInput = z.union([z.literal(10), z.literal(15), z.literal(20)]);

type AuthedContext = AppContext & { user: SessionUser };

interface ActiveStudent {
  id: string;
  active: boolean;
}

export interface TitheConfigDto {
  studentId: string;
  percentage: TithePercentage;
  cadence: string;
  lastRunAt: Date | null;
}

const studentInput = z.object({ studentId: z.string().cuid() });

const setPercentageInput = z.object({
  studentId: z.string().cuid(),
  percentage: tithePercentageInput,
});

const runWeekInput = z.object({
  weekStart: z.coerce.date(),
});

function mapConfig(input: {
  studentId: string;
  percentage?: number | null;
  cadence?: string | null;
  lastRunAt?: Date | null;
}): TitheConfigDto {
  return {
    studentId: input.studentId,
    percentage: toTithePercentage(input.percentage),
    cadence: input.cadence ?? TITHE_CADENCE,
    lastRunAt: input.lastRunAt ?? null,
  };
}

async function loadActiveStudent(ctx: AuthedContext, studentId: string): Promise<ActiveStudent> {
  const student = await ctx.db.student.findUnique({
    where: { id: studentId },
    select: { id: true, active: true },
  });

  if (!student?.active) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'student not found' });
  }

  return student;
}

async function auditAccessDenied(
  ctx: AuthedContext,
  entity: string,
  studentId: string,
  denied: AccessDeniedError,
): Promise<never> {
  await ctx.db.auditLog.create({
    data: {
      userId: ctx.user.id,
      action: 'PermissionDenied',
      entity,
      entityId: studentId,
      meta: { role: ctx.user.role, reason: denied.message },
    },
  });
  throw new TRPCError({ code: 'FORBIDDEN', message: denied.message, cause: denied });
}

async function auditPermissionDenied(
  ctx: AuthedContext,
  entity: string,
  studentId: string,
  reason: string,
): Promise<never> {
  return auditAccessDenied(ctx, entity, studentId, new AccessDeniedError(reason));
}

async function assertCanManageConfig(
  ctx: AuthedContext,
  student: ActiveStudent,
  entity: string,
): Promise<void> {
  if (isFullAdmin(ctx.user)) return;

  if (canUseLinkedChildGuardianAccess(ctx.user)) {
    const guardian = await ctx.db.guardian.findUnique({
      where: { userId_studentId: { userId: ctx.user.id, studentId: student.id } },
      select: { studentId: true },
    });

    if (guardian) return;
    await auditAccessDenied(
      ctx,
      entity,
      student.id,
      new AccessDeniedError('linked-child guardian is not linked to this student'),
    );
  }

  await auditPermissionDenied(
    ctx,
    entity,
    student.id,
    `role ${ctx.user.role} cannot manage tithe config`,
  );
}

export const titheRouter = router({
  getConfig: authedProcedure.input(studentInput).query(async ({ ctx, input }) => {
    const student = await loadActiveStudent(ctx, input.studentId);
    await assertCanManageConfig(ctx, student, 'tithe.getConfig');

    const config = await ctx.db.titheConfig.findUnique({
      where: { studentId: student.id },
      select: { studentId: true, percentage: true, cadence: true, lastRunAt: true },
    });

    return mapConfig(config ?? { studentId: student.id });
  }),

  setPercentage: authedProcedure.input(setPercentageInput).mutation(async ({ ctx, input }) => {
    const student = await loadActiveStudent(ctx, input.studentId);
    await assertCanManageConfig(ctx, student, 'tithe.setPercentage');

    const previous = await ctx.db.titheConfig.findUnique({
      where: { studentId: student.id },
      select: { percentage: true },
    });
    const config = await ctx.db.titheConfig.upsert({
      where: { studentId: student.id },
      create: {
        studentId: student.id,
        percentage: input.percentage,
        cadence: TITHE_CADENCE,
      },
      update: { percentage: input.percentage },
      select: { studentId: true, percentage: true, cadence: true, lastRunAt: true },
    });

    await ctx.db.auditLog.create({
      data: {
        userId: ctx.user.id,
        action: 'Update',
        entity: 'TitheConfig',
        entityId: student.id,
        meta: {
          source: 'tithe.setPercentage',
          previousPercentage: previous?.percentage ?? DEFAULT_TITHE_PERCENTAGE,
          percentage: input.percentage,
        },
      },
    });

    return mapConfig(config);
  }),

  runWeek: authedProcedure.input(runWeekInput).mutation(async ({ ctx, input }) => {
    if (!isFullAdmin(ctx.user)) {
      await ctx.db.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'PermissionDenied',
          entity: 'tithe.runWeek',
          meta: { role: ctx.user.role, reason: 'full-admin access required' },
        },
      });
      throw new TRPCError({ code: 'FORBIDDEN', message: 'full-admin access required' });
    }

    return runWeeklyTithe({
      auditUserId: ctx.user.id,
      db: ctx.db,
      weekStart: input.weekStart,
    });
  }),
});
