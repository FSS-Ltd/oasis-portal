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

export type StandardSchoolYear = (typeof STANDARD_SCHOOL_YEARS)[number];

export const standardSchoolYearSchema = z.enum(
  STANDARD_SCHOOL_YEARS as unknown as readonly [StandardSchoolYear, ...StandardSchoolYear[]],
);

const yearSet = new Set<string>(STANDARD_SCHOOL_YEARS);

export function canonicalSchoolYear(year: string): StandardSchoolYear | null {
  const trimmed = year.trim();
  if (yearSet.has(trimmed)) return trimmed as StandardSchoolYear;
  if (/^nursery$/iu.test(trimmed)) return 'Nursery';
  if (/^(reception|abc|r)$/iu.test(trimmed)) return 'Reception';

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
    aliases.add('ABC');
  }

  const match = /^Year ([1-9]|1[0-3])$/u.exec(canonical);
  if (match) aliases.add(`Y${String(Number(match[1]))}`);
  return [...aliases];
}

export function displaySchoolYearLabel(year: string): string {
  const canonical = canonicalSchoolYear(year);
  if (canonical === 'Nursery') return 'Nursery';
  if (canonical === 'Reception') return 'ABC';
  if (canonical === null) return year;

  const match = /^Year ([1-9]|1[0-3])$/u.exec(canonical);
  if (!match) return year;

  const level = Number(match[1]);
  return `Level ${String(level)}`;
}

export function expectedPaceLevelForYear(year: string): number | null {
  const canonical = canonicalSchoolYear(year);
  if (canonical === 'Reception') return 0;
  if (canonical === null) return null;

  const match = /^Year ([1-9]|1[0-3])$/u.exec(canonical);
  if (!match) return null;

  return Number(match[1]);
}

const trimmedNameSchema = z.string().trim().min(1).max(80);
const colourSchema = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/u, 'colour must be a #RRGGBB hex value')
  .transform((value) => value.toUpperCase());

const standardYearsSchema = z
  .array(standardSchoolYearSchema)
  .min(1)
  .superRefine((years, ctx) => {
    const seen = new Set<StandardSchoolYear>();
    for (const year of years) {
      if (seen.has(year)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'standardYears must not contain duplicates',
        });
        return;
      }
      seen.add(year);
    }
  });

export const createYearGroupBandInput = z.object({
  name: trimmedNameSchema,
  standardYears: standardYearsSchema,
  colour: colourSchema,
  sortOrder: z.number().int().min(0).default(0),
});
export type CreateYearGroupBandInput = z.infer<typeof createYearGroupBandInput>;

export const updateYearGroupBandInput = z
  .object({
    id: z.string().min(1),
    name: trimmedNameSchema.optional(),
    standardYears: standardYearsSchema.optional(),
    colour: colourSchema.optional(),
    sortOrder: z.number().int().min(0).optional(),
  })
  .refine(
    (input) =>
      input.name !== undefined ||
      input.standardYears !== undefined ||
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

function activeAcademicYearStart(referenceDate: Date): number {
  const { year, month } = utcDateParts(referenceDate);
  return month >= 9 ? year : year - 1;
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
