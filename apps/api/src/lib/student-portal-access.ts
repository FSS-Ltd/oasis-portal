import { TRPCError } from '@trpc/server';
import { Prisma } from '@oasis/db';
import {
  effectiveStudentPortalLock,
  studentMeritShopAccess,
  studentPortalUsageLimitStatus,
  type StudentPortalUsageCounts,
  type StudentPortalUsageLimitReached,
  type StudentPortalUsageWindow,
  type StudentPortalLockSource,
} from '@oasis/domain/studentPortalSettings';
import type { AppContext } from '../context.js';

type AuthedContext = AppContext & { user: NonNullable<AppContext['user']> };

const studentPortalPolicySelect = Prisma.validator<Prisma.StudentPortalSettingsSelect>()({
  parentAccountLocked: true,
  parentLockReasonEnc: true,
  headAcademicLocked: true,
  headAcademicLockReasonEnc: true,
  parentMeritShopBlocked: true,
  hourlyUsageLimitMinutes: true,
  dailyUsageLimitMinutes: true,
  weeklyUsageLimitMinutes: true,
});

type StudentPortalPolicyRow = Prisma.StudentPortalSettingsGetPayload<{
  select: typeof studentPortalPolicySelect;
}>;

interface StudentPortalPolicyState {
  parentAccountLocked: boolean;
  parentLockReasonEnc: string | null;
  headAcademicLocked: boolean;
  headAcademicLockReasonEnc: string | null;
  parentMeritShopBlocked: boolean;
  hourlyUsageLimitMinutes: number | null;
  dailyUsageLimitMinutes: number | null;
  weeklyUsageLimitMinutes: number | null;
}

interface StudentPortalLockDetails {
  locked: boolean;
  message: string | null;
  source: StudentPortalLockSource | null;
}

interface StudentPortalUsageWindowRange {
  start: Date;
  end: Date;
}

interface StudentPortalUsageWindows {
  hourly: StudentPortalUsageWindowRange;
  daily: StudentPortalUsageWindowRange;
  weekly: StudentPortalUsageWindowRange;
}

export interface StudentPortalUsageWindowStatus {
  limitMinutes: number | null;
  usedMinutes: number;
  remainingMinutes: number | null;
  resetAt: Date;
}

export interface StudentPortalUsageStatusDto {
  allowed: boolean;
  blockedWindow: StudentPortalUsageWindow | null;
  message: string | null;
  hourly: StudentPortalUsageWindowStatus;
  daily: StudentPortalUsageWindowStatus;
  weekly: StudentPortalUsageWindowStatus;
}

function defaultPolicyState(settings: StudentPortalPolicyRow | null): StudentPortalPolicyState {
  return {
    parentAccountLocked: settings?.parentAccountLocked ?? false,
    parentLockReasonEnc: settings?.parentLockReasonEnc ?? null,
    headAcademicLocked: settings?.headAcademicLocked ?? false,
    headAcademicLockReasonEnc: settings?.headAcademicLockReasonEnc ?? null,
    parentMeritShopBlocked: settings?.parentMeritShopBlocked ?? false,
    hourlyUsageLimitMinutes: settings?.hourlyUsageLimitMinutes ?? null,
    dailyUsageLimitMinutes: settings?.dailyUsageLimitMinutes ?? null,
    weeklyUsageLimitMinutes: settings?.weeklyUsageLimitMinutes ?? null,
  };
}

function lockMessage(source: StudentPortalLockSource): string {
  return source === 'HeadAcademic'
    ? 'Student portal is locked by Oasis Learning Centre for academic reasons.'
    : 'Student portal is locked by a parent or carer.';
}

function lockDetails(settings: StudentPortalPolicyRow | null): StudentPortalLockDetails {
  const state = defaultPolicyState(settings);
  const lock = effectiveStudentPortalLock(state);
  const source = lock.primarySource ?? null;

  return {
    locked: lock.locked,
    message: source ? lockMessage(source) : null,
    source,
  };
}

function startOfUtcMinute(date: Date): Date {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      date.getUTCHours(),
      date.getUTCMinutes(),
    ),
  );
}

function startOfUtcHour(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), date.getUTCHours()),
  );
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function startOfUtcWeek(date: Date): Date {
  const start = startOfUtcDay(date);
  const daysSinceMonday = (start.getUTCDay() + 6) % 7;
  start.setUTCDate(start.getUTCDate() - daysSinceMonday);
  return start;
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60_000);
}

function usageWindows(now: Date): StudentPortalUsageWindows {
  const hourlyStart = startOfUtcHour(now);
  const dailyStart = startOfUtcDay(now);
  const weeklyStart = startOfUtcWeek(now);
  return {
    hourly: { start: hourlyStart, end: addMinutes(hourlyStart, 60) },
    daily: { start: dailyStart, end: addDays(dailyStart, 1) },
    weekly: { start: weeklyStart, end: addDays(weeklyStart, 7) },
  };
}

