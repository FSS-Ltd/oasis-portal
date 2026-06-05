import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import type { SessionUser, TitheCadence, TithePaymentMode } from '@oasis/domain';
import type { AppContext } from '../context.js';
import {
  DEFAULT_TITHE_CADENCE,
  DEFAULT_TITHE_MODE,
  DEFAULT_TITHE_MONTHLY_DATE,
  DEFAULT_TITHE_PERCENTAGE,
  DEFAULT_TITHE_WEEKLY_DAY,
  loadManualTitheStatus,
  payManualTithe,
} from '../services/tithe-run.js';
import { authedProcedure, roleProcedure, router } from '../trpc.js';

type AuthedContext = AppContext & { user: SessionUser };

const titheCadenceInput = z.enum(['Weekly', 'Monthly']);
const tithePaymentModeInput = z.enum(['Percentage', 'FixedAmount']);

const updatePreferenceInput = z
  .object({
    cadence: titheCadenceInput.default(DEFAULT_TITHE_CADENCE),
    mode: tithePaymentModeInput.default(DEFAULT_TITHE_MODE),
    percentage: z.number().int().min(10).max(100).optional(),
    fixedAmount: z.number().int().min(1).optional(),
    weeklyDay: z.number().int().min(0).max(6).optional(),
    monthlyDate: z.number().int().min(1).max(31).optional(),
  })
  .superRefine((input, ctx) => {
    if (input.mode === 'FixedAmount' && input.fixedAmount === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'fixed amount is required for fixed tithe mode',
        path: ['fixedAmount'],
      });
    }
  });

async function loadOwnActiveStudent(ctx: AuthedContext): Promise<{
  id: string;
  active: boolean;
  userId: string | null;
}> {
  const student = await ctx.db.student.findUnique({
    where: { userId: ctx.user.id },
    select: { id: true, active: true, userId: true },
  });

  if (!student?.active) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'student profile not found' });
  }
  return student;
}

async function auditStudentOnlyDenied(ctx: AuthedContext, entity: string): Promise<never> {
  await ctx.db.auditLog.create({
    data: {
      userId: ctx.user.id,
      action: 'PermissionDenied',
      entity,
      meta: { role: ctx.user.role, reason: 'student access required' },
    },
  });
  throw new TRPCError({ code: 'FORBIDDEN', message: 'student access required' });
}

export const titheRouter = router({
  getStatus: roleProcedure('Student').query(async ({ ctx }) => {
    const student = await loadOwnActiveStudent(ctx);
    return loadManualTitheStatus(ctx.db, { studentId: student.id });
  }),

  updatePreference: authedProcedure.input(updatePreferenceInput).mutation(async ({ ctx, input }) => {
    if (ctx.user.role !== 'Student') {
      return auditStudentOnlyDenied(ctx, 'tithe.updatePreference');
    }

    const student = await loadOwnActiveStudent(ctx);
    const previous = await ctx.db.titheConfig.findUnique({ where: { studentId: student.id } });
    const cadence: TitheCadence = input.cadence;
    const mode: TithePaymentMode = input.mode;
    const config = await ctx.db.titheConfig.upsert({
      where: { studentId: student.id },
      create: {
        studentId: student.id,
        percentage: input.percentage ?? DEFAULT_TITHE_PERCENTAGE,
        cadence,
        mode,
        fixedAmount: mode === 'FixedAmount' ? input.fixedAmount ?? null : null,
        weeklyDay: input.weeklyDay ?? DEFAULT_TITHE_WEEKLY_DAY,
        monthlyDate: input.monthlyDate ?? DEFAULT_TITHE_MONTHLY_DATE,
      },
      update: {
        percentage: input.percentage ?? DEFAULT_TITHE_PERCENTAGE,
        cadence,
        mode,
        fixedAmount: mode === 'FixedAmount' ? input.fixedAmount ?? null : null,
        weeklyDay: input.weeklyDay ?? DEFAULT_TITHE_WEEKLY_DAY,
        monthlyDate: input.monthlyDate ?? DEFAULT_TITHE_MONTHLY_DATE,
      },
    });

    await ctx.db.auditLog.create({
      data: {
        userId: ctx.user.id,
        action: 'Update',
        entity: 'TitheConfig',
        entityId: student.id,
        meta: {
          source: 'tithe.updatePreference',
          previousCadence: previous?.cadence ?? DEFAULT_TITHE_CADENCE,
          cadence: config.cadence,
          mode: config.mode,
        },
      },
    });

    return {
      studentId: student.id,
      config: {
        studentId: config.studentId,
        percentage: config.percentage,
        cadence: config.cadence,
        mode: config.mode,
        fixedAmount: config.fixedAmount,
        weeklyDay: config.weeklyDay,
        monthlyDate: config.monthlyDate,
        lastRunAt: config.lastRunAt,
      },
    };
  }),

  payDue: roleProcedure('Student').mutation(async ({ ctx }) => {
    const student = await loadOwnActiveStudent(ctx);
    return payManualTithe({ auditUserId: ctx.user.id, db: ctx.db, studentId: student.id });
  }),
});
