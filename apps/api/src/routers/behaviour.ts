import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import {
  AccessDeniedError,
  DEMERIT_COST,
  canViewBehaviourReports,
  isFullAdmin,
  rowsForDemerit,
  rowsForMerit,
  type SessionUser,
} from '@oasis/domain';
import type { AppContext } from '../context.js';
import { authedProcedure, router } from '../trpc.js';

type AuthedContext = AppContext & { user: SessionUser };

type TrendBucket = 'daily' | 'weekly' | 'monthly';

function canUseBehaviourWorkflow(user: SessionUser): boolean {
  return isFullAdmin(user) || user.role === 'Supervisor';
}

async function auditPermissionDenied(
  ctx: AuthedContext,
  entity: string,
  meta: Record<string, unknown>,
): Promise<never> {
  const denied = new AccessDeniedError('behaviour workflow requires full-admin or Supervisor');
  await ctx.db.auditLog.create({
    data: {
      userId: ctx.user.id,
      action: 'PermissionDenied',
      entity,
      meta: { ...meta, reason: denied.message },
    },
  });
  throw new TRPCError({ code: 'FORBIDDEN', message: denied.message, cause: denied });
}

async function requireBehaviourWorkflow(ctx: AuthedContext, entity: string): Promise<void> {
  if (canUseBehaviourWorkflow(ctx.user)) return;
  await auditPermissionDenied(ctx, entity, { role: ctx.user.role });
}

async function requireCanRequestSensitive(ctx: AuthedContext, studentId: string): Promise<void> {
  if (isFullAdmin(ctx.user)) return;
  const denied = new AccessDeniedError('sensitive entries are full-admin only');
  await ctx.db.auditLog.create({
    data: {
      userId: ctx.user.id,
      action: 'PermissionDenied',
      entity: 'BehaviourEntry',
      meta: {
        studentId,
        requested: 'Sensitive',
        role: ctx.user.role,
        reason: denied.message,
      },
    },
  });
  throw new TRPCError({ code: 'FORBIDDEN', message: denied.message, cause: denied });
}

function decryptRequired(
  decrypt: (value: string | null | undefined) => string | null,
  value: string,
  entity: string,
): string {
  const decrypted = decrypt(value);
  if (!decrypted) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `${entity} decrypt failed` });
  }
  return decrypted;
}

function decryptOptional(
  decrypt: (value: string | null | undefined) => string | null,
  value: string | null,
): string | null {
  if (!value) return null;
  return decrypt(value);
}

function normalizeDate(date: Date): Date {
  return new Date(`${date.toISOString().slice(0, 10)}T00:00:00.000Z`);
}

function dayEnd(date: Date): Date {
  const end = normalizeDate(date);
  end.setUTCDate(end.getUTCDate() + 1);
  return end;
}

function dateKey(date: Date): string {
  return normalizeDate(date).toISOString().slice(0, 10);
}

function trendKey(date: Date, bucket: TrendBucket): string {
  const normalized = normalizeDate(date);
  if (bucket === 'daily') return dateKey(normalized);
  if (bucket === 'monthly') return `${String(normalized.getUTCFullYear())}-${String(normalized.getUTCMonth() + 1).padStart(2, '0')}`;

  const day = normalized.getUTCDay();
  const daysFromMonday = day === 0 ? 6 : day - 1;
  normalized.setUTCDate(normalized.getUTCDate() - daysFromMonday);
  return dateKey(normalized);
}

async function requireBehaviourReportAccess(ctx: AuthedContext, entity: string): Promise<void> {
  if (canViewBehaviourReports(ctx.user)) return;
  const denied = new AccessDeniedError('behaviour reports require Head or behaviour-viewer');
  await ctx.db.auditLog.create({
    data: {
      userId: ctx.user.id,
      action: 'PermissionDenied',
      entity,
      meta: { role: ctx.user.role, reason: denied.message },
    },
  });
  throw new TRPCError({ code: 'FORBIDDEN', message: denied.message, cause: denied });
}

