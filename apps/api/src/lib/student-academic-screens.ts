import { canonicalSchoolYear } from '@oasis/domain';
import type { AppContext } from '../context.js';

const SECONDARY_BAND_NAME = 'Secondary';

export async function canUseStudentAcademicScreens(
  db: Pick<AppContext['db'], 'yearGroupBand'>,
  yearGroup: string,
): Promise<boolean> {
  const band = await db.yearGroupBand.findFirst({
    where: { active: true, name: { equals: SECONDARY_BAND_NAME, mode: 'insensitive' } },
    select: { standardYears: true },
  });
  if (!band) return false;

  const canonical = canonicalSchoolYear(yearGroup);
  return band.standardYears.some((standardYear) => {
    const canonicalBandYear = canonicalSchoolYear(standardYear);
    return (
      standardYear === yearGroup ||
      (canonical !== null && canonicalBandYear !== null && canonicalBandYear === canonical)
    );
  });
}
