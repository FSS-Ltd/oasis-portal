import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import {
  AccessDeniedError,
  canCreateSensitiveBehaviour,
  canUseClubsLeadPortal,
  canUseAllStudentSupervisorWorkflow,
  canViewSensitiveBehaviour,
  canViewBehaviourReports,
  demeritMeritDeltaForCategory,
  demeritPolicyStatusForEntries,
  demeritPolicyTransitionForEntries,
  isFullAdmin,
  isStaff,
  rowsForDemerit,
  rowsForMerit,
  type SessionUser,
} from '@oasis/domain';
import type { AppContext } from '../context.js';
import {
  loadDailyYearBandScope,
  studentMatchesDailyScope,
  studentWhereForDailyScope,
  type DailyYearBandScope,
} from '../lib/daily-year-band-scope.js';
import {
  BEHAVIOUR_NOTIFICATION_EMAIL_SUBJECT,
  buildBehaviourNotificationEmail,
  createResendEmailClient,
  type EmailClient,
} from '../lib/email.js';
import { localDayBounds } from '../lib/local-day.js';
import { authedProcedure, fullAdminProcedure, router } from '../trpc.js';

type AuthedContext = AppContext & { user: SessionUser };

type BehaviourType = 'Merit' | 'Demerit' | 'General';
type BehaviourVisibility = 'General' | 'Sensitive';
type TrendBucket = 'daily' | 'weekly' | 'monthly';

interface ProposedDemeritEntry {
  category: string;
  meritDelta: number;
  note?: string | null | undefined;
  type: 'Demerit';
}

export interface BehaviourRouterDeps {
  emailClient?: EmailClient;
}

interface BehaviourNotificationGuardian {
  user: {
    id: string;
    role: SessionUser['role'];
    fullNameEnc: string;
    emailEnc: string;
  };
}

interface BehaviourNotificationEntry {
  id: string;
  studentId: string;
  studentNameEnc: string;
  type: BehaviourType;
  category: string;
  note: string | null;
  recordedById: string;
  visibility: BehaviourVisibility;
}

interface ActiveStudent {
  id: string;
  active: boolean;
  fullNameEnc: string;
  yearGroup: string;
}

const behaviourTypeSchema = z.enum(['Merit', 'Demerit', 'General']);
const behaviourVisibilitySchema = z.enum(['General', 'Sensitive']);
const behaviourCategorySchema = z.string().trim().min(1).max(120);
const behaviourNoteSchema = z.string().trim().min(1).max(2000);
const behaviourUpdateNoteSchema = z.string().trim().max(2000).nullable().optional();
const behaviourAmountSchema = z.number().int().positive();

const logEntrySchema = z.object({
  category: behaviourCategorySchema,
  note: behaviourNoteSchema.optional(),
  amount: behaviourAmountSchema.optional(),
  count: z.number().int().positive().max(50).default(1),
});
const studentIdsSchema = z.array(z.string().min(1)).min(1).max(50);

type CreatedBehaviourEntry = {
  id: string;
  studentId: string;
  type: BehaviourType;
  category: string;
  noteEnc: string | null;
  visibility: BehaviourVisibility;
  meritDelta: number;
  recordedById: string;
  createdAt: Date;
};

function canUseBehaviourWorkflow(user: SessionUser): boolean {
  return isFullAdmin(user) || isStaff(user) || canUseClubsLeadPortal(user);
}

