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
  hourlyUsageLimitMinutes?: number | null;
  dailyUsageLimitMinutes?: number | null;
  weeklyUsageLimitMinutes?: number | null;
}

export interface StudentPortalUsageLimits {
  hourlyUsageLimitMinutes: number | null;
  dailyUsageLimitMinutes: number | null;
  weeklyUsageLimitMinutes: number | null;
}

export type StudentMeritShopBlockReason = 'AccountLocked' | 'ParentShopBlock';

export interface StudentMeritShopAccessInput extends StudentPortalLockInput {
  parentMeritShopBlocked: boolean;
}

export type StudentMeritShopAccess =
  | { allowed: true }
  | { allowed: false; reason: StudentMeritShopBlockReason };

const ADULT_AGE_YEARS = 18;

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
    hourlyUsageLimitMinutes: validateLimit(
      'hourlyUsageLimitMinutes',
      input.hourlyUsageLimitMinutes,
      60,
    ),
    dailyUsageLimitMinutes: validateLimit(
      'dailyUsageLimitMinutes',
      input.dailyUsageLimitMinutes,
      1_440,
    ),
    weeklyUsageLimitMinutes: validateLimit(
      'weeklyUsageLimitMinutes',
      input.weeklyUsageLimitMinutes,
      10_080,
    ),
  };
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