function usageLimitMessage(limit: StudentPortalUsageLimitReached): string {
  return `${limit.window} student portal usage limit reached.`;
}

function usageWindowStatus(
  limitMinutes: number | null,
  usedMinutes: number,
  resetAt: Date,
): StudentPortalUsageWindowStatus {
  return {
    limitMinutes,
    usedMinutes,
    remainingMinutes: limitMinutes === null ? null : Math.max(0, limitMinutes - usedMinutes),
    resetAt,
  };
}

function buildUsageStatus(
  settings: StudentPortalPolicyRow | null,
  counts: StudentPortalUsageCounts,
  windows: StudentPortalUsageWindows,
): StudentPortalUsageStatusDto {
  const state = defaultPolicyState(settings);
  const status = studentPortalUsageLimitStatus(
    {
      hourlyUsageLimitMinutes: state.hourlyUsageLimitMinutes,
      dailyUsageLimitMinutes: state.dailyUsageLimitMinutes,
      weeklyUsageLimitMinutes: state.weeklyUsageLimitMinutes,
    },
    counts,
  );

  return {
    allowed: status.allowed,
    blockedWindow: status.allowed ? null : status.window,
    message: status.allowed ? null : usageLimitMessage(status),
    hourly: usageWindowStatus(
      state.hourlyUsageLimitMinutes,
      counts.hourlyUsageMinutes,
      windows.hourly.end,
    ),
    daily: usageWindowStatus(
      state.dailyUsageLimitMinutes,
      counts.dailyUsageMinutes,
      windows.daily.end,
    ),
    weekly: usageWindowStatus(
      state.weeklyUsageLimitMinutes,
      counts.weeklyUsageMinutes,
      windows.weekly.end,
    ),
  };
}

function hasUsageLimits(settings: StudentPortalPolicyRow | null): boolean {
  return (
    (settings?.hourlyUsageLimitMinutes !== null &&
      settings?.hourlyUsageLimitMinutes !== undefined) ||
    (settings?.dailyUsageLimitMinutes !== null && settings?.dailyUsageLimitMinutes !== undefined) ||
    (settings?.weeklyUsageLimitMinutes !== null && settings?.weeklyUsageLimitMinutes !== undefined)
  );
}

async function loadStudentPortalPolicy(
  ctx: AuthedContext,
  studentId: string,
): Promise<StudentPortalPolicyRow | null> {
  return ctx.db.studentPortalSettings.findUnique({
    where: { studentId },
    select: studentPortalPolicySelect,
  });
}

async function auditStudentPortalPolicyDenied(
  ctx: AuthedContext,
  input: {
    entity: string;
    reason: 'AccountLocked' | 'ParentShopBlock' | 'UsageLimit';
    studentId: string;
    lockSource?: StudentPortalLockSource | undefined;
    usageWindow?: StudentPortalUsageWindow | undefined;
  },
): Promise<void> {
  const meta: Record<string, string | null> = {
    role: ctx.user.role,
    reason: input.reason,
  };
  if (input.lockSource !== undefined) {
    meta.lockSource = input.lockSource;
  }
  if (input.usageWindow !== undefined) {
    meta.usageWindow = input.usageWindow;
  }

  await ctx.db.auditLog.create({
    data: {
      userId: ctx.user.id,
      action: 'PermissionDenied',
      entity: input.entity,
      entityId: input.studentId,
      meta,
    },
  });
}

async function loadStudentPortalUsageCounts(
  ctx: AuthedContext,
  input: { studentId: string; windows: StudentPortalUsageWindows },
): Promise<StudentPortalUsageCounts> {
  const [hourlyUsageMinutes, dailyUsageMinutes, weeklyUsageMinutes] = await Promise.all([
    ctx.db.studentPortalUsageMinute.count({
      where: {
        studentId: input.studentId,
        minuteStartedAt: { gte: input.windows.hourly.start, lt: input.windows.hourly.end },
      },
    }),
    ctx.db.studentPortalUsageMinute.count({
      where: {
        studentId: input.studentId,
        minuteStartedAt: { gte: input.windows.daily.start, lt: input.windows.daily.end },
      },
    }),
    ctx.db.studentPortalUsageMinute.count({
      where: {
        studentId: input.studentId,
        minuteStartedAt: { gte: input.windows.weekly.start, lt: input.windows.weekly.end },
      },
    }),
  ]);

  return { hourlyUsageMinutes, dailyUsageMinutes, weeklyUsageMinutes };
}

function throwStudentPortalUsageLimit(status: StudentPortalUsageStatusDto): never {
  throw new TRPCError({
    code: 'FORBIDDEN',
    message: status.message ?? 'Student portal usage limit reached.',
  });
}

