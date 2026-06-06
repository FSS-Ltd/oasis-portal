import { TRPCError } from '@trpc/server';
import { Prisma } from '@oasis/db';
import {
  AccessDeniedError,
  isFullAdmin,
  planInvestmentBuy,
  planInvestmentSell,
  requireOwnChild,
  requireSelfStudent,
  type SessionUser,
} from '@oasis/domain';
import { generateNavSeries } from '@oasis/domain/investmentSim';
import { z } from 'zod';
import type { AppContext } from '../context.js';
import { assertStudentPortalAccess } from '../lib/student-portal-access.js';
import {
  readCachedInvestmentMarketData,
  refreshTwelveDataQuotes,
  type TwelveDataRefreshDb,
} from '../services/market-data/twelve-data-refresh.js';
import type { InvestmentMarketDataStorageDb } from '../services/market-data/investment-market-data-storage.js';
import { authedProcedure, router } from '../trpc.js';

const DEFAULT_NAV_SEED = 'oasis-v1';
const NAV_EPOCH = new Date('2026-01-01T00:00:00.000Z');
const UNIT_SCALE = 1_000_000;

type AuthedContext = AppContext & { user: SessionUser };

interface ActiveStudent {
  id: string;
  active: boolean;
  userId: string | null;
}

export interface NavDto {
  date: Date;
  nav: number;
  dailyReturn: number;
}

const studentInput = z.object({ studentId: z.string().cuid() });

const navHistoryInput = z.object({
  days: z.number().int().positive().max(365).default(30),
});

const buyInput = z.object({
  studentId: z.string().cuid(),
  merits: z.number().int().positive(),
});

const sellInput = z.object({
  studentId: z.string().cuid(),
  units: z.number().positive(),
});

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function daysBetween(from: Date, to: Date): number {
  const millisPerDay = 24 * 60 * 60 * 1000;
  return Math.max(
    0,
    Math.floor((startOfUtcDay(to).getTime() - startOfUtcDay(from).getTime()) / millisPerDay),
  );
}

function navSeed(): string {
  return process.env['INVESTMENT_NAV_SEED'] || DEFAULT_NAV_SEED;
}

function toNumber(value: Prisma.Decimal | number | string): number {
  return Number(value.toString());
}

function toSixDecimal(value: number): Prisma.Decimal {
  return new Prisma.Decimal(value.toFixed(6));
}

function marketDataStorageDb(db: AppContext['db']): InvestmentMarketDataStorageDb {
  return db as unknown as InvestmentMarketDataStorageDb;
}

function twelveDataRefreshDb(db: AppContext['db']): TwelveDataRefreshDb {
  return db as unknown as TwelveDataRefreshDb;
}

function mapNav(row: { date: Date; nav: Prisma.Decimal; dailyReturn: Prisma.Decimal }): NavDto {
  return {
    date: row.date,
    nav: toNumber(row.nav),
    dailyReturn: toNumber(row.dailyReturn),
  };
}

function navForDate(date: Date): NavDto {
  const tickIndex = daysBetween(NAV_EPOCH, date);
  const tick = generateNavSeries({ seed: navSeed(), days: tickIndex + 1 }).at(-1);
  if (!tick) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'could not generate NAV tick' });
  }
  return {
    date: startOfUtcDay(date),
    nav: Number(tick.nav.toFixed(6)),
    dailyReturn: Number(tick.dailyReturn.toFixed(6)),
  };
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

async function assertCanReadInvestment(
  ctx: AuthedContext,
  student: ActiveStudent,
  entity: string,
): Promise<void> {
  if (isFullAdmin(ctx.user)) return;

  if (ctx.user.role === 'Parent') {
    const guardian = await ctx.db.guardian.findUnique({
      where: { userId_studentId: { userId: ctx.user.id, studentId: student.id } },
      select: { studentId: true },
    });
    try {
      requireOwnChild(ctx.user, student.id, guardian ? [guardian.studentId] : []);
      return;
    } catch (err) {
      if (err instanceof AccessDeniedError) {
        await auditAccessDenied(ctx, entity, student.id, err);
      }
      throw err;
    }
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
    `role ${ctx.user.role} cannot access investments`,
  );
}

async function assertCanTransactInvestment(
  ctx: AuthedContext,
  student: ActiveStudent,
  entity: string,
): Promise<void> {
  if (isFullAdmin(ctx.user)) return;

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
    `role ${ctx.user.role} cannot transact investment merits`,
  );
}

async function loadWalletBalance(
  store: Pick<AppContext['db'], 'meritLedger'>,
  studentId: string,
  account: 'Spend' | 'Investment',
): Promise<number> {
  const result = await store.meritLedger.aggregate({
    where: { studentId, account },
    _sum: { delta: true },
  });
  return result._sum.delta ?? 0;
}

async function loadLatestNav(
  store: Pick<AppContext['db'], 'investmentNav'>,
): Promise<NavDto | null> {
  const row = await store.investmentNav.findFirst({
    orderBy: { date: 'desc' },
    select: { date: true, nav: true, dailyReturn: true },
  });
  return row ? mapNav(row) : null;
}

