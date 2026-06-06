import { TRPCError } from '@trpc/server';
import { Prisma } from '@oasis/db';
import {
  effectiveStudentPortalLock,
  studentMeritShopAccess,
  studentPortalUsageLimitStatus,
  type StudentPortalUsageCounts,
  type StudentPortalUsageLimitStatus,
  type StudentPortalUsageWindow,
  type StudentPortalLockSource,
} from '@oasis/domain/studentPortalSettings';
import type { AppContext, RlsTx } from '../context.js';
import { loadManualTitheStatus } from '../services/tithe-run.js';
import { addUtcDays, startOfUtcDay, startOfUtcMinute } from './utc-date.js';

type AuthedContext = AppContext & { user: NonNullable<AppContext['user']> };

const studentPortalPolicySelect = Prisma.validator<Prisma.StudentPortalSettingsSelect>()({
  parentAccountLocked: true,
  parentLockReasonEnc: true,
  headAcademicLocked: true,
  headAcademicLockReasonEnc: true,
  parentMeritShopBlocked: true,
  dailyUsageLimitMinutes: true,
  offLimitWeekdays: true,
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
  dailyUsageLimitMinutes: number | null;
  offLimitWeekdays: number[];
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
  daily: StudentPortalUsageWindowRange;
}

export interface StudentPortalUsageWindowStatus {
  limitMinutes: number | null;
  usedMinutes: number;
  remainingMinutes: number | null;
  resetAt: Date;
}

export interface StudentPortalUsageStatusDto {
  allowed: boolean;
  blockedReason: 'DailyLimit' | 'OffLimitDay' | null;
  blockedWindow: StudentPortalUsageWindow | null;
  message: string | null;
  daily: StudentPortalUsageWindowStatus;
  offLimitWeekdays: number[];
}

function defaultPolicyState(settings: StudentPortalPolicyRow | null): StudentPortalPolicyState {
  return {
    parentAccountLocked: settings?.parentAccountLocked ?? false,
    parentLockReasonEnc: settings?.parentLockReasonEnc ?? null,
    headAcademicLocked: settings?.headAcademicLocked ?? false,
    headAcademicLockReasonEnc: settings?.headAcademicLockReasonEnc ?? null,
    parentMeritShopBlocked: settings?.parentMeritShopBlocked ?? false,
    dailyUsageLimitMinutes: settings?.dailyUsageLimitMinutes ?? null,
    offLimitWeekdays: settings?.offLimitWeekdays ?? [],
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

function usageWindows(now: Date): StudentPortalUsageWindows {
  const dailyStart = startOfUtcDay(now);
  return {
    daily: { start: dailyStart, end: addUtcDays(dailyStart, 1) },
  };
}

function usageLimitMessage(
  limit: Exclude<StudentPortalUsageLimitStatus, { allowed: true }>,
): string {
  return limit.reason === 'OffLimitDay'
    ? 'Student portal is off limits today.'
    : 'Daily student portal usage limit reached.';
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
  weekday: number,
): StudentPortalUsageStatusDto {
  const state = defaultPolicyState(settings);
  const status = studentPortalUsageLimitStatus(
    {
      dailyUsageLimitMinutes: state.dailyUsageLimitMinutes,
      offLimitWeekdays: state.offLimitWeekdays,
    },
    counts,
    weekday,
  );

  return {
    allowed: status.allowed,
    blockedReason: status.allowed ? null : status.reason,
    blockedWindow: status.allowed || status.reason !== 'DailyLimit' ? null : status.window,
    message: status.allowed ? null : usageLimitMessage(status),
    daily: usageWindowStatus(
      state.dailyUsageLimitMinutes,
      counts.dailyUsageMinutes,
      windows.daily.end,
    ),
    offLimitWeekdays: state.offLimitWeekdays,
  };
}

function hasUsageLimits(settings: StudentPortalPolicyRow | null): boolean {
  return (
    settings?.dailyUsageLimitMinutes !== null && settings?.dailyUsageLimitMinutes !== undefined
  );
}

function hasOffLimitWeekdays(settings: StudentPortalPolicyRow | null): boolean {
  return (settings?.offLimitWeekdays ?? []).length > 0;
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
    reason: 'AccountLocked' | 'OffLimitDay' | 'ParentShopBlock' | 'TitheDue' | 'UsageLimit';
    studentId: string;
    lockSource?: StudentPortalLockSource | undefined;
    usageWindow?: StudentPortalUsageWindow | undefined;
    weekday?: number | undefined;
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
  if (input.weekday !== undefined) {
    meta.weekday = String(input.weekday);
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
  return ctx.withRls((tx) => loadStudentPortalUsageCountsFromTx(tx, input));
}

async function loadStudentPortalUsageCountsFromTx(
  tx: Pick<RlsTx, 'studentPortalUsageMinute'>,
  input: { studentId: string; windows: StudentPortalUsageWindows },
): Promise<StudentPortalUsageCounts> {
  const dailyUsageMinutes = await tx.studentPortalUsageMinute.count({
    where: {
      studentId: input.studentId,
      minuteStartedAt: { gte: input.windows.daily.start, lt: input.windows.daily.end },
    },
  });
  return { dailyUsageMinutes };
}

async function loadUsageStatusFromTx(
  tx: Pick<RlsTx, 'studentPortalUsageMinute'>,
  input: {
    settings: StudentPortalPolicyRow | null;
    studentId: string;
    weekday: number;
    windows: StudentPortalUsageWindows;
  },
): Promise<StudentPortalUsageStatusDto> {
  const counts = await loadStudentPortalUsageCountsFromTx(tx, {
    studentId: input.studentId,
    windows: input.windows,
  });
  return buildUsageStatus(input.settings, counts, input.windows, input.weekday);
}

async function loadPolicyStatusFromTx(
  tx: Pick<RlsTx, 'studentPortalUsageMinute'>,
  input: {
    settings: StudentPortalPolicyRow | null;
    studentId: string;
    weekday: number;
    windows: StudentPortalUsageWindows;
  },
): Promise<StudentPortalUsageStatusDto> {
  const counts = hasUsageLimits(input.settings)
    ? await loadStudentPortalUsageCountsFromTx(tx, {
        studentId: input.studentId,
        windows: input.windows,
      })
    : { dailyUsageMinutes: 0 };
  return buildUsageStatus(input.settings, counts, input.windows, input.weekday);
}

function throwStudentPortalUsageLimit(status: StudentPortalUsageStatusDto): never {
  throw new TRPCError({
    code: 'FORBIDDEN',
    message: status.message ?? 'Student portal usage limit reached.',
  });
}

async function auditUsageStatusDenied(
  ctx: AuthedContext,
  input: { entity: string; studentId: string },
  status: StudentPortalUsageStatusDto,
  weekday: number,
): Promise<void> {
  await auditStudentPortalPolicyDenied(ctx, {
    entity: input.entity,
    reason: status.blockedReason === 'OffLimitDay' ? 'OffLimitDay' : 'UsageLimit',
    studentId: input.studentId,
    usageWindow: status.blockedWindow ?? undefined,
    weekday: status.blockedReason === 'OffLimitDay' ? weekday : undefined,
  });
}

async function throwDeniedUsageStatus(
  ctx: AuthedContext,
  input: { entity: string; studentId: string },
  status: StudentPortalUsageStatusDto,
  weekday: number,
): Promise<never> {
  await auditUsageStatusDenied(ctx, input, status, weekday);
  throwStudentPortalUsageLimit(status);
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
  const now = input.now ?? new Date();
  const windows = usageWindows(now);
  const weekday = now.getUTCDay();
  if (!hasUsageLimits(input.settings) && !hasOffLimitWeekdays(input.settings)) {
    return buildUsageStatus(input.settings, { dailyUsageMinutes: 0 }, windows, weekday);
  }
  const counts = hasUsageLimits(input.settings)
    ? await loadStudentPortalUsageCounts(ctx, {
        studentId: input.studentId,
        windows,
      })
    : { dailyUsageMinutes: 0 };
  const status = buildUsageStatus(input.settings, counts, windows, weekday);

  if (status.allowed) return status;

  return throwDeniedUsageStatus(ctx, input, status, weekday);
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

  if (!access.allowed && access.reason === 'AccountLocked') {
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

  if (!access.allowed) {
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

  const titheStatus = await loadManualTitheStatus(ctx.db, { studentId: input.studentId });
  if (!titheStatus.shopBlocked) return;

  await auditStudentPortalPolicyDenied(ctx, {
    entity: input.entity,
    reason: 'TitheDue',
    studentId: input.studentId,
  });
  throw new TRPCError({
    code: 'FORBIDDEN',
    message: titheStatus.shopBlockReason ?? 'Tithe due before Merit Shop opens.',
  });
}

export async function loadAllowedStudentPortalUsageStatus(
  ctx: AuthedContext,
  input: { entity: string; now?: Date | undefined; studentId: string },
): Promise<StudentPortalUsageStatusDto> {
  const settings = await loadStudentPortalPolicy(ctx, input.studentId);
  await assertUnlockedPolicy(ctx, { entity: input.entity, settings, studentId: input.studentId });
  const now = input.now ?? new Date();
  const windows = usageWindows(now);
  const weekday = now.getUTCDay();
  const status = await ctx.withRls((tx) =>
    loadUsageStatusFromTx(tx, {
      settings,
      studentId: input.studentId,
      weekday,
      windows,
    }),
  );

  if (status.allowed) return status;

  return throwDeniedUsageStatus(ctx, input, status, weekday);
}

type HeartbeatUsageResult =
  | { blocked: false; status: StudentPortalUsageStatusDto }
  | { blocked: true; status: StudentPortalUsageStatusDto };

async function recordHeartbeatInTx(
  tx: Pick<RlsTx, 'studentPortalUsageMinute'>,
  input: {
    now: Date;
    settings: StudentPortalPolicyRow | null;
    sessionKey?: string | null | undefined;
    studentId: string;
    weekday: number;
    windows: StudentPortalUsageWindows;
  },
): Promise<HeartbeatUsageResult> {
  const policyStatus =
    hasUsageLimits(input.settings) || hasOffLimitWeekdays(input.settings)
      ? await loadPolicyStatusFromTx(tx, input)
      : buildUsageStatus(input.settings, { dailyUsageMinutes: 0 }, input.windows, input.weekday);

  if (!policyStatus.allowed) return { blocked: true, status: policyStatus };

  const minuteStartedAt = startOfUtcMinute(input.now);
  await tx.studentPortalUsageMinute.upsert({
    where: { studentId_minuteStartedAt: { studentId: input.studentId, minuteStartedAt } },
    create: {
      studentId: input.studentId,
      minuteStartedAt,
      sessionKey: input.sessionKey ?? null,
      firstSeenAt: input.now,
      lastSeenAt: input.now,
    },
    update: {
      lastSeenAt: input.now,
      sessionKey: input.sessionKey ?? null,
    },
  });

  return {
    blocked: false,
    status: await loadUsageStatusFromTx(tx, input),
  };
}

export async function recordStudentPortalUsageHeartbeat(
  ctx: AuthedContext,
  input: { entity: string; now?: Date | undefined; sessionKey?: string | null; studentId: string },
): Promise<StudentPortalUsageStatusDto> {
  const now = input.now ?? new Date();
  const settings = await loadStudentPortalPolicy(ctx, input.studentId);
  await assertUnlockedPolicy(ctx, { entity: input.entity, settings, studentId: input.studentId });
  const windows = usageWindows(now);
  const weekday = now.getUTCDay();

  const result = await ctx.withRls((tx) =>
    recordHeartbeatInTx(tx, {
      now,
      settings,
      sessionKey: input.sessionKey,
      studentId: input.studentId,
      weekday,
      windows,
    }),
  );

  if (result.blocked) {
    await throwDeniedUsageStatus(ctx, input, result.status, weekday);
  }

  return result.status;
}