export const behaviourRouter = router({
  dailyMerits: authedProcedure
    .input(z.object({ date: z.coerce.date() }))
    .query(async ({ ctx, input }) => {
      await requireBehaviourReportAccess(ctx, 'behaviour.dailyMerits');
      const from = normalizeDate(input.date);
      const to = dayEnd(input.date);

      const rows = await ctx.db.behaviourEntry.findMany({
        where: {
          type: 'Merit',
          createdAt: { gte: from, lt: to },
        },
        include: {
          student: { select: { id: true, fullNameEnc: true, yearGroup: true } },
          recordedBy: { select: { id: true, fullNameEnc: true, role: true } },
        },
        orderBy: { createdAt: 'desc' },
      });

      await ctx.db.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'DecryptPii',
          entity: 'BehaviourEntry',
          meta: { source: 'behaviour.dailyMerits', count: rows.length },
        },
      });

      return {
        date: dateKey(input.date),
        merits: rows.map((row) => ({
          id: row.id,
          studentId: row.studentId,
          studentName: decryptRequired(ctx.db.$enc.decrypt, row.student.fullNameEnc, 'student PII'),
          yearGroup: row.student.yearGroup,
          category: row.category,
          meritDelta: row.meritDelta,
          visibility: row.visibility,
          recordedById: row.recordedById,
          recordedByName: decryptRequired(ctx.db.$enc.decrypt, row.recordedBy.fullNameEnc, 'user PII'),
          recordedByRole: row.recordedBy.role,
          createdAt: row.createdAt,
        })),
      };
    }),

  trends: authedProcedure
    .input(
      z
        .object({
          bucket: z.enum(['daily', 'weekly', 'monthly']),
          from: z.coerce.date(),
          to: z.coerce.date(),
        })
        .refine((input) => normalizeDate(input.from).getTime() <= normalizeDate(input.to).getTime(), {
          message: 'from must be on or before to',
          path: ['to'],
        }),
    )
    .query(async ({ ctx, input }) => {
      await requireBehaviourReportAccess(ctx, 'behaviour.trends');
      const from = normalizeDate(input.from);
      const to = dayEnd(input.to);

      const rows = await ctx.db.behaviourEntry.findMany({
        where: {
          createdAt: { gte: from, lt: to },
        },
        select: {
          id: true,
          type: true,
          meritDelta: true,
          visibility: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
      });

      const buckets = new Map<
        string,
        {
          bucket: string;
          meritCount: number;
          meritTotal: number;
          demeritCount: number;
          demeritTotal: number;
          sensitiveCount: number;
        }
      >();

      for (const row of rows) {
        const key = trendKey(row.createdAt, input.bucket);
        const current =
          buckets.get(key) ??
          {
            bucket: key,
            meritCount: 0,
            meritTotal: 0,
            demeritCount: 0,
            demeritTotal: 0,
            sensitiveCount: 0,
          };
        if (row.type === 'Merit') {
          current.meritCount += 1;
          current.meritTotal += row.meritDelta;
        } else {
          current.demeritCount += 1;
          current.demeritTotal += Math.abs(row.meritDelta);
        }
        if (row.visibility === 'Sensitive') current.sensitiveCount += 1;
        buckets.set(key, current);
      }

      return {
        bucket: input.bucket,
        from: dateKey(from),
        to: dateKey(input.to),
        points: [...buckets.values()].sort((a, b) => a.bucket.localeCompare(b.bucket)),
      };
    }),

  listForStudent: authedProcedure
    .input(
      z.object({
        studentId: z.string().min(1),
        includeSensitive: z.boolean().optional().default(false),
      }),
    )
    .query(async ({ ctx, input }) => {
      await requireBehaviourWorkflow(ctx, 'behaviour.listForStudent');
      if (input.includeSensitive) {
        await requireCanRequestSensitive(ctx, input.studentId);
      }

      const student = await ctx.db.student.findUnique({
        where: { id: input.studentId },
        select: { id: true, active: true, fullNameEnc: true },
      });
      if (!student) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'student not found' });
      }
      if (!student.active) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'student is inactive' });
      }

      const canReadSensitive = isFullAdmin(ctx.user);
      const entries = await ctx.withRls((tx) =>
        tx.behaviourEntry.findMany({
          where: {
            studentId: input.studentId,
            ...(canReadSensitive ? {} : { visibility: 'General' as const }),
          },
          select: {
            id: true,
            type: true,
            category: true,
            noteEnc: true,
            visibility: true,
            meritDelta: true,
            recordedById: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        }),
      );

      const rows = entries.map((entry) => ({
        id: entry.id,
        studentId: input.studentId,
        type: entry.type,
        category: entry.category,
        note: decryptOptional(ctx.db.$enc.decrypt, entry.noteEnc),
        visibility: entry.visibility,
        meritDelta: entry.meritDelta,
        recordedById: entry.recordedById,
        createdAt: entry.createdAt,
      }));

      const sensitiveRows = rows.filter((entry) => entry.visibility === 'Sensitive');
      const decryptedSensitiveNotes = sensitiveRows.filter((entry) => entry.note !== null).length;

      await ctx.db.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'DecryptPii',
          entity: 'Student',
          entityId: input.studentId,
          meta: { source: 'behaviour.listForStudent', fields: ['fullName'], noteCount: rows.length },
        },
      });
      if (sensitiveRows.length > 0) {
        await ctx.db.auditLog.create({
          data: {
            userId: ctx.user.id,
            action: 'ReadSensitive',
            entity: 'BehaviourEntry',
            meta: {
              studentId: input.studentId,
              count: sensitiveRows.length,
              source: 'behaviour.listForStudent',
            },
          },
        });
      }
      if (decryptedSensitiveNotes > 0) {
        await ctx.db.auditLog.create({
          data: {
            userId: ctx.user.id,
            action: 'DecryptSensitive',
            entity: 'BehaviourEntry',
            meta: {
              studentId: input.studentId,
              count: decryptedSensitiveNotes,
              source: 'behaviour.listForStudent',
            },
          },
        });
      }

      return {
        studentId: student.id,
        studentName: decryptRequired(ctx.db.$enc.decrypt, student.fullNameEnc, 'student PII'),
        entries: rows,
      };
    }),

  log: authedProcedure
    .input(
      z.object({
        studentId: z.string().min(1),
        type: z.enum(['Merit', 'Demerit']),
        category: z.string().trim().min(1).max(120),
        note: z.string().trim().min(1).max(2000).optional(),
        visibility: z.enum(['General', 'Sensitive']).default('General'),
        // Merit: positive integer; Demerit: server overrides to DEMERIT_COST.
        amount: z.number().int().positive().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireBehaviourWorkflow(ctx, 'behaviour.log');
      if (input.type === 'Merit' && input.amount === undefined) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'merit amount is required' });
      }

      const student = await ctx.db.student.findUnique({
        where: { id: input.studentId },
        select: { id: true, active: true },
      });
      if (!student) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'student not found' });
      }
      if (!student.active) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'student is inactive' });
      }

      const noteEnc = input.note ? ctx.db.$enc.encrypt(input.note) : null;
      const meritDelta = input.type === 'Merit' ? input.amount ?? 0 : -DEMERIT_COST;

      const result = await ctx.withRls(async (tx) => {
        const behaviour = await tx.behaviourEntry.create({
          data: {
            studentId: input.studentId,
            type: input.type,
            category: input.category,
            noteEnc,
            visibility: input.visibility,
            meritDelta,
            recordedById: ctx.user.id,
          },
        });
        const ledgerRows =
          input.type === 'Merit'
            ? rowsForMerit({
                studentId: input.studentId,
                amount: meritDelta,
                reason: input.category,
                behaviourEntryId: behaviour.id,
              })
            : rowsForDemerit({
                studentId: input.studentId,
                reason: input.category,
                behaviourEntryId: behaviour.id,
              });

        await tx.meritLedger.createMany({ data: ledgerRows });
        return { behaviour, ledgerRowCount: ledgerRows.length };
      });

      await ctx.db.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'Create',
          entity: 'BehaviourEntry',
          entityId: result.behaviour.id,
          meta: {
            studentId: input.studentId,
            type: input.type,
            visibility: input.visibility,
            meritDelta,
          },
        },
      });
      await ctx.db.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'Create',
          entity: 'MeritLedger',
          meta: {
            studentId: input.studentId,
            behaviourEntryId: result.behaviour.id,
            rowCount: result.ledgerRowCount,
          },
        },
      });

      return {
        id: result.behaviour.id,
        studentId: result.behaviour.studentId,
        type: result.behaviour.type,
        category: result.behaviour.category,
        visibility: result.behaviour.visibility,
        meritDelta: result.behaviour.meritDelta,
        recordedById: result.behaviour.recordedById,
        createdAt: result.behaviour.createdAt,
      };
    }),
});
