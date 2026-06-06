import { TRPCError } from '@trpc/server';
import { Prisma } from '@oasis/db';
import {
  computeManualTitheDue,
  isValidTitheCadence,
  isValidTithePaymentMode,
  latestCompletedTithePeriod,
  planManualTithePayment,
  type ManualTitheDue,
  type ManualTitheEarningEntry,
  type TitheCadence,
  type TithePaymentMode,
} from '@oasis/domain';
import type { AppContext } from '../context.js';

export const DEFAULT_TITHE_PERCENTAGE = 10;
export const DEFAULT_TITHE_CADENCE: TitheCadence = 'Weekly';
export const DEFAULT_TITHE_MODE: TithePaymentMode = 'Percentage';
export const DEFAULT_TITHE_WEEKLY_DAY = 5;
export const DEFAULT_TITHE_MONTHLY_DATE = 1;
const SHOP_TITHE_BLOCK_REASON =
  'You cannot access Merit Shop until you have given your most recent tithe.';

type TitheStore = Pick<
  AppContext['db'],
  'auditLog' | 'behaviourEntry' | 'meritLedger' | 'titheConfig' | 'titheRun'
>;

type TitheTxStore = TitheStore & Pick<AppContext['db'], '$transaction'>;

interface TitheConfigRow {
  studentId: string;
  percentage?: number | null;
  cadence?: string | null;
  mode?: string | null;
  fixedAmount?: number | null;
  weeklyDay?: number | null;
  monthlyDate?: number | null;
  lastRunAt?: Date | null;
}

export interface ManualTitheConfigDto {
  studentId: string;
  percentage: number;
  cadence: TitheCadence;
  mode: TithePaymentMode;
  fixedAmount: number | null;
  weeklyDay: number;
  monthlyDate: number;
  lastRunAt: Date | null;
}

export interface ManualTitheStatusDto extends ManualTitheDue {
  studentId: string;
  config: ManualTitheConfigDto;
  period: { start: Date; end: Date };
  paid: boolean;
  paidAt: Date | null;
  paymentValid: boolean;
  canPay: boolean;
  shopBlocked: boolean;
  shopBlockReason: string | null;
}

export interface ManualTithePaymentDto extends ManualTitheStatusDto {
  titheAmount: number;
}

function mapConfig(input: TitheConfigRow): ManualTitheConfigDto {
  const cadence = input.cadence && isValidTitheCadence(input.cadence)
    ? input.cadence
    : DEFAULT_TITHE_CADENCE;
  const mode = input.mode && isValidTithePaymentMode(input.mode)
    ? input.mode
    : DEFAULT_TITHE_MODE;

  return {
    studentId: input.studentId,
    percentage: Math.max(DEFAULT_TITHE_PERCENTAGE, input.percentage ?? DEFAULT_TITHE_PERCENTAGE),
    cadence,
    mode,
    fixedAmount: input.fixedAmount ?? null,
    weeklyDay: input.weeklyDay ?? DEFAULT_TITHE_WEEKLY_DAY,
    monthlyDate: input.monthlyDate ?? DEFAULT_TITHE_MONTHLY_DATE,
    lastRunAt: input.lastRunAt ?? null,
  };
}

export function defaultTitheConfig(studentId: string): ManualTitheConfigDto {
  return mapConfig({ studentId });
}

function dueForConfig(
  config: ManualTitheConfigDto,
  entries: readonly ManualTitheEarningEntry[],
): ManualTitheDue & { paymentValid: boolean } {
  if (config.mode === 'Percentage') {
    return {
      ...computeManualTitheDue({
        mode: config.mode,
        percentage: config.percentage,
        entries,
      }),
      paymentValid: true,
    };
  }

  const minimum = computeManualTitheDue({
    mode: 'Percentage',
    percentage: DEFAULT_TITHE_PERCENTAGE,
    entries,
  });
  const selectedAmount = config.fixedAmount ?? 0;
  return {
    grossMerits: minimum.grossMerits,
    minimumAmount: minimum.minimumAmount,
    selectedAmount,
    paymentValid: selectedAmount >= minimum.minimumAmount,
  };
}

async function loadTitheEntries(
  store: TitheStore,
  input: { studentId: string; period: { start: Date; end: Date } },
): Promise<ManualTitheEarningEntry[]> {
  const [behaviour, investmentReturns] = await Promise.all([
    store.behaviourEntry.findMany({
      where: {
        studentId: input.studentId,
        createdAt: { gte: input.period.start, lt: input.period.end },
        deletedAt: null,
      },
      select: { type: true, meritDelta: true },
    }),
    store.meritLedger.findMany({
      where: {
        studentId: input.studentId,
        account: 'InvestmentReturn',
        delta: { lt: 0 },
        reason: 'investment:sell',
        createdAt: { gte: input.period.start, lt: input.period.end },
      },
      select: { delta: true },
    }),
  ]);

  return [
    ...behaviour.map((entry) => ({
      source:
        entry.type === 'Merit'
          ? ('BehaviourMerit' as const)
          : entry.type === 'Demerit'
            ? ('BehaviourDemerit' as const)
            : ('BehaviourDemerit' as const),
      amount: entry.meritDelta,
    })),
    ...investmentReturns.map((entry) => ({
      source: 'InvestmentReturn' as const,
      amount: Math.abs(entry.delta),
    })),
  ];
}

