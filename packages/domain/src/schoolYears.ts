import { z } from 'zod';

export const STANDARD_SCHOOL_YEARS = [
  'Nursery',
  'Reception',
  'Year 1',
  'Year 2',
  'Year 3',
  'Year 4',
  'Year 5',
  'Year 6',
  'Year 7',
  'Year 8',
  'Year 9',
  'Year 10',
  'Year 11',
  'Year 12',
  'Year 13',
] as const;

export const OUTSIDE_SCHOOL_AGE_LABEL = 'Outside school age';
export const SCHOOL_AGE_UNAVAILABLE_LABEL = 'DOB required';

export type StandardSchoolYear = (typeof STANDARD_SCHOOL_YEARS)[number];

const standardSchoolYearValues: readonly [StandardSchoolYear, ...StandardSchoolYear[]] =
  STANDARD_SCHOOL_YEARS;

export const standardSchoolYearSchema = z.enum(standardSchoolYearValues);

const yearSet = new Set<string>(STANDARD_SCHOOL_YEARS);

export function canonicalSchoolYear(year: string): StandardSchoolYear | null {
  const trimmed = year.trim();
  if (yearSet.has(trimmed)) return trimmed as StandardSchoolYear;
  if (/^(nursery|n)$/iu.test(trimmed)) return 'Nursery';
  if (/^(reception|r)$/iu.test(trimmed)) return 'Reception';
  if (/^abc$/iu.test(trimmed)) return 'Year 1';

  const levelMatch = /^level\s*([1-9]|1[0-2])$/iu.exec(trimmed);
  if (levelMatch) return `Year ${String(Number(levelMatch[1]) + 1)}` as StandardSchoolYear;

  const yearMatch = /^(?:year\s*|y)([1-9]|1[0-3])$/iu.exec(trimmed);
  if (!yearMatch) return null;

  const canonical = `Year ${String(Number(yearMatch[1]))}`;
  return yearSet.has(canonical) ? (canonical as StandardSchoolYear) : null;
}

export function schoolYearStorageAliases(year: string): string[] {
  const canonical = canonicalSchoolYear(year);
  if (canonical === null) return [year];

  const aliases = new Set<string>([canonical]);
  if (canonical === 'Nursery') aliases.add('N');
  if (canonical === 'Reception') {
    aliases.add('R');
  }

  const match = /^Year ([1-9]|1[0-3])$/u.exec(canonical);
  if (match) {
    const yearNumber = Number(match[1]);
    aliases.add(`Y${String(yearNumber)}`);
    aliases.add(yearNumber === 1 ? 'ABC' : `Level ${String(yearNumber - 1)}`);
  }
  return [...aliases];
}

export function displaySchoolYearLabel(year: string): string {
  const canonical = canonicalSchoolYear(year);
  if (canonical === 'Year 1') return 'ABC';
  const match = canonical && /^Year ([1-9]|1[0-3])$/u.exec(canonical);
  return match ? `Level ${String(Number(match[1]) - 1)}` : (canonical ?? year);
}

export function displaySchoolYearLabels(years: readonly string[]): string {
  return [...new Set(years.map((year) => displaySchoolYearLabel(year.trim())))].join(', ');
}

export interface AgeBandCandidate {
  active: boolean;
  colour: string;
  id: string;
  name: string;
  standardYears: readonly string[];
}

export interface ResolvedAgeBand {
  colour: string;
  id: string;
  name: string;
}

export function resolveAgeBand(
  yearGroup: string,
  bands: readonly AgeBandCandidate[],
): ResolvedAgeBand | null {
  const canonical = canonicalSchoolYear(yearGroup);
  if (!canonical) return null;

  const matches = bands.filter(
    (band) =>
      band.active && band.standardYears.some((year) => canonicalSchoolYear(year) === canonical),
  );
  if (matches.length !== 1) return null;

  const match = matches[0] as AgeBandCandidate;
  return { id: match.id, name: match.name, colour: match.colour };
}

export function expectedPaceLevelForYear(year: string): number | null {
  const canonical = canonicalSchoolYear(year);
  if (canonical === null) return null;

  const match = /^Year ([1-9]|1[0-3])$/u.exec(canonical);
  if (!match) return null;

  return Number(match[1]) - 1;
}

const trimmedNameSchema = z.string().trim().min(1).max(80);
const colourSchema = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/u, 'colour must be a #RRGGBB hex value')
  .transform((value) => value.toUpperCase());

const studentIdsSchema = z
  .array(z.string().trim().min(1))
  .max(500)
  .default([])
  .superRefine((studentIds, ctx) => {
    const seen = new Set<string>();
    for (const studentId of studentIds) {
      if (seen.has(studentId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'studentIds must not contain duplicates',
        });
        return;
      }
      seen.add(studentId);
    }
  });

