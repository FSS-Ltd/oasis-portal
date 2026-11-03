import { z } from 'zod';
import { standardSchoolYearSchema } from '@oasis/domain';

export const editSchema = z.object({
  fullName: z.string().trim().min(1, 'Enter the student name'),
  dob: z.string().min(1, 'Enter the date of birth'),
  yearGroupOverride: standardSchoolYearSchema.nullable(),
  enrolmentDate: z.string().min(1, 'Enter the Oasis start date'),
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