async function auditPermissionDenied(
  ctx: AuthedContext,
  entity: string,
  meta: Record<string, unknown>,
): Promise<never> {
  const denied = new AccessDeniedError(
    'behaviour workflow requires full-admin, ClubsAdmin, Supervisor, or ClubsLead',
  );
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
  if (canViewSensitiveBehaviour(ctx.user)) return;
  const denied = new AccessDeniedError('sensitive entries require full-admin access');
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

async function requireCanCreateSensitive(
  ctx: AuthedContext,
  input: { studentId: string; type: BehaviourType },
): Promise<void> {
  if (canCreateSensitiveBehaviour(ctx.user, input)) return;
  const denied = new AccessDeniedError(
    'sensitive behaviour requires Head, HeadOfDiscipline, or the recording staff author',
  );
  await ctx.db.auditLog.create({
    data: {
      userId: ctx.user.id,
      action: 'PermissionDenied',
      entity: 'BehaviourEntry',
      meta: {
        studentId: input.studentId,
        requested: 'Sensitive',
        type: input.type,
        role: ctx.user.role,
        reason: denied.message,
      },
    },
  });
  throw new TRPCError({ code: 'FORBIDDEN', message: denied.message, cause: denied });
}

async function denyOutOfDailyScope(
  ctx: AuthedContext,
  entity: string,
  meta: Record<string, unknown>,
): Promise<never> {
  const denied = new AccessDeniedError('student is outside supervisor assigned year band');
  await ctx.db.auditLog.create({
    data: {
      userId: ctx.user.id,
      action: 'PermissionDenied',
      entity,
      meta: { ...meta, role: ctx.user.role, reason: denied.message },
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

function isBlankNote(note: string | null | undefined): boolean {
  return note === undefined || note === null || note.trim() === '';
}

function trendKey(date: Date, bucket: TrendBucket): string {
  const normalized = normalizeDate(date);
  if (bucket === 'daily') return dateKey(normalized);
  if (bucket === 'monthly')
    return `${String(normalized.getUTCFullYear())}-${String(normalized.getUTCMonth() + 1).padStart(2, '0')}`;

  const day = normalized.getUTCDay();
  const daysFromMonday = day === 0 ? 6 : day - 1;
  normalized.setUTCDate(normalized.getUTCDate() - daysFromMonday);
  return dateKey(normalized);
}

async function requireBehaviourReportAccess(ctx: AuthedContext, entity: string): Promise<void> {
  if (canViewBehaviourReports(ctx.user)) return;
  const denied = new AccessDeniedError(
    'behaviour reports require Head, HeadOfDiscipline, or behaviour-viewer',
  );
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

function visibleBehaviourWhere(user: SessionUser) {
  if (canViewSensitiveBehaviour(user)) return { deletedAt: null };
  if (canUseClubsLeadPortal(user)) {
    return {
      deletedAt: null,
      visibility: 'General' as const,
      student: {
        active: true,
        clubSignups: {
          some: {
            status: 'Active' as const,
            club: {
              active: true,
              leadAssignments: { some: { userId: user.id } },
            },
          },
        },
      },
    };
  }
  if (user.role === 'Supervisor' || user.role === 'ClubsAdmin') {
    return {
      deletedAt: null,
      OR: [
        { visibility: 'General' as const },
        {
          visibility: 'Sensitive' as const,
          type: 'Demerit' as const,
          recordedById: user.id,
        },
        {
          visibility: 'Sensitive' as const,
          type: 'General' as const,
          recordedById: user.id,
        },
      ],
    };
  }
  return { deletedAt: null, visibility: 'General' as const };
}

async function assertAssignedClubLeadStudent(
  ctx: AuthedContext,
  input: { studentId: string; entity: string },
): Promise<void> {
  const signup = await ctx.db.clubSignup.findFirst({
    where: {
      studentId: input.studentId,
      status: 'Active',
      student: { active: true },
      club: {
        active: true,
        leadAssignments: { some: { userId: ctx.user.id } },
      },
    },
    select: { clubId: true },
  });
  if (signup) return;

  const denied = new AccessDeniedError('student is outside assigned clubs');
  await ctx.db.auditLog.create({
    data: {
      userId: ctx.user.id,
      action: 'PermissionDenied',
      entity: input.entity,
      meta: {
        studentId: input.studentId,
        role: ctx.user.role,
        reason: denied.message,
      },
    },
  });
  throw new TRPCError({ code: 'FORBIDDEN', message: denied.message, cause: denied });
}

async function loadActiveScopedStudent(
  ctx: AuthedContext,
  input: { studentId: string; entity: string; date?: Date | undefined },
): Promise<ActiveStudent> {
  const student = await ctx.db.student.findUnique({
    where: { id: input.studentId },
    select: { id: true, active: true, fullNameEnc: true, yearGroup: true },
  });
  if (!student) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'student not found' });
  }
  if (!student.active) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'student is inactive' });
  }
  if (canUseClubsLeadPortal(ctx.user)) {
    await assertAssignedClubLeadStudent(ctx, {
      studentId: input.studentId,
      entity: input.entity,
    });
    return student;
  }
  const scope = await loadDailyYearBandScope(ctx, input.date ?? new Date());
  if (!canUseAllStudentSupervisorWorkflow(ctx.user) && !studentMatchesDailyScope(scope, student)) {
    await denyOutOfDailyScope(ctx, input.entity, {
      studentId: input.studentId,
      studentYearGroup: student.yearGroup,
      date: scope.dayKey,
      assignedBands: scope.assignedBands.map((band) => band.id),
    });
  }
  return student;
}

async function loadActiveScopedStudents(
  ctx: AuthedContext,
  input: { studentIds: readonly string[]; entity: string; date?: Date | undefined },
): Promise<Map<string, ActiveStudent>> {
  const students = new Map<string, ActiveStudent>();
  for (const studentId of input.studentIds) {
    students.set(
      studentId,
      await loadActiveScopedStudent(ctx, {
        studentId,
        entity: input.entity,
        date: input.date,
      }),
    );
  }
  return students;
}

function requireUniqueStudentIds(studentIds: readonly string[]): void {
  if (new Set(studentIds).size !== studentIds.length) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'studentIds must be unique' });
  }
}

function validateSingleBehaviourInput(input: {
  type: BehaviourType;
  category?: string | undefined;
  note?: string | undefined;
  amount?: number | undefined;
}): void {
  if (input.type === 'Merit' && input.amount === undefined) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'merit amount is required' });
  }
  if (input.type !== 'General' && input.category === undefined) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'category is required' });
  }
  if (input.type === 'General' && input.note === undefined) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'general mark note is required' });
  }
  if (input.type === 'General' && input.amount !== undefined) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'general marks have no merit value',
    });
  }
  if (input.type === 'Demerit' && input.amount !== undefined) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'demerit amount is fixed by category',
    });
  }
}

function validateBatchBehaviourInput(input: {
  type: 'Merit' | 'Demerit';
  entries: readonly z.infer<typeof logEntrySchema>[];
}): number {
  for (const [index, entry] of input.entries.entries()) {
    if (input.type === 'Merit' && entry.amount === undefined) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `merit amount is required for entry ${String(index + 1)}`,
      });
    }
    if (input.type === 'Demerit' && entry.amount !== undefined) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `demerit amount is fixed by category for entry ${String(index + 1)}`,
      });
    }
  }
  return input.entries.reduce((sum, entry) => sum + entry.count, 0);
}

function meritDeltaForBehaviour(input: {
  amount?: number | undefined;
  category: string;
  type: BehaviourType;
}): number {
  if (input.type === 'Merit') return input.amount ?? 0;
  if (input.type === 'Demerit') return demeritMeritDeltaForCategory(input.category);
  return 0;
}

function assertBatchEntryLimit(totalEntries: number): void {
  if (totalEntries > 50) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'batch cannot create more than 50 entries',
    });
  }
}

async function assertDemeritStageNotes(
  ctx: AuthedContext,
  input: {
    date?: Date | undefined;
    proposedEntries: readonly ProposedDemeritEntry[];
    studentIds: readonly string[];
  },
): Promise<void> {
  if (input.proposedEntries.length === 0 || input.studentIds.length === 0) return;

  const day = localDayBounds(input.date ?? new Date());
  const rows = await ctx.withRls((tx) =>
    tx.behaviourEntry.findMany({
      where: {
        type: 'Demerit',
        studentId: { in: [...input.studentIds] },
        createdAt: { gte: day.from, lt: day.to },
        ...visibleBehaviourWhere(ctx.user),
      },
      select: {
        category: true,
        meritDelta: true,
        studentId: true,
        type: true,
      },
      orderBy: { createdAt: 'asc' },
    }),
  );

  const entriesByStudent = new Map<
    string,
    Array<{ category: string; meritDelta: number; type: 'Demerit' }>
  >();
  for (const row of rows) {
    if (row.type !== 'Demerit') continue;
    entriesByStudent.set(row.studentId, [
      ...(entriesByStudent.get(row.studentId) ?? []),
      { category: row.category, meritDelta: row.meritDelta, type: 'Demerit' },
    ]);
  }

  for (const studentId of input.studentIds) {
    const currentEntries = [...(entriesByStudent.get(studentId) ?? [])];
    for (const entry of input.proposedEntries) {
      const transition = demeritPolicyTransitionForEntries(currentEntries, [entry]);
      if (transition.noteRequired && isBlankNote(entry.note)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `demerit note is required for ${transition.nextStatus.stageLabel}`,
        });
      }
      currentEntries.push({
        category: entry.category,
        meritDelta: entry.meritDelta,
        type: 'Demerit',
      });
    }
  }
}