async function assertUnlockedPolicy(
  ctx: AuthedContext,
  input: { entity: string; settings: StudentPortalPolicyRow | null; studentId: string },
): Promise<void> {
  const lock = lockDetails(input.settings);

  if (!lock.locked) return;

  await auditStudentPortalPolicyDenied(ctx, {
    entity: input.entity,
    reason: 'AccountLocked',
    studentId: input.studentId,
    lockSource: lock.source ?? undefined,
  });

  throw new TRPCError({
    code: 'FORBIDDEN',
    message: lock.message ?? 'Student portal is locked.',
  });
}

async function assertUsageLimitPolicy(
  ctx: AuthedContext,
  input: {
    entity: string;
    now?: Date | undefined;
    settings: StudentPortalPolicyRow | null;
    studentId: string;
  },
): Promise<StudentPortalUsageStatusDto> {
  const windows = usageWindows(input.now ?? new Date());
  if (!hasUsageLimits(input.settings)) {
    return buildUsageStatus(
      input.settings,
      { hourlyUsageMinutes: 0, dailyUsageMinutes: 0, weeklyUsageMinutes: 0 },
      windows,
    );
  }
  const counts = await loadStudentPortalUsageCounts(ctx, {
    studentId: input.studentId,
    windows,
  });
  const status = buildUsageStatus(input.settings, counts, windows);

  if (status.allowed) return status;

  await auditStudentPortalPolicyDenied(ctx, {
    entity: input.entity,
    reason: 'UsageLimit',
    studentId: input.studentId,
    usageWindow: status.blockedWindow ?? undefined,
  });
  throwStudentPortalUsageLimit(status);
}

export async function assertStudentPortalUnlocked(
  ctx: AuthedContext,
  input: { entity: string; studentId: string },
): Promise<void> {
  const settings = await loadStudentPortalPolicy(ctx, input.studentId);
  await assertUnlockedPolicy(ctx, { ...input, settings });
}

export async function assertStudentPortalAccess(
  ctx: AuthedContext,
  input: { entity: string; now?: Date | undefined; studentId: string },
): Promise<void> {
  const settings = await loadStudentPortalPolicy(ctx, input.studentId);
  await assertUnlockedPolicy(ctx, { entity: input.entity, settings, studentId: input.studentId });
  if (ctx.user.role !== 'Student') return;
  await assertUsageLimitPolicy(ctx, { ...input, settings });
}

export async function assertStudentMeritShopAccess(
  ctx: AuthedContext,
  input: { entity: string; studentId: string },
): Promise<void> {
  const settings = await loadStudentPortalPolicy(ctx, input.studentId);
  const state = defaultPolicyState(settings);
  const access = studentMeritShopAccess(state);

  if (access.allowed) return;

  if (access.reason === 'AccountLocked') {
    const lock = lockDetails(settings);
    await auditStudentPortalPolicyDenied(ctx, {
      entity: input.entity,
      reason: 'AccountLocked',
      studentId: input.studentId,
      lockSource: lock.source ?? undefined,
    });
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: lock.message ?? 'Student portal is locked.',
    });
  }

  await auditStudentPortalPolicyDenied(ctx, {
    entity: input.entity,
    reason: 'ParentShopBlock',
    studentId: input.studentId,
  });
  throw new TRPCError({
    code: 'FORBIDDEN',
    message: 'Merit Shop access is blocked by a parent or carer.',
  });
}

export async function loadStudentPortalUsageStatus(
  ctx: AuthedContext,
  input: { now?: Date | undefined; studentId: string },
): Promise<StudentPortalUsageStatusDto> {
  const settings = await loadStudentPortalPolicy(ctx, input.studentId);
  const windows = usageWindows(input.now ?? new Date());
  const counts = await loadStudentPortalUsageCounts(ctx, {
    studentId: input.studentId,
    windows,
  });
  return buildUsageStatus(settings, counts, windows);
}

export async function recordStudentPortalUsageHeartbeat(
  ctx: AuthedContext,
  input: { entity: string; now?: Date | undefined; sessionKey?: string | null; studentId: string },
): Promise<StudentPortalUsageStatusDto> {
  const now = input.now ?? new Date();
  const settings = await loadStudentPortalPolicy(ctx, input.studentId);
  await assertUnlockedPolicy(ctx, { entity: input.entity, settings, studentId: input.studentId });
  await assertUsageLimitPolicy(ctx, { ...input, now, settings });
  const minuteStartedAt = startOfUtcMinute(now);

  await ctx.db.studentPortalUsageMinute.upsert({
    where: { studentId_minuteStartedAt: { studentId: input.studentId, minuteStartedAt } },
    create: {
      studentId: input.studentId,
      minuteStartedAt,
      sessionKey: input.sessionKey ?? null,
      firstSeenAt: now,
      lastSeenAt: now,
    },
    update: {
      lastSeenAt: now,
      sessionKey: input.sessionKey ?? null,
    },
  });

  return loadStudentPortalUsageStatus(ctx, { now, studentId: input.studentId });
}
