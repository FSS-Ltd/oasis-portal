import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LEADERBOARD,
  canViewDemeritLeaderboard,
  investmentReturnPct,
  isPublicLeaderboard,
  rankLeaderboard,
} from '../leaderboard.js';
import type { SessionUser } from '../rbac.js';

describe('rankLeaderboard', () => {
  it('ranks descending and applies a limit', () => {
    const rows = rankLeaderboard(
      [
        {
          studentId: 's1',
          displayName: 'A',
          yearGroup: 'Year 7',
          metric: 10,
          enrolmentDate: new Date('2025-01-01'),
        },
        {
          studentId: 's2',
          displayName: 'B',
          yearGroup: 'Year 8',
          metric: 30,
          enrolmentDate: new Date('2025-01-01'),
        },
        {
          studentId: 's3',
          displayName: 'C',
          yearGroup: 'Year 9',
          metric: 20,
          enrolmentDate: new Date('2025-01-01'),
        },
      ],
      2,
    );
    expect(rows.map((r) => r.studentId)).toEqual(['s2', 's3']);
    expect(rows[0]?.rank).toBe(1);
  });

  it('breaks ties by earliest enrolmentDate', () => {
    const rows = rankLeaderboard([
      {
        studentId: 'older',
        displayName: 'A',
        yearGroup: 'Year 8',
        metric: 10,
        enrolmentDate: new Date('2024-09-01'),
      },
      {
        studentId: 'newer',
        displayName: 'B',
        yearGroup: 'Year 9',
        metric: 10,
        enrolmentDate: new Date('2025-01-01'),
      },
    ]);
    expect(rows[0]?.studentId).toBe('older');
  });

  it('breaks equal-score and equal-date ties by student id', () => {
    const rows = rankLeaderboard([
      {
        studentId: 'student-b',
        displayName: 'B',
        yearGroup: 'Year 8',
        metric: 10,
        enrolmentDate: new Date('2025-01-01'),
      },
      {
        studentId: 'student-a',
        displayName: 'A',
        yearGroup: 'Year 8',
        metric: 10,
        enrolmentDate: new Date('2025-01-01'),
      },
    ]);
    expect(rows.map((row) => row.studentId)).toEqual(['student-a', 'student-b']);
  });
});

describe('defaults and access', () => {
  it('TopTithers is the default board', () => {
    expect(DEFAULT_LEADERBOARD).toBe('TopTithers');
  });

  it('HighestDemerits is not public', () => {
    expect(isPublicLeaderboard('HighestDemerits')).toBe(false);
    expect(isPublicLeaderboard('TopTithers')).toBe(true);
    expect(isPublicLeaderboard('TopInvestors')).toBe(true);
    expect(isPublicLeaderboard('TopSavers')).toBe(true);
  });

  it('demerit leaderboard is gated to full-admin or leaderboard-admin tag', () => {
    const admin: SessionUser = {
      id: 'u1',
      role: 'Supervisor',
      tags: ['leaderboard-admin'],
      requires2fa: false,
    };
    const head: SessionUser = { id: 'u2', role: 'Head', tags: [], requires2fa: false };
    const supervisor: SessionUser = { id: 'u3', role: 'Supervisor', tags: [], requires2fa: false };
    expect(canViewDemeritLeaderboard(admin)).toBe(true);
    expect(canViewDemeritLeaderboard(head)).toBe(true);
    expect(canViewDemeritLeaderboard(supervisor)).toBe(false);
  });
});

describe('investmentReturnPct', () => {
  it('returns 0 on zero cost basis', () => {
    expect(investmentReturnPct({ costBasis: 0, currentValue: 100 })).toBe(0);
  });
  it('computes percentage return', () => {
    expect(investmentReturnPct({ costBasis: 100, currentValue: 110 })).toBe(10);
    expect(investmentReturnPct({ costBasis: 100, currentValue: 90 })).toBe(-10);
  });
});
