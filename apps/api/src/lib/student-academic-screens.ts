import type { AppContext } from '../context.js';

const SECONDARY_BAND_NAME = 'Secondary';

export async function canUseStudentAcademicScreens(
  db: Pick<AppContext['db'], 'yearGroupBand'>,
  ageBandId: string | null,
): Promise<boolean> {
  if (!ageBandId) return false;
  const band = await db.yearGroupBand.findFirst({
    where: {
      id: ageBandId,
      active: true,
      name: { equals: SECONDARY_BAND_NAME, mode: 'insensitive' },
    },
    select: { id: true },
  });
  return band !== null;
}
