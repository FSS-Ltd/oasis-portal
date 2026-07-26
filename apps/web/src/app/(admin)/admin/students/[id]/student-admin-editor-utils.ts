import { z } from 'zod';
import { STANDARD_SCHOOL_YEARS, type StandardSchoolYear } from '@oasis/domain';

export function isStandardSchoolYear(value: string): value is StandardSchoolYear {
  return STANDARD_SCHOOL_YEARS.includes(value as StandardSchoolYear);
}

export function parseStandardSchoolYear(value: string): StandardSchoolYear {
  if (!isStandardSchoolYear(value)) throw new Error('Choose a standard year group');
  return value;
}

export const editSchema = z.object({
  fullName: z.string().trim().min(1, 'Enter the student name'),
  dob: z.string().min(1, 'Enter the date of birth'),
  yearGroup: z.string().refine(isStandardSchoolYear, 'Choose a standard year group'),
  enrolmentDate: z.string().min(1, 'Enter the enrolment date'),
  address: z.string().trim().optional(),
});

export type EditValues = z.input<typeof editSchema>;

export function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}