async function tickToday(store: Pick<AppContext['db'], 'investmentNav'>): Promise<{
  nav: NavDto;
  status: 'Created' | 'AlreadyExists';
}> {
  const nextNav = navForDate(new Date());
  const existing = await store.investmentNav.findUnique({
    where: { date: nextNav.date },
    select: { date: true, nav: true, dailyReturn: true },
  });
  if (existing) {
    return { nav: mapNav(existing), status: 'AlreadyExists' };
  }

  const created = await store.investmentNav.create({
    data: {
      date: nextNav.date,
      nav: toSixDecimal(nextNav.nav),
      dailyReturn: toSixDecimal(nextNav.dailyReturn),
    },
    select: { date: true, nav: true, dailyReturn: true },
  });
  return { nav: mapNav(created), status: 'Created' };
}

async function latestNavOrTickToday(
  store: Pick<AppContext['db'], 'investmentNav'>,
): Promise<NavDto> {
  const latest = await loadLatestNav(store);
  if (latest) return latest;
  return (await tickToday(store)).nav;
}

export const investmentRouter = router({
  marketData: authedProcedure.query(async ({ ctx }) =>
    readCachedInvestmentMarketData({ db: marketDataStorageDb(ctx.db) }),
  ),

  account: authedProcedure.input(studentInput).query(async ({ ctx, input }) => {
    const student = await loadActiveStudent(ctx, input.studentId);
    await assertCanReadInvestment(ctx, student, 'investment.account');

    const [account, latestNav, costBasisMerits, transactions] = await Promise.all([
      ctx.db.investmentAccount.findUnique({
        where: { studentId: student.id },
        select: { units: true },
      }),
      loadLatestNav(ctx.db),
      loadWalletBalance(ctx.db, student.id, 'Investment'),
      ctx.db.investmentTransaction.findMany({
        where: { studentId: student.id },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          type: true,
          units: true,
          nav: true,
          feeMerits: true,
          createdAt: true,
        },
      }),
    ]);
    const units = account ? toNumber(account.units) : 0;
    const currentValueMerits = latestNav ? Math.floor(units * latestNav.nav) : 0;

    return {
      studentId: student.id,
      units,
      latestNav,
      currentValueMerits,
      costBasisMerits,
      transactions: transactions.map((transaction) => ({
        id: transaction.id,
        type: transaction.type,
        units: toNumber(transaction.units),
        nav: toNumber(transaction.nav),
        feeMerits: transaction.feeMerits,
        createdAt: transaction.createdAt,
      })),
    };
  }),

  navHistory: authedProcedure.input(navHistoryInput).query(async ({ ctx, input }) => {
    const rows = await ctx.db.investmentNav.findMany({
      orderBy: { date: 'desc' },
      take: input.days,
      select: { date: true, nav: true, dailyReturn: true },
    });
    return rows.map(mapNav).reverse();
  }),

  buy: authedProcedure.input(buyInput).mutation(async ({ ctx, input }) => {
    const student = await loadActiveStudent(ctx, input.studentId);
    await assertCanTransactInvestment(ctx, student, 'investment.buy');

    const result = await ctx.db.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const nav = await latestNavOrTickToday(tx);
        const spendBalance = await loadWalletBalance(tx, student.id, 'Spend');
        if (spendBalance < input.merits) {
          return { ok: false as const, reason: 'InsufficientSpend' };
        }

        const plan = planInvestmentBuy({
          studentId: student.id,
          merits: input.merits,
          nav: nav.nav,
        });

        const account = await tx.investmentAccount.upsert({
          where: { studentId: student.id },
          create: {
            studentId: student.id,
            units: toSixDecimal(plan.units),
          },
          update: {
            units: { increment: toSixDecimal(plan.units) },
          },
          select: { units: true },
        });
        const transaction = await tx.investmentTransaction.create({
          data: {
            studentId: student.id,
            type: 'Buy',
            units: toSixDecimal(plan.units),
            nav: toSixDecimal(nav.nav),
            feeMerits: 0,
          },
          select: { id: true },
        });
        await tx.meritLedger.createMany({ data: plan.ledgerRows });
        await tx.auditLog.create({
          data: {
            userId: ctx.user.id,
            action: 'Create',
            entity: 'InvestmentTransaction',
            entityId: transaction.id,
            meta: {
              source: 'investment.buy',
              studentId: student.id,
              merits: input.merits,
              units: plan.units,
              nav: nav.nav,
            },
          },
        });

        return {
          ok: true as const,
          transactionId: transaction.id,
          units: toNumber(account.units),
          unitsBought: plan.units,
          nav,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    if (!result.ok) {
      await ctx.db.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'Update',
          entity: 'InvestmentTransaction',
          entityId: student.id,
          meta: {
            source: 'investment.buy',
            outcome: 'Rejected',
            reason: result.reason,
            merits: input.merits,
          },
        },
      });
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'insufficient Spend balance' });
    }

    return {
      studentId: student.id,
      transactionId: result.transactionId,
      units: result.units,
      unitsBought: result.unitsBought,
      nav: result.nav,
    };
  }),

  sell: authedProcedure.input(sellInput).mutation(async ({ ctx, input }) => {
    const student = await loadActiveStudent(ctx, input.studentId);
    await assertCanTransactInvestment(ctx, student, 'investment.sell');

    const result = await ctx.db.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const [nav, account, costBasisMerits] = await Promise.all([
          latestNavOrTickToday(tx),
          tx.investmentAccount.findUnique({
            where: { studentId: student.id },
            select: { units: true },
          }),
          loadWalletBalance(tx, student.id, 'Investment'),
        ]);
        const currentUnits = account ? toNumber(account.units) : 0;
        if (!account || input.units > currentUnits) {
          return { ok: false as const, reason: 'InsufficientUnits' };
        }

        const plan = planInvestmentSell({
          studentId: student.id,
          units: input.units,
          currentUnits,
          totalCostBasisMerits: costBasisMerits,
          nav: nav.nav,
        });
        const remainingUnits = Math.max(
          0,
          Math.floor((currentUnits - input.units) * UNIT_SCALE) / UNIT_SCALE,
        );

        const updatedAccount = await tx.investmentAccount.update({
          where: { studentId: student.id },
          data: {
            units: toSixDecimal(remainingUnits),
          },
          select: { units: true },
        });
        const transaction = await tx.investmentTransaction.create({
          data: {
            studentId: student.id,
            type: 'Sell',
            units: toSixDecimal(input.units),
            nav: toSixDecimal(nav.nav),
            feeMerits: plan.feeMerits,
          },
          select: { id: true },
        });
        await tx.meritLedger.createMany({ data: plan.ledgerRows });
        await tx.auditLog.create({
          data: {
            userId: ctx.user.id,
            action: 'Create',
            entity: 'InvestmentTransaction',
            entityId: transaction.id,
            meta: {
              source: 'investment.sell',
              studentId: student.id,
              units: input.units,
              nav: nav.nav,
              proceedsMerits: plan.proceedsMerits,
              feeMerits: plan.feeMerits,
              netMerits: plan.netMerits,
              costBasisMerits: plan.costBasisMerits,
              investmentReturnDelta: plan.investmentReturnDelta,
            },
          },
        });

        return {
          ok: true as const,
          transactionId: transaction.id,
          units: toNumber(updatedAccount.units),
          unitsSold: input.units,
          nav,
          proceedsMerits: plan.proceedsMerits,
          feeMerits: plan.feeMerits,
          netMerits: plan.netMerits,
          costBasisMerits: plan.costBasisMerits,
          investmentReturnDelta: plan.investmentReturnDelta,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    if (!result.ok) {
      await ctx.db.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'Update',
          entity: 'InvestmentTransaction',
          entityId: student.id,
          meta: {
            source: 'investment.sell',
            outcome: 'Rejected',
            reason: result.reason,
            units: input.units,
          },
        },
      });
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'insufficient investment units' });
    }

    return {
      studentId: student.id,
      transactionId: result.transactionId,
      units: result.units,
      unitsSold: result.unitsSold,
      nav: result.nav,
      proceedsMerits: result.proceedsMerits,
      feeMerits: result.feeMerits,
      netMerits: result.netMerits,
      costBasisMerits: result.costBasisMerits,
      investmentReturnDelta: result.investmentReturnDelta,
    };
  }),

  tickNav: authedProcedure.mutation(async ({ ctx }) => {
    if (!isFullAdmin(ctx.user)) {
      await ctx.db.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'PermissionDenied',
          entity: 'InvestmentNav',
          meta: {
            source: 'investment.tickNav',
            role: ctx.user.role,
            reason: 'full-admin access required',
          },
        },
      });
      throw new TRPCError({ code: 'FORBIDDEN', message: 'full-admin access required' });
    }

    const result = await ctx.db.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const tick = await tickToday(tx);
        await tx.auditLog.create({
          data: {
            userId: ctx.user.id,
            action: 'Create',
            entity: 'InvestmentNav',
            entityId: tick.nav.date.toISOString().slice(0, 10),
            meta: {
              source: 'investment.tickNav',
              status: tick.status,
              seed: navSeed(),
              nav: tick.nav.nav,
              dailyReturn: tick.nav.dailyReturn,
            },
          },
        });
        return tick;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return result;
  }),

  refreshMarketData: authedProcedure.mutation(async ({ ctx }) => {
    if (!isFullAdmin(ctx.user)) {
      await ctx.db.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'PermissionDenied',
          entity: 'MarketDataSnapshot',
          meta: {
            source: 'investment.refreshMarketData',
            role: ctx.user.role,
            reason: 'full-admin access required',
          },
        },
      });
      throw new TRPCError({ code: 'FORBIDDEN', message: 'full-admin access required' });
    }

    return refreshTwelveDataQuotes({
      auditUserId: ctx.user.id,
      db: twelveDataRefreshDb(ctx.db),
      mode: 'manual',
    });
  }),
});
