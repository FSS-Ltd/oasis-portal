import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { Prisma } from '@oasis/db';
import {
  AccessDeniedError,
  canUseLinkedChildGuardianAccess,
  getMeritActivity,
  isFullAdmin,
  requireSelfStudent,
  rowsForTransfer,
  type MeritAccount,
  type SessionUser,
} from '@oasis/domain';
import type { AppContext, RlsTx } from '../context.js';
import { assertStudentPortalAccess } from '../lib/student-portal-access.js';
import { authedProcedure, router } from '../trpc.js';

const WALLET_ACCOUNTS = [
  'Spend',
  'Saving',
  'Investment',
] as const satisfies readonly MeritAccount[];

type AuthedContext = AppContext & { user: SessionUser };
type WalletAccount = (typeof WALLET_ACCOUNTS)[number];
type TransferAccount = Extract<WalletAccount, 'Spend' | 'Saving'>;

interface ActiveStudent {
  id: string;
  active: boolean;
  userId: string | null;
}

const walletInput = z.object({ studentId: z.string().cuid() });

const activityInput = z.object({
  studentId: z.string().cuid(),
  range: z.enum(['week', 'month']),
});

const transferInput = z.object({
  studentId: z.string().cuid(),
  from: z.enum(WALLET_ACCOUNTS),
  to: z.enum(WALLET_ACCOUNTS),
  amount: z.number().int().positive(),
});

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function calendarWeekRange(referenceDate = new Date()): { from: Date; to: Date } {
  const from = startOfUtcDay(referenceDate);
  const daysSinceMonday = (from.getUTCDay() + 6) % 7;
  from.setUTCDate(from.getUTCDate() - daysSinceMonday);

  const to = new Date(from);
  to.setUTCDate(to.getUTCDate() + 7);
  return { from, to };
}

function calendarMonthRange(referenceDate = new Date()): { from: Date; to: Date } {
  const from = new Date(Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth(), 1));
  const to = new Date(Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth() + 1, 1));
  return { from, to };
}

function rangeFor(input: 'week' | 'month'): { from: Date; to: Date } {
  return input === 'week' ? calendarWeekRange() : calendarMonthRange();
}

function isTransferAccount(account: WalletAccount): account is TransferAccount {
  return account === 'Spend' || account === 'Saving';
}

async function loadWalletBalances(store: Pick<AppContext['db'], 'meritLedger'>, studentId: string) {
  const [spend, saving, investment, shopReserved] = await Promise.all([
    store.meritLedger.aggregate({
      where: { studentId, account: 'Spend' },
      _sum: { delta: true },
    }),
    store.meritLedger.aggregate({
      where: { studentId, account: 'Saving' },
      _sum: { delta: true },
    }),
    store.meritLedger.aggregate({
      where: { studentId, account: 'Investment' },
      _sum: { delta: true },
    }),
    store.meritLedger.aggregate({
      where: { studentId, account: 'ShopReserved' },
      _sum: { delta: true },
    }),
  ]);

  return {
    Spend: spend._sum.delta ?? 0,
    Saving: saving._sum.delta ?? 0,
    Investment: investment._sum.delta ?? 0,
    ShopReserved: shopReserved._sum.delta ?? 0,
  };
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

async function auditRejectedTransfer(
  ctx: AuthedContext,
  input: { studentId: string; from: WalletAccount; to: WalletAccount; amount: number },
  reason: string,
): Promise<void> {
  await ctx.db.auditLog.create({
    data: {
      userId: ctx.user.id,
      action: 'Update',
      entity: 'MeritLedger',
      entityId: input.studentId,
      meta: {
        source: 'meritLedger.transfer',
        outcome: 'Rejected',
        reason,
        from: input.from,
        to: input.to,
        amount: input.amount,
      },
    },
  });
}

async function loadActiveStudent(ctx: AuthedContext, studentId: string): Promise<ActiveStudent> {
  const student = await ctx.db.student.findUnique({
    where: { id: studentId },
    select: { id: true, active: true, userId: true },
  });

  if (!student?.active) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'student not found' });
  }

  return student;
}

