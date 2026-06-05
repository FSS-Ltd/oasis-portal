import { canUseLinkedChildGuardianAccess, type SessionUser } from './rbac.js';

export type StudentPortalLockSource = 'Parent' | 'HeadAcademic';

export interface StudentPortalLockInput {
  parentAccountLocked: boolean;
  headAcademicLocked: boolean;
}

export interface EffectiveStudentPortalLock {
  locked: boolean;
  primarySource?: StudentPortalLockSource;
  sources: StudentPortalLockSource[];
}

export interface StudentPortalEligibilityInput {
  dateOfBirth: Date | string;
  asOf?: Date | string;
}

export interface StudentPortalUsageLimitsInput {
  dailyUsageLimitMinutes?: number | null;
  offLimitWeekdays?: readonly number[] | null;
}

export interface StudentPortalUsageLimits {
  dailyUsageLimitMinutes: number | null;
  offLimitWeekdays: number[];
}

export type StudentPortalUsageWindow = 'Daily';

export interface StudentPortalUsageCounts {
  dailyUsageMinutes: number;
}

export interface StudentPortalUsageLimitReached {
  allowed: false;
  reason: 'DailyLimit';
  window: StudentPortalUsageWindow;
  limitMinutes: number;
  usedMinutes: number;
}

export interface StudentPortalOffLimitDayReached {
  allowed: false;
  reason: 'OffLimitDay';
  weekday: number;
}

export type StudentPortalUsageLimitStatus =
  | { allowed: true }
  | StudentPortalUsageLimitReached
  | StudentPortalOffLimitDayReached;

export type StudentMeritShopBlockReason = 'AccountLocked' | 'ParentShopBlock';

export interface StudentMeritShopAccessInput extends StudentPortalLockInput {
  parentMeritShopBlocked: boolean;
}

export type StudentMeritShopAccess =
  | { allowed: true }
  | { allowed: false; reason: StudentMeritShopBlockReason };

const ADULT_AGE_YEARS = 18;
const MAX_DAILY_USAGE_LIMIT_MINUTES = 1_440;

export function isStudentAdult(input: StudentPortalEligibilityInput): boolean {
  const dateOfBirth = dateOnlyParts(input.dateOfBirth, 'dateOfBirth');
  const asOf = dateOnlyParts(input.asOf ?? new Date(), 'asOf');
  const eighteenthBirthday = {
    year: dateOfBirth.year + ADULT_AGE_YEARS,
    month: dateOfBirth.month,
    day: dateOfBirth.day,
  };

  return compareDateParts(asOf, eighteenthBirthday) >= 0;
}

export function canParentControlStudent(input: StudentPortalEligibilityInput): boolean {
  return !isStudentAdult(input);
}

export function canUseLinkedChildStudentSettingsAccess(user: Pick<SessionUser, 'role'>): boolean {
  return canUseLinkedChildGuardianAccess(user);
}

export function effectiveStudentPortalLock(
  input: StudentPortalLockInput,
): EffectiveStudentPortalLock {
  const sources: StudentPortalLockSource[] = [];
  if (input.parentAccountLocked) sources.push('Parent');
  if (input.headAcademicLocked) sources.push('HeadAcademic');

  if (sources.length === 0) {
    return { locked: false, sources };
  }

  return {
    locked: true,
    primarySource: input.headAcademicLocked ? 'HeadAcademic' : 'Parent',
    sources,
  };
}

export function validateStudentPortalUsageLimits(
  input: StudentPortalUsageLimitsInput,
): StudentPortalUsageLimits {
  return {
    dailyUsageLimitMinutes: validateLimit(
      'dailyUsageLimitMinutes',
      input.dailyUsageLimitMinutes,
      MAX_DAILY_USAGE_LIMIT_MINUTES,
    ),
    offLimitWeekdays: validateWeekdays(input.offLimitWeekdays),
  };
}

export function studentPortalUsageLimitStatus(
  limits: StudentPortalUsageLimits,
  usage: StudentPortalUsageCounts,
  weekday: number,
): StudentPortalUsageLimitStatus {
  if (limits.offLimitWeekdays.includes(weekday)) {
    return { allowed: false, reason: 'OffLimitDay', weekday };
  }

  if (
    limits.dailyUsageLimitMinutes !== null &&
    usage.dailyUsageMinutes >= limits.dailyUsageLimitMinutes
  ) {
    return {
      allowed: false,
      reason: 'DailyLimit',
      window: 'Daily',
      limitMinutes: limits.dailyUsageLimitMinutes,
      usedMinutes: usage.dailyUsageMinutes,
    };
  }

  return { allowed: true };
}

export function studentMeritShopAccess(input: StudentMeritShopAccessInput): StudentMeritShopAccess {
  if (effectiveStudentPortalLock(input).locked) {
    return { allowed: false, reason: 'AccountLocked' };
  }
  if (input.parentMeritShopBlocked) {
    return { allowed: false, reason: 'ParentShopBlock' };
  }
  return { allowed: true };
}

function validateLimit(
  field: string,
  value: number | null | undefined,
  max: number,
): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (!Number.isInteger(value) || value < 1 || value > max) {
    throw new Error(`${field} must be an integer from 1 to ${String(max)} minutes`);
  }
  return value;
}

function validateWeekdays(value: readonly number[] | null | undefined): number[] {
  if (value === null || value === undefined) return [];

  const seen = new Set<number>();
  for (const weekday of value) {
    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
      throw new Error('offLimitWeekdays must contain integers from 0 to 6');
    }
    if (seen.has(weekday)) {
      throw new Error('offLimitWeekdays must not contain duplicate days');
    }
    seen.add(weekday);
  }

  return [...seen].sort((left, right) => left - right);
}

interface DateParts {
  year: number;
  month: number;
  day: number;
}

function dateOnlyParts(value: Date | string, field: string): DateParts {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new Error(`${field} must be a valid date`);
    }
    return {
      year: value.getUTCFullYear(),
      month: value.getUTCMonth() + 1,
      day: value.getUTCDate(),
    };
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    throw new Error(`${field} must be a YYYY-MM-DD date`);
  }
  const [, year, month, day] = match;
  return {
    year: Number(year),
    month: Number(month),
    day: Number(day),
  };
}

function compareDateParts(left: DateParts, right: DateParts): number {
  if (left.year !== right.year) return left.year - right.year;
  if (left.month !== right.month) return left.month - right.month;
  return left.day - right.day;
}