export async function loadManualTitheStatus(
  store: TitheStore,
  input: { now?: Date; studentId: string },
): Promise<ManualTitheStatusDto> {
  const configRow = await store.titheConfig.findUnique({
    where: { studentId: input.studentId },
  });
  const config = mapConfig(configRow ?? { studentId: input.studentId });
  const period = latestCompletedTithePeriod({
    cadence: config.cadence,
    monthlyDate: config.monthlyDate,
    now: input.now ?? new Date(),
    weeklyDay: config.weeklyDay,
  });
  const [run, entries] = await Promise.all([
    store.titheRun.findUnique({
      where: {
        studentId_cadence_periodStart: {
          studentId: input.studentId,
          cadence: config.cadence,
          periodStart: period.start,
        },
      },
      select: { createdAt: true },
    }),
    loadTitheEntries(store, { studentId: input.studentId, period }),
  ]);
  const due = dueForConfig(config, entries);
  const paid = run !== null;
  const shopBlocked = !paid && due.minimumAmount > 0;

  return {
    studentId: input.studentId,
    config,
    period,
    grossMerits: due.grossMerits,
    minimumAmount: due.minimumAmount,
    selectedAmount: due.selectedAmount,
    paid,
    paidAt: run?.createdAt ?? null,
    paymentValid: due.paymentValid,
    canPay: !paid && due.selectedAmount > 0 && due.paymentValid,
    shopBlocked,
    shopBlockReason: shopBlocked ? SHOP_TITHE_BLOCK_REASON : null,
  };
}

async function loadSpendBalance(
  store: Pick<AppContext['db'], 'meritLedger'>,
  studentId: string,
): Promise<number> {
  const result = await store.meritLedger.aggregate({
    where: { studentId, account: 'Spend' },
    _sum: { delta: true },
  });
  return result._sum.delta ?? 0;
}

export async function payManualTithe(input: {
  auditUserId: string;
  db: TitheTxStore;
  now?: Date;
  studentId: string;
}): Promise<ManualTithePaymentDto> {
  const result = await input.db.$transaction(
    async (tx: Prisma.TransactionClient) => {
      const status = await loadManualTitheStatus(tx, {
        studentId: input.studentId,
        ...(input.now ? { now: input.now } : {}),
      });
      if (status.paid || status.minimumAmount === 0) {
        return { status, paidNow: false as const };
      }
      if (!status.paymentValid || status.selectedAmount < status.minimumAmount) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'selected tithe amount is below the 10% minimum',
        });
      }

      const spendBalance = await loadSpendBalance(tx, input.studentId);
      if (spendBalance < status.selectedAmount) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'insufficient Spend balance' });
      }

      const rows = planManualTithePayment({
        studentId: input.studentId,
        amount: status.selectedAmount,
        periodStart: status.period.start,
        cadence: status.config.cadence,
      });
      await tx.titheRun.create({
        data: {
          studentId: input.studentId,
          cadence: status.config.cadence,
          periodStart: status.period.start,
          periodEnd: status.period.end,
          grossMerits: status.grossMerits,
          minimumAmount: status.minimumAmount,
          titheAmount: status.selectedAmount,
        },
      });
      await tx.meritLedger.createMany({ data: rows });
      await tx.titheConfig.upsert({
        where: { studentId: input.studentId },
        create: {
          studentId: input.studentId,
          percentage: status.config.percentage,
          cadence: status.config.cadence,
          mode: status.config.mode,
          fixedAmount: status.config.fixedAmount,
          weeklyDay: status.config.weeklyDay,
          monthlyDate: status.config.monthlyDate,
          lastRunAt: new Date(),
        },
        update: { lastRunAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          userId: input.auditUserId,
          action: 'Create',
          entity: 'TitheRun',
          entityId: input.studentId,
          meta: {
            source: 'tithe.payDue',
            cadence: status.config.cadence,
            periodStart: status.period.start.toISOString(),
            periodEnd: status.period.end.toISOString(),
            grossMerits: status.grossMerits,
            minimumAmount: status.minimumAmount,
            titheAmount: status.selectedAmount,
          },
        },
      });

      return { status, paidNow: true as const };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );

  return {
    ...result.status,
    paid: true,
    canPay: false,
    shopBlocked: false,
    shopBlockReason: null,
    titheAmount: result.status.selectedAmount,
  };
}
