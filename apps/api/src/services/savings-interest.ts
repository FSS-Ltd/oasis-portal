import { Prisma } from '@oasis/db';
import { calculateMonthlySavingsInterest, rowsForSavingsInterest } from '@oasis/domain';
import type { AppContext } from '../context.js';

type SavingsInterestDb = Pick<AppContext['db'], '$transaction'>;

export interface SavingsInterestRunResultDto {
  studentId: string;
  status: 'Created' | 'AlreadyRun';
  savingBalance: number;
  interestAmount: number;
  ledgerRowsCreated: number;
}

export interface MonthlySavingsInterestSummary {
  period: { start: Date; end: Date };
  created: number;
  skipped: number;
  ledgerRowsCreated: number;
  interestAmount: number;
  runs: SavingsInterestRunResultDto[];
}

function startOfUtcMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function addUtcMonths(date: Date, months: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
}

export function previousSavingsInterestMonth(referenceDate = new Date()): {
  start: Date;
  end: Date;
} {
  const end = startOfUtcMonth(referenceDate);
  return { start: addUtcMonths(end, -1), end };
}

export async function runMonthlySavingsInterest(input: {
  auditUserId: string | null;
  db: SavingsInterestDb;
  periodStart?: Date;
}): Promise<MonthlySavingsInterestSummary> {
  const requestedPeriod = input.periodStart
    ? { start: startOfUtcMonth(input.periodStart), end: addUtcMonths(input.periodStart, 1) }
    : previousSavingsInterestMonth();

  const result = await input.db.$transaction(
    async (tx: Prisma.TransactionClient) => {
      const students = await tx.student.findMany({
        where: { active: true },
        select: { id: true },
      });
      let created = 0;
      let skipped = 0;
      let ledgerRowsCreated = 0;
      let totalInterest = 0;
      const runs: SavingsInterestRunResultDto[] = [];

      for (const student of students) {
        const existing = await tx.savingsInterestRun.findUnique({
          where: {
            studentId_periodStart: {
              studentId: student.id,
              periodStart: requestedPeriod.start,
            },
          },
          select: { savingBalance: true, interestAmount: true },
        });
        if (existing) {
          skipped += 1;
          runs.push({
            studentId: student.id,
            status: 'AlreadyRun',
            savingBalance: existing.savingBalance,
            interestAmount: existing.interestAmount,
            ledgerRowsCreated: 0,
          });
          continue;
        }

        const balance = await tx.meritLedger.aggregate({
          where: { studentId: student.id, account: 'Saving' },
          _sum: { delta: true },
        });
        const savingBalance = balance._sum.delta ?? 0;
        const interestAmount = calculateMonthlySavingsInterest({ savingBalance });
        const rows =
          interestAmount > 0
            ? rowsForSavingsInterest({
                studentId: student.id,
                amount: interestAmount,
                periodStart: requestedPeriod.start,
              })
            : [];

        await tx.savingsInterestRun.create({
          data: {
            studentId: student.id,
            periodStart: requestedPeriod.start,
            periodEnd: requestedPeriod.end,
            savingBalance,
            interestAmount,
          },
        });
        if (rows.length > 0) {
          await tx.meritLedger.createMany({ data: rows });
        }

        created += 1;
        ledgerRowsCreated += rows.length;
        totalInterest += interestAmount;
        runs.push({
          studentId: student.id,
          status: 'Created',
          savingBalance,
          interestAmount,
          ledgerRowsCreated: rows.length,
        });
      }

      await tx.auditLog.create({
        data: {
          userId: input.auditUserId,
          action: 'Create',
          entity: 'SavingsInterestRun',
          meta: {
            source: 'savingsInterest.runMonthly',
            periodStart: requestedPeriod.start.toISOString(),
            periodEnd: requestedPeriod.end.toISOString(),
            students: students.length,
            created,
            skipped,
            ledgerRowsCreated,
            interestAmount: totalInterest,
          },
        },
      });

      return { created, skipped, ledgerRowsCreated, interestAmount: totalInterest, runs };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );

  return {
    period: requestedPeriod,
    ...result,
  };
}
