import { describe, expect, it, vi } from 'vitest';
import type { SessionUser } from '@oasis/domain';
import {
  loadDailyYearBandScope,
  studentMatchesDailyScope,
  studentWhereForDailyScope,
} from '../lib/daily-year-band-scope.js';

type YearBandRow = {
  id: string;
  name: string;
  standardYears: string[];
  colour: string;
  active: boolean;
};

const primarySupervisor: SessionUser = {
  id: 'u_primary_sup',
  role: 'Supervisor',
  tags: ['supervisor-primary-students'],
  requires2fa: false,
};

const lowerPrimary: YearBandRow = {
  id: 'band_lower',
  name: 'Lower Primary',
  standardYears: ['Reception', 'Year 1'],
  colour: '#5B90C5',
  active: true,
};

const upperPrimary: YearBandRow = {
  id: 'band_upper',
  name: 'Upper Primary',
  standardYears: ['Year 2', 'Year 3', 'Year 4', 'Year 5', 'Year 6'],
  colour: '#2F8F6B',
  active: true,
};

const secondary: YearBandRow = {
  id: 'band_secondary',
  name: 'Secondary',
  standardYears: ['Year 7', 'Year 8'],
  colour: '#8A5A9E',
  active: true,
};

function makeDb(input: { shiftBands?: Array<YearBandRow | null>; primaryBands?: YearBandRow[] }) {
  return {
    staffShift: {
      findMany: vi.fn().mockResolvedValue(
        (input.shiftBands ?? []).map((yearGroupBand) => ({
          yearGroupBand,
        })),
      ),
    },
    yearGroupBand: {
      findMany: vi.fn().mockResolvedValue(input.primaryBands ?? []),
    },
  };
}

describe('loadDailyYearBandScope', () => {
  it('grants primary-tagged supervisors active Lower and Upper Primary bands without a shift', async () => {
    const db = makeDb({ primaryBands: [lowerPrimary, upperPrimary] });

    const scope = await loadDailyYearBandScope(
      { db, user: primarySupervisor },
      new Date('2026-04-29T13:00:00.000Z'),
    );

    expect(scope.assignedBands.map((band) => band.name)).toEqual([
      'Lower Primary',
      'Upper Primary',
    ]);
    expect(studentWhereForDailyScope(scope)).toEqual({
      ageBandId: { in: ['band_lower', 'band_upper'] },
    });
    expect(studentMatchesDailyScope(scope, { ageBandId: 'band_upper' })).toBe(true);
    expect(studentMatchesDailyScope(scope, { ageBandId: 'band_secondary' })).toBe(false);
    expect(db.yearGroupBand.findMany).toHaveBeenCalledWith({
      where: { active: true, name: { in: ['Lower Primary', 'Upper Primary'] } },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, standardYears: true, colour: true, active: true },
    });
  });

  it('does not broaden access when primary bands are missing or inactive', async () => {
    const db = makeDb({ primaryBands: [] });

    const scope = await loadDailyYearBandScope(
      { db, user: primarySupervisor },
      new Date('2026-04-29T00:00:00.000Z'),
    );

    expect(scope.assignedBands).toEqual([]);
    expect(studentWhereForDailyScope(scope)).toEqual({ id: { in: [] } });
    expect(studentMatchesDailyScope(scope, { ageBandId: 'band_upper' })).toBe(false);
  });

  it('combines primary access with assigned non-primary daily bands', async () => {
    const db = makeDb({
      shiftBands: [secondary],
      primaryBands: [lowerPrimary, upperPrimary],
    });

    const scope = await loadDailyYearBandScope(
      { db, user: primarySupervisor },
      new Date('2026-04-29T00:00:00.000Z'),
    );

    expect(scope.assignedBands.map((band) => band.name)).toEqual([
      'Secondary',
      'Lower Primary',
      'Upper Primary',
    ]);
    expect(studentMatchesDailyScope(scope, { ageBandId: 'band_upper' })).toBe(true);
    expect(studentMatchesDailyScope(scope, { ageBandId: 'band_secondary' })).toBe(true);
    expect(studentMatchesDailyScope(scope, { ageBandId: null })).toBe(false);
  });
});
