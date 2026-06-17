import type { Prisma } from '@oasis/db';
import {
  canUseAllStudentSupervisorWorkflow,
  canUsePrimaryStudentSupervisorWorkflow,
  canonicalSchoolYear,
  schoolYearStorageAliases,
  type SessionUser,
} from '@oasis/domain';

const PRIMARY_SUPERVISOR_YEAR_BAND_NAMES = ['Lower Primary', 'Upper Primary'];
const YEAR_GROUP_BAND_SELECT = {
  id: true,
  name: true,
  standardYears: true,
  colour: true,
  active: true,
} as const;

type YearBandRow = {
  id: string;
  name: string;
  standardYears: string[];
  colour: string;
  active: boolean;
};

type StaffShiftScopeDb = {
  staffShift: {
    findMany: (args: {
      where: { staffUserId: string; date: Date };
      orderBy: Array<{ startsAt: 'asc' }>;
      select: {
        yearGroupBand: {
          select: {
            id: true;
            name: true;
            standardYears: true;
            colour: true;
            active: true;
          };
        };
      };
    }) => Promise<Array<{ yearGroupBand: YearBandRow | null }>>;
  };
  yearGroupBand: {
    findMany: (args: {
      where: { active: true; name: { in: string[] } };
      orderBy: Array<{ sortOrder: 'asc' } | { name: 'asc' }>;
      select: typeof YEAR_GROUP_BAND_SELECT;
    }) => Promise<YearBandRow[]>;
  };
};

export type DailyYearBandScope = {
  assignedBands: Array<Omit<YearBandRow, 'active'>>;
  date: Date;
  dayKey: string;
  scopedYears: string[] | null;
};

export function normalizeDate(date: Date): Date {
  return new Date(`${date.toISOString().slice(0, 10)}T00:00:00.000Z`);
}

export function dayEnd(date: Date): Date {
  const end = normalizeDate(date);
  end.setUTCDate(end.getUTCDate() + 1);
  return end;
}

export function dateKey(date: Date): string {
  return normalizeDate(date).toISOString().slice(0, 10);
}

function uniqueBands(bands: readonly (YearBandRow | null)[]): Array<Omit<YearBandRow, 'active'>> {
  const seen = new Set<string>();
  const result: Array<Omit<YearBandRow, 'active'>> = [];
  for (const band of bands) {
    if (!band || !band.active || seen.has(band.id)) continue;
    seen.add(band.id);
    result.push({
      id: band.id,
      name: band.name,
      standardYears: band.standardYears,
      colour: band.colour,
    });
  }
  return result;
}

export async function loadDailyYearBandScope(
  ctx: { db: StaffShiftScopeDb; user: SessionUser },
  date: Date,
): Promise<DailyYearBandScope> {
  const scopedDate = normalizeDate(date);
  if (canUseAllStudentSupervisorWorkflow(ctx.user)) {
    return {
      assignedBands: [],
      date: scopedDate,
      dayKey: dateKey(scopedDate),
      scopedYears: null,
    };
  }

  if (ctx.user.role !== 'Supervisor' && ctx.user.role !== 'ClubsAdmin') {
    return {
      assignedBands: [],
      date: scopedDate,
      dayKey: dateKey(scopedDate),
      scopedYears: null,
    };
  }

  const shifts = await ctx.db.staffShift.findMany({
    where: { staffUserId: ctx.user.id, date: scopedDate },
    orderBy: [{ startsAt: 'asc' }],
    select: {
      yearGroupBand: {
        select: {
          id: true,
          name: true,
          standardYears: true,
          colour: true,
          active: true,
        },
      },
    },
  });
  const primaryBands = canUsePrimaryStudentSupervisorWorkflow(ctx.user)
    ? await ctx.db.yearGroupBand.findMany({
        where: {
          active: true,
          name: { in: PRIMARY_SUPERVISOR_YEAR_BAND_NAMES },
        },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        select: YEAR_GROUP_BAND_SELECT,
      })
    : [];
  const assignedBands = uniqueBands([
    ...shifts.map((shift) => shift.yearGroupBand),
    ...primaryBands,
  ]);
  const scopedYears = [
    ...new Set(
      assignedBands.flatMap((band) =>
        band.standardYears.flatMap((year) => schoolYearStorageAliases(year)),
      ),
    ),
  ];

  return {
    assignedBands,
    date: scopedDate,
    dayKey: dateKey(scopedDate),
    scopedYears,
  };
}

export function studentWhereForDailyScope(scope: DailyYearBandScope): Prisma.StudentWhereInput {
  if (scope.scopedYears === null) return {};
  if (scope.scopedYears.length === 0) return { id: { in: [] } };
  return { yearGroup: { in: scope.scopedYears } };
}

export function studentMatchesDailyScope(
  scope: DailyYearBandScope,
  student: { yearGroup: string },
): boolean {
  if (scope.scopedYears === null) return true;
  const canonical = canonicalSchoolYear(student.yearGroup);
  return (
    scope.scopedYears.includes(student.yearGroup) ||
    (canonical !== null && scope.scopedYears.includes(canonical))
  );
}
