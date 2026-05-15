import { TRPCError } from '@trpc/server';
import { Prisma } from '@oasis/db';
import {
  AccessDeniedError,
  computeWeeklyTithe,
  endOfTitheWeek,
  isFullAdmin,
  isValidTithePercentage,
  requireOwnChild,
  startOfTitheWeek,
  type SessionUser,
  type TithePercentage,
} from '@oasis/domain';
import { z } from 'zod';
import type { AppContext } from '../context.js';
import { authedProcedure, router } from '../trpc.js';

const TITHE_CADENCE = 'Weekly';
const DEFAULT_TITHE_PERCENTAGE = 10 satisfies TithePercentage;
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

export interface TitheRunResultDto {
  studentId: string;
  status: 'Created' | 'AlreadyRun';
  grossMerits: number;
  titheAmount: number;
  ledgerRowsCreated: number;
}

const studentInput = z.object({ studentId: z.string().cuid() });

const setPercentageInput = z.object({
  studentId: z.string().cuid(),
  percentage: tithePercentageInput,
});

const runWeekInput = z.object({
  weekStart: z.coerce.date(),
});

function toTithePercentage(value: number | null | undefined): TithePercentage {
  if (value === undefined || value === null) return DEFAULT_TITHE_PERCENTAGE;
  if (isValidTithePercentage(value)) return value;
  return DEFAULT_TITHE_PERCENTAGE;
}

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

    const periodStart = startOfTitheWeek(input.weekStart);
    const periodEnd = endOfTitheWeek(periodStart);
    const runTimestamp = new Date();

    const result = await ctx.db.$transaction(
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
            userId: ctx.user.id,
            action: 'Create',
            entity: 'TitheRun',
            meta: {
              source: 'tithe.runWeek',
              periodStart: periodStart.toISOString().slice(0, 10),
              periodEnd: periodEnd.toISOString().slice(0, 10),
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
  }),
});
