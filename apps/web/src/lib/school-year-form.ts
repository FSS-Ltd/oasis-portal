import { deriveEnglandWalesSchoolYear, type StandardSchoolYear } from '@oasis/domain';

export function deriveSchoolYearFromDateInput(value: string): StandardSchoolYear | null {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;

  try {
    return deriveEnglandWalesSchoolYear(date);
  } catch {
    return null;
  }
}