function scopedStudentRelationWhere(scope: DailyYearBandScope, user: SessionUser) {
  if (canUseClubsLeadPortal(user)) return {};
  if (canUseAllStudentSupervisorWorkflow(user) || scope.scopedYears === null) return {};
  return { student: studentWhereForDailyScope(scope) };
}

async function auditNotificationFailure(
  ctx: AuthedContext,
  entry: BehaviourNotificationEntry,
  meta: Record<string, unknown>,
): Promise<void> {
  try {
    await ctx.db.auditLog.create({
      data: {
        userId: ctx.user.id,
        action: 'Update',
        entity: 'BehaviourEntry',
        entityId: entry.id,
        meta: {
          source: 'behaviour.log.notification',
          emailStatus: 'Failed',
          studentId: entry.studentId,
          type: entry.type,
          ...meta,
        },
      },
    });
  } catch (auditErr) {
    console.error('Behaviour notification failure audit failed', {
      behaviourEntryId: entry.id,
      error: auditErr instanceof Error ? auditErr.message : 'unknown error',
    });
  }
}

async function notifyBehaviourGuardians({
  ctx,
  entry,
  getEmailClient,
}: {
  ctx: AuthedContext;
  entry: BehaviourNotificationEntry;
  getEmailClient: () => EmailClient;
}): Promise<void> {
  if (entry.visibility !== 'General') return;

  let guardians: BehaviourNotificationGuardian[];
  let childName: string;
  let recordedByName: string;

  try {
    const [guardianRows, recordedBy] = await Promise.all([
      ctx.db.guardian.findMany({
        where: { studentId: entry.studentId, user: { active: true } },
        select: {
          user: {
            select: {
              id: true,
              role: true,
              fullNameEnc: true,
              emailEnc: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      }),
      ctx.db.user.findUnique({
        where: { id: entry.recordedById },
        select: { fullNameEnc: true },
      }),
    ]);
    if (!recordedBy) {
      throw new Error('recording user not found');
    }
    guardians = guardianRows;
    childName = decryptRequired(ctx.db.$enc.decrypt, entry.studentNameEnc, 'student PII');
    recordedByName = decryptRequired(ctx.db.$enc.decrypt, recordedBy.fullNameEnc, 'user PII');
  } catch (err) {
    console.error('Behaviour notification recipient resolution failed', {
      behaviourEntryId: entry.id,
      error: err instanceof Error ? err.message : 'unknown error',
    });
    await auditNotificationFailure(ctx, entry, { reason: 'recipient-resolution' });
    return;
  }

  for (const guardian of guardians) {
    try {
      const recipientName = decryptRequired(
        ctx.db.$enc.decrypt,
        guardian.user.fullNameEnc,
        'guardian name',
      );
      const recipientEmail = decryptRequired(
        ctx.db.$enc.decrypt,
        guardian.user.emailEnc,
        'guardian email',
      );
      const email = buildBehaviourNotificationEmail({
        to: recipientEmail,
        recipientName,
        childName,
        type: entry.type,
        category: entry.category,
        note: entry.note,
        recordedByName,
      });
      const result = await getEmailClient().send(email);

      await ctx.db.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'Create',
          entity: 'Email',
          entityId: result.id,
          meta: {
            source: 'behaviour.log.notification',
            emailStatus: 'Sent',
            behaviourEntryId: entry.id,
            studentId: entry.studentId,
            subject: BEHAVIOUR_NOTIFICATION_EMAIL_SUBJECT,
            toUserId: guardian.user.id,
            toRole: guardian.user.role,
            type: entry.type,
          },
        },
      });
    } catch (err) {
      console.error('Behaviour notification email delivery failed', {
        behaviourEntryId: entry.id,
        toUserId: guardian.user.id,
        error: err instanceof Error ? err.message : 'unknown error',
      });
      await auditNotificationFailure(ctx, entry, {
        toUserId: guardian.user.id,
        toRole: guardian.user.role,
      });
    }
  }
}

