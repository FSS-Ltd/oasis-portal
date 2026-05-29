import { Prisma } from '@oasis/db';
import {
  computeWeeklyTithe,
  endOfTitheWeek,
  isValidTithePercentage,
  startOfTitheWeek,
  type TithePercentage,
} from '@oasis/domain';
import type { AppContext } from '../context.js';

export const TITHE_CADENCE = 'Weekly';
export const DEFAULT_TITHE_PERCENTAGE = 10 satisfies TithePercentage;

export interface TitheRunResultDto {
  studentId: string;
  status: 'Created' | 'AlreadyRun';
  grossMerits: number;
  titheAmount: number;
  ledgerRowsCreated: number;
}

export interface WeeklyTitheRunSummary {
  period: { start: Date; end: Date };
  created: number;
  skipped: number;
  ledgerRowsCreated: number;
  grossMerits: number;
  titheAmount: number;
  runs: TitheRunResultDto[];
}

interface RunWeeklyTitheInput {
  auditSource?: string;
  auditUserId: string | null;
  db: AppContext['db'];
  weekStart: Date;
}

export function toTithePercentage(value: number | null | undefined): TithePercentage {
  if (value === undefined || value === null) return DEFAULT_TITHE_PERCENTAGE;
  if (isValidTithePercentage(value)) return value;
  return DEFAULT_TITHE_PERCENTAGE;
}

export async function runWeeklyTithe({
  auditSource = 'tithe.runWeek',
  auditUserId,
  db,
  weekStart,
}: RunWeeklyTitheInput): Promise<WeeklyTitheRunSummary> {
  const periodStart = startOfTitheWeek(weekStart);
  const periodEnd = endOfTitheWeek(periodStart);
  const runTimestamp = new Date();

  const result = await db.$transaction(
    async (tx: Prisma.TransactionClient) => {
      const students = await tx.student.findMany({
        where: { active: true },
        select: { id: true },
      });
      const studentIds = students.map((student) => student.id);

      const [configs, entries] = await Promise.all([
        tx.titheConfig.findMany({
          where: { studentId: { in: studentIds } },
          select: { studentId: true, percentage: true },
        }),
        tx.behaviourEntry.findMany({
          where: {
            studentId: { in: studentIds },
            createdAt: { gte: periodStart, lt: periodEnd },
            deletedAt: null,
          },
          select: { studentId: true, type: true, meritDelta: true },
        }),
      ]);

      const percentageByStudent = new Map(
        configs.map((config) => [config.studentId, toTithePercentage(config.percentage)]),
      );
      const entriesByStudent = new Map<
        string,
        { type: 'Merit' | 'Demerit' | 'General'; meritDelta: number }[]
      >();

      for (const entry of entries) {
        const studentEntries = entriesByStudent.get(entry.studentId) ?? [];
        studentEntries.push({ type: entry.type, meritDelta: entry.meritDelta });
        entriesByStudent.set(entry.studentId, studentEntries);
      }

      const runs: TitheRunResultDto[] = [];
      let created = 0;
      let skipped = 0;
      let ledgerRowsCreated = 0;
      let grossMerits = 0;
      let titheAmount = 0;

      for (const student of students) {
        const existingRun = await tx.titheRun.findUnique({
          where: { studentId_periodStart: { studentId: student.id, periodStart } },
          select: { grossMerits: true, titheAmount: true },
        });

        if (existingRun) {
          skipped += 1;
          runs.push({
            studentId: student.id,
            status: 'AlreadyRun',
            grossMerits: existingRun.grossMerits,
            titheAmount: existingRun.titheAmount,
            ledgerRowsCreated: 0,
          });
          continue;
        }

        const computed = computeWeeklyTithe({
          studentId: student.id,
          percentage: percentageByStudent.get(student.id) ?? DEFAULT_TITHE_PERCENTAGE,
          periodStart,
          periodEnd,
          entries: entriesByStudent.get(student.id) ?? [],
        });

        await tx.titheRun.create({
          data: {
            studentId: student.id,
            periodStart,
            periodEnd,
            grossMerits: computed.grossMerits,
            titheAmount: computed.titheAmount,
          },
        });

        if (computed.rows.length > 0) {
          await tx.meritLedger.createMany({ data: computed.rows });
        }

        await tx.titheConfig.upsert({
          where: { studentId: student.id },
          create: {
            studentId: student.id,
            percentage: percentageByStudent.get(student.id) ?? DEFAULT_TITHE_PERCENTAGE,
            cadence: TITHE_CADENCE,
            lastRunAt: runTimestamp,
          },
          update: { lastRunAt: runTimestamp },
        });

        created += 1;
        ledgerRowsCreated += computed.rows.length;
        grossMerits += computed.grossMerits;
        titheAmount += computed.titheAmount;
        runs.push({
          studentId: student.id,
          status: 'Created',
          grossMerits: computed.grossMerits,
          titheAmount: computed.titheAmount,
          ledgerRowsCreated: computed.rows.length,
        });
      }

      await tx.auditLog.create({
        data: {
          userId: auditUserId,
          action: 'Create',
          entity: 'TitheRun',
          meta: {
            source: auditSource,
            periodStart: periodStart.toISOString(),
            periodEnd: periodEnd.toISOString(),
            students: studentIds.length,
            created,
            skipped,
            ledgerRowsCreated,
            grossMerits,
            titheAmount,
          },
        },
      });

      return { created, skipped, ledgerRowsCreated, grossMerits, titheAmount, runs };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );

  return {
    period: { start: periodStart, end: periodEnd },
    ...result,
  };
}