async function assertCanReadWallet(
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

  if (ctx.user.role === 'Student') {
    try {
      requireSelfStudent(ctx.user, student.id, student.userId);
      await assertStudentPortalAccess(ctx, { entity, studentId: student.id });
      return;
    } catch (err) {
      if (err instanceof AccessDeniedError) {
        await auditAccessDenied(ctx, entity, student.id, err);
      }
      throw err;
    }
  }

  await auditPermissionDenied(
    ctx,
    entity,
    student.id,
    `role ${ctx.user.role} cannot access wallet`,
  );
}

async function assertCanTransfer(ctx: AuthedContext, student: ActiveStudent): Promise<void> {
  if (isFullAdmin(ctx.user)) return;

  if (ctx.user.role === 'Student') {
    try {
      requireSelfStudent(ctx.user, student.id, student.userId);
      await assertStudentPortalAccess(ctx, {
        entity: 'meritLedger.transfer',
        studentId: student.id,
      });
      return;
    } catch (err) {
      if (err instanceof AccessDeniedError) {
        await auditAccessDenied(ctx, 'meritLedger.transfer', student.id, err);
      }
      throw err;
    }
  }

  await auditPermissionDenied(
    ctx,
    'meritLedger.transfer',
    student.id,
    `role ${ctx.user.role} cannot transfer wallet merits`,
  );
}

export const meritLedgerRouter = router({
  balances: authedProcedure.input(walletInput).query(async ({ ctx, input }) => {
    const student = await loadActiveStudent(ctx, input.studentId);
    await assertCanReadWallet(ctx, student, 'meritLedger.balances');

    return {
      studentId: student.id,
      balances: await loadWalletBalances(ctx.db, student.id),
    };
  }),

  activity: authedProcedure.input(activityInput).query(async ({ ctx, input }) => {
    const student = await loadActiveStudent(ctx, input.studentId);
    await assertCanReadWallet(ctx, student, 'meritLedger.activity');

    const period = rangeFor(input.range);
    const entries = await ctx.withRls((tx: RlsTx) =>
      tx.behaviourEntry.findMany({
        where: {
          studentId: student.id,
          createdAt: { gte: period.from, lt: period.to },
          deletedAt: null,
        },
        select: { type: true, meritDelta: true },
      }),
    );

    return {
      studentId: student.id,
      range: input.range,
      period,
      activity: getMeritActivity(
        entries.map((entry) => ({
          type: entry.type,
          meritDelta: entry.meritDelta,
        })),
      ),
    };
  }),

  transfer: authedProcedure.input(transferInput).mutation(async ({ ctx, input }) => {
    const student = await loadActiveStudent(ctx, input.studentId);
    await assertCanTransfer(ctx, student);

    if (!isTransferAccount(input.from) || !isTransferAccount(input.to)) {
      await auditRejectedTransfer(ctx, input, 'InvestmentTransfersUnsupported');
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Investment transfers are handled by the investment buy/sell API',
      });
    }

    const ledgerRows = rowsForTransfer({
      studentId: student.id,
      from: input.from,
      to: input.to,
      amount: input.amount,
      reason: `${input.from}:to:${input.to}`,
    });

    const transferResult = await ctx.db.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const balances = await loadWalletBalances(tx, student.id);

        if (balances[input.from] < input.amount) {
          return { ok: false as const };
        }

        await tx.meritLedger.createMany({ data: ledgerRows });
        await tx.auditLog.create({
          data: {
            userId: ctx.user.id,
            action: 'Create',
            entity: 'MeritLedger',
            entityId: student.id,
            meta: {
              source: 'meritLedger.transfer',
              from: input.from,
              to: input.to,
              amount: input.amount,
            },
          },
        });

        const updatedBalances = await loadWalletBalances(tx, student.id);

        return { ok: true as const, balances: updatedBalances };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    if (!transferResult.ok) {
      await auditRejectedTransfer(ctx, input, 'InsufficientBalance');
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'insufficient source balance' });
    }

    return {
      studentId: student.id,
      balances: transferResult.balances,
    };
  }),
});