export function createBehaviourRouter(deps: BehaviourRouterDeps = {}) {
  let cachedEmailClient: EmailClient | null = deps.emailClient ?? null;
  const getEmailClient = (): EmailClient => {
    if (cachedEmailClient) return cachedEmailClient;
    cachedEmailClient = createResendEmailClient();
    return cachedEmailClient;
  };

  return router({
    dailyMerits: authedProcedure
      .input(z.object({ date: z.coerce.date() }))
      .query(async ({ ctx, input }) => {
        await requireBehaviourReportAccess(ctx, 'behaviour.dailyMerits');
        const from = normalizeDate(input.date);
        const to = dayEnd(input.date);
        const canReadSensitive = canViewSensitiveBehaviour(ctx.user);

        const rows = await ctx.db.behaviourEntry.findMany({
          where: {
            type: 'Merit',
            deletedAt: null,
            createdAt: { gte: from, lt: to },
            ...(canReadSensitive ? {} : { visibility: 'General' as const }),
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
            studentName: decryptRequired(
              ctx.db.$enc.decrypt,
              row.student.fullNameEnc,
              'student PII',
            ),
            yearGroup: row.student.yearGroup,
            category: row.category,
            meritDelta: row.meritDelta,
            visibility: row.visibility,
            recordedById: row.recordedById,
            recordedByName: decryptRequired(
              ctx.db.$enc.decrypt,
              row.recordedBy.fullNameEnc,
              'user PII',
            ),
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
          .refine(
            (input) => normalizeDate(input.from).getTime() <= normalizeDate(input.to).getTime(),
            {
              message: 'from must be on or before to',
              path: ['to'],
            },
          ),
      )
      .query(async ({ ctx, input }) => {
        await requireBehaviourReportAccess(ctx, 'behaviour.trends');
        const from = normalizeDate(input.from);
        const to = dayEnd(input.to);
        const canReadSensitive = canViewSensitiveBehaviour(ctx.user);

        const rows = await ctx.db.behaviourEntry.findMany({
          where: {
            deletedAt: null,
            createdAt: { gte: from, lt: to },
            ...(canReadSensitive ? {} : { visibility: 'General' as const }),
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
            generalCount: number;
            sensitiveCount: number;
          }
        >();

        for (const row of rows) {
          const key = trendKey(row.createdAt, input.bucket);
          const current = buckets.get(key) ?? {
            bucket: key,
            meritCount: 0,
            meritTotal: 0,
            demeritCount: 0,
            demeritTotal: 0,
            generalCount: 0,
            sensitiveCount: 0,
          };
          if (row.type === 'Merit') {
            current.meritCount += 1;
            current.meritTotal += row.meritDelta;
          } else if (row.type === 'Demerit') {
            current.demeritCount += 1;
            current.demeritTotal += Math.abs(row.meritDelta);
          } else {
            current.generalCount += 1;
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

    dashboardActivity: authedProcedure
      .input(z.object({ date: z.coerce.date() }))
      .query(async ({ ctx, input }) => {
        await requireBehaviourWorkflow(ctx, 'behaviour.dashboardActivity');
        const from = normalizeDate(input.date);
        const to = dayEnd(input.date);
        const scope = await loadDailyYearBandScope(ctx, from);

        const rows = await ctx.withRls((tx) =>
          tx.behaviourEntry.findMany({
            where: {
              createdAt: { gte: from, lt: to },
              ...visibleBehaviourWhere(ctx.user),
              ...scopedStudentRelationWhere(scope, ctx.user),
            },
            include: {
              student: { select: { id: true, fullNameEnc: true, yearGroup: true } },
              recordedBy: { select: { id: true, fullNameEnc: true, role: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: 8,
          }),
        );

        await ctx.db.auditLog.create({
          data: {
            userId: ctx.user.id,
            action: 'DecryptPii',
            entity: 'BehaviourEntry',
            meta: { source: 'behaviour.dashboardActivity', count: rows.length },
          },
        });

        return {
          date: dateKey(input.date),
          entries: rows.map((row) => ({
            id: row.id,
            studentId: row.studentId,
            studentName: decryptRequired(
              ctx.db.$enc.decrypt,
              row.student.fullNameEnc,
              'student PII',
            ),
            yearGroup: row.student.yearGroup,
            type: row.type,
            category: row.category,
            note: decryptOptional(ctx.db.$enc.decrypt, row.noteEnc),
            visibility: row.visibility,
            meritDelta: row.meritDelta,
            recordedById: row.recordedById,
            recordedByName: decryptRequired(
              ctx.db.$enc.decrypt,
              row.recordedBy.fullNameEnc,
              'user PII',
            ),
            recordedByRole: row.recordedBy.role,
            createdAt: row.createdAt,
          })),
        };
      }),

    dailyDemeritStatuses: authedProcedure
      .input(z.object({ date: z.coerce.date() }))
      .query(async ({ ctx, input }) => {
        await requireBehaviourWorkflow(ctx, 'behaviour.dailyDemeritStatuses');
        const day = localDayBounds(input.date);
        const scope = await loadDailyYearBandScope(ctx, input.date);
        const scopedStudentWhere = canUseClubsLeadPortal(ctx.user)
          ? {
              active: true,
              clubSignups: {
                some: {
                  status: 'Active' as const,
                  club: {
                    active: true,
                    leadAssignments: { some: { userId: ctx.user.id } },
                  },
                },
              },
            }
          : { active: true, ...studentWhereForDailyScope(scope) };

        const students = await ctx.withRls((tx) =>
          tx.student.findMany({
            where: scopedStudentWhere,
            select: { id: true },
            orderBy: { createdAt: 'desc' },
          }),
        );
        const studentIds = students.map((student) => student.id);

        const rows =
          studentIds.length === 0
            ? []
            : await ctx.withRls((tx) =>
                tx.behaviourEntry.findMany({
                  where: {
                    type: 'Demerit',
                    createdAt: { gte: day.from, lt: day.to },
                    studentId: { in: studentIds },
                    ...visibleBehaviourWhere(ctx.user),
                  },
                  select: {
                    category: true,
                    meritDelta: true,
                    studentId: true,
                    type: true,
                    visibility: true,
                  },
                }),
              );

        const sensitiveCount = rows.filter((row) => row.visibility === 'Sensitive').length;
        if (sensitiveCount > 0) {
          await ctx.db.auditLog.create({
            data: {
              userId: ctx.user.id,
              action: 'ReadSensitive',
              entity: 'BehaviourEntry',
              meta: { source: 'behaviour.dailyDemeritStatuses', count: sensitiveCount },
            },
          });
        }

        const entriesByStudent = new Map<string, typeof rows>();
        for (const row of rows) {
          entriesByStudent.set(row.studentId, [
            ...(entriesByStudent.get(row.studentId) ?? []),
            row,
          ]);
        }

        return {
          date: day.key,
          statuses: students.map((student) => ({
            studentId: student.id,
            ...demeritPolicyStatusForEntries(entriesByStudent.get(student.id) ?? []),
          })),
        };
      }),

    recentEntries: authedProcedure
      .input(z.object({ date: z.coerce.date() }))
      .query(async ({ ctx, input }) => {
        await requireBehaviourWorkflow(ctx, 'behaviour.recentEntries');
        const from = normalizeDate(input.date);
        const to = dayEnd(input.date);
        const scope = await loadDailyYearBandScope(ctx, from);

        const rows = await ctx.withRls((tx) =>
          tx.behaviourEntry.findMany({
            where: {
              createdAt: { gte: from, lt: to },
              ...visibleBehaviourWhere(ctx.user),
              ...scopedStudentRelationWhere(scope, ctx.user),
            },
            include: {
              student: { select: { id: true, fullNameEnc: true, yearGroup: true } },
              recordedBy: { select: { id: true, fullNameEnc: true, role: true } },
            },
            orderBy: { createdAt: 'desc' },
          }),
        );

        const sensitiveRows = rows.filter((row) => row.visibility === 'Sensitive');
        if (sensitiveRows.length > 0) {
          await ctx.db.auditLog.create({
            data: {
              userId: ctx.user.id,
              action: 'ReadSensitive',
              entity: 'BehaviourEntry',
              meta: { source: 'behaviour.recentEntries', count: sensitiveRows.length },
            },
          });
        }

        await ctx.db.auditLog.create({
          data: {
            userId: ctx.user.id,
            action: 'DecryptPii',
            entity: 'BehaviourEntry',
            meta: { source: 'behaviour.recentEntries', count: rows.length },
          },
        });

        return {
          date: dateKey(input.date),
          entries: rows.map((row) => ({
            id: row.id,
            studentId: row.studentId,
            studentName: decryptRequired(
              ctx.db.$enc.decrypt,
              row.student.fullNameEnc,
              'student PII',
            ),
            yearGroup: row.student.yearGroup,
            type: row.type,
            category: row.category,
            note: decryptOptional(ctx.db.$enc.decrypt, row.noteEnc),
            visibility: row.visibility,
            meritDelta: row.meritDelta,
            recordedById: row.recordedById,
            recordedByName: decryptRequired(
              ctx.db.$enc.decrypt,
              row.recordedBy.fullNameEnc,
              'user PII',
            ),
            recordedByRole: row.recordedBy.role,
            createdAt: row.createdAt,
          })),
        };
      }),

    listForStudent: authedProcedure
      .input(
        z.object({
          studentId: z.string().min(1),
          includeSensitive: z.boolean().optional().default(false),
          date: z.coerce.date().optional(),
        }),
      )
      .query(async ({ ctx, input }) => {
        await requireBehaviourWorkflow(ctx, 'behaviour.listForStudent');
        if (input.includeSensitive) {
          await requireCanRequestSensitive(ctx, input.studentId);
        }

        const student = await ctx.db.student.findUnique({
          where: { id: input.studentId },
          select: { id: true, active: true, fullNameEnc: true, yearGroup: true },
        });
        if (!student) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'student not found' });
        }
        if (!student.active) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'student is inactive' });
        }
        if (canUseClubsLeadPortal(ctx.user)) {
          await assertAssignedClubLeadStudent(ctx, {
            studentId: input.studentId,
            entity: 'behaviour.listForStudent',
          });
        } else {
          const scope = await loadDailyYearBandScope(ctx, input.date ?? new Date());
          if (
            !canUseAllStudentSupervisorWorkflow(ctx.user) &&
            !studentMatchesDailyScope(scope, student)
          ) {
            await denyOutOfDailyScope(ctx, 'behaviour.listForStudent', {
              studentId: input.studentId,
              studentYearGroup: student.yearGroup,
              date: scope.dayKey,
              assignedBands: scope.assignedBands.map((band) => band.id),
            });
          }
        }

        const entries = await ctx.withRls((tx) =>
          tx.behaviourEntry.findMany({
            where: {
              studentId: input.studentId,
              ...visibleBehaviourWhere(ctx.user),
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
            meta: {
              source: 'behaviour.listForStudent',
              fields: ['fullName'],
              noteCount: rows.length,
            },
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
          type: behaviourTypeSchema,
          category: behaviourCategorySchema.optional(),
          note: behaviourNoteSchema.optional(),
          visibility: behaviourVisibilitySchema.optional(),
          // Merit: positive integer. Demerit value is fixed by category.
          amount: behaviourAmountSchema.optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        await requireBehaviourWorkflow(ctx, 'behaviour.log');
        validateSingleBehaviourInput(input);

        const visibility = input.visibility ?? (input.type === 'General' ? 'Sensitive' : 'General');
        if (visibility === 'Sensitive') {
          await requireCanCreateSensitive(ctx, { studentId: input.studentId, type: input.type });
        }

        const student = await loadActiveScopedStudent(ctx, {
          studentId: input.studentId,
          entity: 'behaviour.log',
        });
        const category =
          input.type === 'General' ? (input.category ?? 'Misc') : (input.category ?? '');
        const noteEnc = input.note ? ctx.db.$enc.encrypt(input.note) : null;
        const meritDelta = meritDeltaForBehaviour({
          amount: input.amount,
          category,
          type: input.type,
        });
        await assertDemeritStageNotes(ctx, {
          proposedEntries:
            input.type === 'Demerit'
              ? [{ category, meritDelta, note: input.note, type: 'Demerit' }]
              : [],
          studentIds: [input.studentId],
        });

        const result = await ctx.withRls(async (tx) => {
          const behaviour = await tx.behaviourEntry.create({
            data: {
              studentId: input.studentId,
              type: input.type,
              category,
              noteEnc,
              visibility,
              meritDelta,
              recordedById: ctx.user.id,
            },
          });
          const ledgerRows =
            input.type === 'Merit'
              ? rowsForMerit({
                  studentId: input.studentId,
                  amount: meritDelta,
                  reason: category,
                  behaviourEntryId: behaviour.id,
                })
              : input.type === 'Demerit'
                ? rowsForDemerit({
                    studentId: input.studentId,
                    amount: Math.abs(meritDelta),
                    reason: category,
                    behaviourEntryId: behaviour.id,
                  })
                : [];

          if (ledgerRows.length > 0) {
            await tx.meritLedger.createMany({ data: ledgerRows });
          }
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
              visibility,
              meritDelta,
            },
          },
        });
        if (result.ledgerRowCount > 0) {
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
        }

        await notifyBehaviourGuardians({
          ctx,
          getEmailClient,
          entry: {
            id: result.behaviour.id,
            studentId: result.behaviour.studentId,
            studentNameEnc: student.fullNameEnc,
            type: result.behaviour.type,
            category: result.behaviour.category,
            note: input.note ?? null,
            recordedById: result.behaviour.recordedById,
            visibility: result.behaviour.visibility,
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

    logForStudents: authedProcedure
      .input(
        z.object({
          studentIds: studentIdsSchema,
          type: behaviourTypeSchema,
          category: behaviourCategorySchema.optional(),
          note: behaviourNoteSchema.optional(),
          visibility: behaviourVisibilitySchema.optional(),
          amount: behaviourAmountSchema.optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        await requireBehaviourWorkflow(ctx, 'behaviour.logForStudents');
        requireUniqueStudentIds(input.studentIds);
        validateSingleBehaviourInput(input);

        const visibility = input.visibility ?? (input.type === 'General' ? 'Sensitive' : 'General');
        if (visibility === 'Sensitive') {
          await Promise.all(
            input.studentIds.map((studentId) =>
              requireCanCreateSensitive(ctx, { studentId, type: input.type }),
            ),
          );
        }

        const students = await loadActiveScopedStudents(ctx, {
          studentIds: input.studentIds,
          entity: 'behaviour.logForStudents',
        });
        const category =
          input.type === 'General' ? (input.category ?? 'Misc') : (input.category ?? '');
        const noteEnc = input.note ? ctx.db.$enc.encrypt(input.note) : null;
        const meritDelta = meritDeltaForBehaviour({
          amount: input.amount,
          category,
          type: input.type,
        });
        await assertDemeritStageNotes(ctx, {
          proposedEntries:
            input.type === 'Demerit'
              ? [{ category, meritDelta, note: input.note, type: 'Demerit' }]
              : [],
          studentIds: input.studentIds,
        });

        const result = await ctx.withRls(async (tx) => {
          const behaviourEntries: CreatedBehaviourEntry[] = [];
          let ledgerRowCount = 0;

          for (const studentId of input.studentIds) {
            const behaviour = await tx.behaviourEntry.create({
              data: {
                studentId,
                type: input.type,
                category,
                noteEnc,
                visibility,
                meritDelta,
                recordedById: ctx.user.id,
              },
            });
            const ledgerRows =
              input.type === 'Merit'
                ? rowsForMerit({
                    studentId,
                    amount: meritDelta,
                    reason: category,
                    behaviourEntryId: behaviour.id,
                  })
                : input.type === 'Demerit'
                  ? rowsForDemerit({
                      studentId,
                      amount: Math.abs(meritDelta),
                      reason: category,
                      behaviourEntryId: behaviour.id,
                    })
                  : [];

            if (ledgerRows.length > 0) {
              await tx.meritLedger.createMany({ data: ledgerRows });
            }
            ledgerRowCount += ledgerRows.length;
            behaviourEntries.push(behaviour);
          }

          return { behaviourEntries, ledgerRowCount };
        });

        await ctx.db.auditLog.create({
          data: {
            userId: ctx.user.id,
            action: 'Create',
            entity: 'BehaviourEntry',
            meta: {
              studentIds: input.studentIds,
              type: input.type,
              visibility,
              meritDelta,
              entryCount: result.behaviourEntries.length,
              behaviourEntryIds: result.behaviourEntries.map((entry) => entry.id),
            },
          },
        });
        if (result.ledgerRowCount > 0) {
          await ctx.db.auditLog.create({
            data: {
              userId: ctx.user.id,
              action: 'Create',
              entity: 'MeritLedger',
              meta: {
                studentIds: input.studentIds,
                behaviourEntryIds: result.behaviourEntries.map((entry) => entry.id),
                rowCount: result.ledgerRowCount,
              },
            },
          });
        }

        await Promise.all(
          result.behaviourEntries.map((entry) => {
            const student = students.get(entry.studentId);
            if (!student) {
              throw new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: 'student scope lookup failed',
              });
            }
            return notifyBehaviourGuardians({
              ctx,
              getEmailClient,
              entry: {
                id: entry.id,
                studentId: entry.studentId,
                studentNameEnc: student.fullNameEnc,
                type: entry.type,
                category: entry.category,
                note: input.note ?? null,
                recordedById: entry.recordedById,
                visibility: entry.visibility,
              },
            });
          }),
        );

        return {
          entries: result.behaviourEntries.map((entry) => ({
            id: entry.id,
            studentId: entry.studentId,
            type: entry.type,
            category: entry.category,
            visibility: entry.visibility,
            meritDelta: entry.meritDelta,
            recordedById: entry.recordedById,
            createdAt: entry.createdAt,
          })),
          ledgerRowCount: result.ledgerRowCount,
        };
      }),

    updateEntry: fullAdminProcedure
      .input(
        z.object({
          id: z.string().min(1),
          category: behaviourCategorySchema.optional(),
          note: behaviourUpdateNoteSchema,
          visibility: behaviourVisibilitySchema.optional(),
          amount: behaviourAmountSchema.optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const { existing, ledgerDelta, nextNote, updated } = await ctx.withRls(async (tx) => {
          const existing = await tx.behaviourEntry.findUnique({
            where: { id: input.id },
            include: { ledgerRows: { select: { id: true, delta: true, account: true } } },
          });
          if (!existing || existing.deletedAt !== null) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'behaviour entry not found' });
          }

          if (existing.type === 'General' && input.amount !== undefined) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'general marks have no merit value',
            });
          }
          if (existing.type === 'Demerit' && input.amount !== undefined) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'demerit amount is fixed by category',
            });
          }

          const nextCategory = input.category ?? existing.category;
          const nextVisibility = input.visibility ?? existing.visibility;
          const nextNote =
            input.note === undefined ? undefined : input.note === null ? null : input.note.trim();
          if (
            existing.type === 'General' &&
            ((nextNote === undefined && !existing.noteEnc) || nextNote === null || nextNote === '')
          ) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'general mark note is required' });
          }

          const nextMeritDelta =
            existing.type === 'Merit'
              ? (input.amount ?? existing.meritDelta)
              : existing.type === 'Demerit'
                ? input.category === undefined
                  ? existing.meritDelta
                  : demeritMeritDeltaForCategory(nextCategory)
                : existing.meritDelta;
          const ledgerDelta = nextMeritDelta - existing.meritDelta;

          const row = await tx.behaviourEntry.update({
            where: { id: existing.id },
            data: {
              category: nextCategory,
              visibility: nextVisibility,
              meritDelta: nextMeritDelta,
              ...(nextNote === undefined
                ? {}
                : { noteEnc: nextNote ? ctx.db.$enc.encrypt(nextNote) : null }),
            },
            select: {
              id: true,
              studentId: true,
              type: true,
              category: true,
              visibility: true,
              meritDelta: true,
              recordedById: true,
              createdAt: true,
            },
          });

          if (ledgerDelta !== 0) {
            await tx.meritLedger.createMany({
              data: [
                {
                  studentId: existing.studentId,
                  account: 'Spend',
                  delta: ledgerDelta,
                  reason: `correction:${nextCategory}`,
                  relatedEntryId: existing.id,
                },
              ],
            });
          }

          return { existing, ledgerDelta, nextNote, updated: row };
        });

        await ctx.db.auditLog.create({
          data: {
            userId: ctx.user.id,
            action: 'Update',
            entity: 'BehaviourEntry',
            entityId: updated.id,
            meta: {
              studentId: updated.studentId,
              type: existing.type,
              previousCategory: existing.category,
              previousVisibility: existing.visibility,
              previousMeritDelta: existing.meritDelta,
              previousNotePresent: existing.noteEnc !== null,
              category: updated.category,
              visibility: updated.visibility,
              meritDelta: updated.meritDelta,
              noteChanged: nextNote !== undefined,
              ledgerCorrectionRows: ledgerDelta === 0 ? 0 : 1,
            },
          },
        });

        return updated;
      }),

    deleteEntry: fullAdminProcedure
      .input(z.object({ id: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        const { correctionRows, deleted, existing } = await ctx.withRls(async (tx) => {
          const existing = await tx.behaviourEntry.findUnique({
            where: { id: input.id },
            include: {
              ledgerRows: {
                select: { studentId: true, account: true, delta: true, reason: true },
                orderBy: { createdAt: 'asc' },
              },
            },
          });
          if (!existing || existing.deletedAt !== null) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'behaviour entry not found' });
          }

          const correctionRows = existing.ledgerRows
            .filter((row) => row.delta !== 0)
            .map((row) => ({
              studentId: row.studentId,
              account: row.account,
              delta: -row.delta,
              reason: `correction:delete:${row.reason}`,
              relatedEntryId: existing.id,
            }));

          const row = await tx.behaviourEntry.update({
            where: { id: existing.id },
            data: { deletedAt: new Date(), deletedById: ctx.user.id },
            select: { id: true, studentId: true, type: true, meritDelta: true },
          });

          if (correctionRows.length > 0) {
            await tx.meritLedger.createMany({ data: correctionRows });
          }

          return { correctionRows, deleted: row, existing };
        });

        await ctx.db.auditLog.create({
          data: {
            userId: ctx.user.id,
            action: 'Delete',
            entity: 'BehaviourEntry',
            entityId: deleted.id,
            meta: {
              studentId: deleted.studentId,
              type: deleted.type,
              previousCategory: existing.category,
              previousVisibility: existing.visibility,
              previousMeritDelta: existing.meritDelta,
              previousNotePresent: existing.noteEnc !== null,
              ledgerCorrectionRows: correctionRows.length,
            },
          },
        });

        return {
          id: deleted.id,
          studentId: deleted.studentId,
          type: deleted.type,
          ledgerCorrectionRows: correctionRows.length,
        };
      }),

    logMany: authedProcedure
      .input(
        z.object({
          studentId: z.string().min(1),
          type: z.enum(['Merit', 'Demerit']),
          entries: z.array(logEntrySchema).min(1).max(50),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        await requireBehaviourWorkflow(ctx, 'behaviour.logMany');
        assertBatchEntryLimit(validateBatchBehaviourInput(input));

        const student = await loadActiveScopedStudent(ctx, {
          studentId: input.studentId,
          entity: 'behaviour.logMany',
        });
        const preparedEntries = input.entries.flatMap((entry) =>
          Array.from({ length: entry.count }, () => ({
            category: entry.category,
            note: entry.note,
            noteEnc: entry.note ? ctx.db.$enc.encrypt(entry.note) : null,
            meritDelta:
              input.type === 'Merit'
                ? (entry.amount ?? 0)
                : demeritMeritDeltaForCategory(entry.category),
          })),
        );
        await assertDemeritStageNotes(ctx, {
          proposedEntries:
            input.type === 'Demerit'
              ? preparedEntries.map((entry) => ({
                  category: entry.category,
                  meritDelta: entry.meritDelta,
                  note: entry.note,
                  type: 'Demerit' as const,
                }))
              : [],
          studentIds: [input.studentId],
        });

        const result = await ctx.withRls(async (tx) => {
          const behaviourEntries: Array<{
            id: string;
            studentId: string;
            type: BehaviourType;
            category: string;
            noteEnc: string | null;
            visibility: BehaviourVisibility;
            meritDelta: number;
            recordedById: string;
            createdAt: Date;
          }> = [];
          let ledgerRowCount = 0;

          for (const entry of preparedEntries) {
            const behaviour = await tx.behaviourEntry.create({
              data: {
                studentId: input.studentId,
                type: input.type,
                category: entry.category,
                noteEnc: entry.noteEnc,
                visibility: 'General',
                meritDelta: entry.meritDelta,
                recordedById: ctx.user.id,
              },
            });
            const ledgerRows =
              input.type === 'Merit'
                ? rowsForMerit({
                    studentId: input.studentId,
                    amount: entry.meritDelta,
                    reason: entry.category,
                    behaviourEntryId: behaviour.id,
                  })
                : rowsForDemerit({
                    studentId: input.studentId,
                    amount: Math.abs(entry.meritDelta),
                    reason: entry.category,
                    behaviourEntryId: behaviour.id,
                  });
            await tx.meritLedger.createMany({ data: ledgerRows });
            ledgerRowCount += ledgerRows.length;
            behaviourEntries.push(behaviour);
          }

          return { behaviourEntries, ledgerRowCount };
        });

        await ctx.db.auditLog.create({
          data: {
            userId: ctx.user.id,
            action: 'Create',
            entity: 'BehaviourEntry',
            meta: {
              studentId: input.studentId,
              type: input.type,
              visibility: 'General',
              count: result.behaviourEntries.length,
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
              behaviourEntryIds: result.behaviourEntries.map((entry) => entry.id),
              rowCount: result.ledgerRowCount,
            },
          },
        });

        await Promise.all(
          result.behaviourEntries.map((entry, index) =>
            notifyBehaviourGuardians({
              ctx,
              getEmailClient,
              entry: {
                id: entry.id,
                studentId: entry.studentId,
                studentNameEnc: student.fullNameEnc,
                type: entry.type,
                category: entry.category,
                note: preparedEntries[index]?.note ?? null,
                recordedById: entry.recordedById,
                visibility: entry.visibility,
              },
            }),
          ),
        );

        return {
          entries: result.behaviourEntries.map((entry) => ({
            id: entry.id,
            studentId: entry.studentId,
            type: entry.type,
            category: entry.category,
            visibility: entry.visibility,
            meritDelta: entry.meritDelta,
            recordedById: entry.recordedById,
            createdAt: entry.createdAt,
          })),
          ledgerRowCount: result.ledgerRowCount,
        };
      }),

    logManyForStudents: authedProcedure
      .input(
        z.object({
          studentIds: studentIdsSchema,
          type: z.enum(['Merit', 'Demerit']),
          entries: z.array(logEntrySchema).min(1).max(50),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        await requireBehaviourWorkflow(ctx, 'behaviour.logManyForStudents');
        requireUniqueStudentIds(input.studentIds);
        const entriesPerStudent = validateBatchBehaviourInput(input);
        assertBatchEntryLimit(entriesPerStudent * input.studentIds.length);

        const students = await loadActiveScopedStudents(ctx, {
          studentIds: input.studentIds,
          entity: 'behaviour.logManyForStudents',
        });
        const preparedEntries = input.entries.flatMap((entry) =>
          Array.from({ length: entry.count }, () => ({
            category: entry.category,
            note: entry.note ?? null,
            noteEnc: entry.note ? ctx.db.$enc.encrypt(entry.note) : null,
            meritDelta:
              input.type === 'Merit'
                ? (entry.amount ?? 0)
                : demeritMeritDeltaForCategory(entry.category),
          })),
        );
        await assertDemeritStageNotes(ctx, {
          proposedEntries:
            input.type === 'Demerit'
              ? preparedEntries.map((entry) => ({
                  category: entry.category,
                  meritDelta: entry.meritDelta,
                  note: entry.note,
                  type: 'Demerit' as const,
                }))
              : [],
          studentIds: input.studentIds,
        });

        const result = await ctx.withRls(async (tx) => {
          const behaviourEntries: Array<CreatedBehaviourEntry & { note: string | null }> = [];
          let ledgerRowCount = 0;

          for (const studentId of input.studentIds) {
            for (const entry of preparedEntries) {
              const behaviour = await tx.behaviourEntry.create({
                data: {
                  studentId,
                  type: input.type,
                  category: entry.category,
                  noteEnc: entry.noteEnc,
                  visibility: 'General',
                  meritDelta: entry.meritDelta,
                  recordedById: ctx.user.id,
                },
              });
              const ledgerRows =
                input.type === 'Merit'
                  ? rowsForMerit({
                      studentId,
                      amount: entry.meritDelta,
                      reason: entry.category,
                      behaviourEntryId: behaviour.id,
                    })
                  : rowsForDemerit({
                      studentId,
                      amount: Math.abs(entry.meritDelta),
                      reason: entry.category,
                      behaviourEntryId: behaviour.id,
                    });
              await tx.meritLedger.createMany({ data: ledgerRows });
              ledgerRowCount += ledgerRows.length;
              behaviourEntries.push({ ...behaviour, note: entry.note });
            }
          }

          return { behaviourEntries, ledgerRowCount };
        });

        await ctx.db.auditLog.create({
          data: {
            userId: ctx.user.id,
            action: 'Create',
            entity: 'BehaviourEntry',
            meta: {
              studentIds: input.studentIds,
              type: input.type,
              visibility: 'General',
              entryCount: result.behaviourEntries.length,
              behaviourEntryIds: result.behaviourEntries.map((entry) => entry.id),
            },
          },
        });
        await ctx.db.auditLog.create({
          data: {
            userId: ctx.user.id,
            action: 'Create',
            entity: 'MeritLedger',
            meta: {
              studentIds: input.studentIds,
              behaviourEntryIds: result.behaviourEntries.map((entry) => entry.id),
              rowCount: result.ledgerRowCount,
            },
          },
        });

        await Promise.all(
          result.behaviourEntries.map((entry) => {
            const student = students.get(entry.studentId);
            if (!student) {
              throw new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: 'student scope lookup failed',
              });
            }
            return notifyBehaviourGuardians({
              ctx,
              getEmailClient,
              entry: {
                id: entry.id,
                studentId: entry.studentId,
                studentNameEnc: student.fullNameEnc,
                type: entry.type,
                category: entry.category,
                note: entry.note,
                recordedById: entry.recordedById,
                visibility: entry.visibility,
              },
            });
          }),
        );

        return {
          entries: result.behaviourEntries.map((entry) => ({
            id: entry.id,
            studentId: entry.studentId,
            type: entry.type,
            category: entry.category,
            visibility: entry.visibility,
            meritDelta: entry.meritDelta,
            recordedById: entry.recordedById,
            createdAt: entry.createdAt,
          })),
          ledgerRowCount: result.ledgerRowCount,
        };
      }),
  });
}

export const behaviourRouter = createBehaviourRouter();