export const createYearGroupBandInput = z.object({
  name: trimmedNameSchema,
  studentIds: studentIdsSchema,
  colour: colourSchema,
  sortOrder: z.number().int().min(0).default(0),
});
export type CreateYearGroupBandInput = z.infer<typeof createYearGroupBandInput>;

export const updateYearGroupBandInput = z
  .object({
    id: z.string().min(1),
    name: trimmedNameSchema.optional(),
    studentIds: studentIdsSchema.optional(),
    colour: colourSchema.optional(),
    sortOrder: z.number().int().min(0).optional(),
  })
  .refine(
    (input) =>
      input.name !== undefined ||
      input.studentIds !== undefined ||
      input.colour !== undefined ||
      input.sortOrder !== undefined,
    { message: 'at least one field must be provided' },
  );
export type UpdateYearGroupBandInput = z.infer<typeof updateYearGroupBandInput>;

export const deactivateYearGroupBandInput = z.object({
  id: z.string().min(1),
});
export type DeactivateYearGroupBandInput = z.infer<typeof deactivateYearGroupBandInput>;

function utcDateParts(date: Date): { year: number; month: number; day: number } {
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

const schoolCalendar = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London',
  year: 'numeric',
  month: 'numeric',
});

function activeAcademicYearStart(referenceDate: Date): number {
  const parts = schoolCalendar.formatToParts(referenceDate);
  const year = Number(parts.find((part) => part.type === 'year')?.value);
  const month = Number(parts.find((part) => part.type === 'month')?.value);
  return month >= 9 ? year : year - 1;
}

export function academicYearStart(referenceDate: Date = new Date()): Date {
  if (Number.isNaN(referenceDate.getTime())) {
    throw new Error('referenceDate must be a valid date');
  }

  return new Date(`${String(activeAcademicYearStart(referenceDate))}-09-01T00:00:00.000Z`);
}

function ageOnCutoff(dob: Date, academicYearStart: number): number {
  const birth = utcDateParts(dob);
  const cutoff = { year: academicYearStart, month: 8, day: 31 };
  let age = cutoff.year - birth.year;
  if (birth.month > cutoff.month || (birth.month === cutoff.month && birth.day > cutoff.day)) {
    age -= 1;
  }
  return age;
}

export function deriveEnglandWalesSchoolYear(
  dob: Date,
  referenceDate: Date = new Date(),
): StandardSchoolYear {
  if (Number.isNaN(dob.getTime()) || Number.isNaN(referenceDate.getTime())) {
    throw new Error('dob and referenceDate must be valid dates');
  }

  const age = ageOnCutoff(dob, activeAcademicYearStart(referenceDate));
  if (age === 3) return 'Nursery';
  if (age === 4) return 'Reception';
  if (age >= 5 && age <= 17) {
    const yearNumber = age - 4;
    const label = `Year ${String(yearNumber)}`;
    if (yearSet.has(label)) return label as StandardSchoolYear;
  }

  throw new Error('date of birth does not map to a standard Oasis school year');
}

export type ResolvedSchoolYear =
  | StandardSchoolYear
  | typeof OUTSIDE_SCHOOL_AGE_LABEL
  | typeof SCHOOL_AGE_UNAVAILABLE_LABEL;

/** Resolve a current cohort without retaining a stale level for unsupported DOBs. */
export function resolveSchoolYearForDob(
  dob: Date | string | null | undefined,
  referenceDate: Date = new Date(),
): ResolvedSchoolYear {
  if (Number.isNaN(referenceDate.getTime())) {
    throw new Error('referenceDate must be a valid date');
  }
  const birth =
    typeof dob === 'string'
      ? /^\d{4}-\d{2}-\d{2}$/u.test(dob)
        ? new Date(`${dob}T00:00:00.000Z`)
        : null
      : dob;
  if (!birth || Number.isNaN(birth.getTime())) return SCHOOL_AGE_UNAVAILABLE_LABEL;
  if (typeof dob === 'string' && birth.toISOString().slice(0, 10) !== dob) {
    return SCHOOL_AGE_UNAVAILABLE_LABEL;
  }
  if (birth.getTime() > referenceDate.getTime()) return SCHOOL_AGE_UNAVAILABLE_LABEL;
  const age = ageOnCutoff(birth, activeAcademicYearStart(referenceDate));
  if (age < 3 || age > 17) return OUTSIDE_SCHOOL_AGE_LABEL;
  return deriveEnglandWalesSchoolYear(birth, referenceDate);
}
