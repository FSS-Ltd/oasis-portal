import { TRPCError } from '@trpc/server';
import {
  deriveEnglandWalesSchoolYear,
  resolveSchoolYearForDob,
  SCHOOL_AGE_UNAVAILABLE_LABEL,
  type ResolvedSchoolYear,
  type StandardSchoolYear,
} from '@oasis/domain';

export function schoolYearForStudentDob(dob: Date): StandardSchoolYear {
  try {
    return deriveEnglandWalesSchoolYear(dob);
  } catch {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Date of birth must fall within the supported school age range.',
    });
  }
}

export function schoolYearForExistingStudentDob(
  dob: Date,
): Exclude<ResolvedSchoolYear, typeof SCHOOL_AGE_UNAVAILABLE_LABEL> {
  const yearGroup = resolveSchoolYearForDob(dob);
  if (yearGroup === SCHOOL_AGE_UNAVAILABLE_LABEL) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Enter a valid date of birth on or before today.',
    });
  }
  return yearGroup;
}
