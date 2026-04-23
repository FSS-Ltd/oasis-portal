import { describe, expect, it } from 'vitest';
import { compileTermReport } from '../report.js';

describe('compileTermReport', () => {
  it('computes attendance %, balances, and preserves behaviour summary', () => {
    const out = compileTermReport({
      studentId: 's1',
      studentDisplayName: 'Asha',
      term: '2026-Summer',
      attendance: { total: 40, present: 36, absent: 2, late: 2 },
      paces: [
        {
          subjectCode: 'MATH',
          subjectName: 'Mathematics',
          currentPace: 1042,
          pacesCompletedThisTerm: 4,
          averageTestScore: 92,
        },
      ],
      behaviour: {
        meritsEarned: 42,
        demeritsCount: 2,
        demeritsMerits: 10,
        generalEntries: [],
      },
      ledgerRows: [
        { account: 'Spend', delta: 20 },
        { account: 'Saving', delta: 10 },
      ],
      headSummary: 'Great term.',
    });
    expect(out.attendance.attendancePct).toBe(90);
    expect(out.balances.Spend).toBe(20);
    expect(out.balances.Saving).toBe(10);
    expect(out.headSummary).toBe('Great term.');
    expect(typeof out.compiledAt).toBe('string');
  });

  it('handles zero attendance days without dividing by zero', () => {
    const out = compileTermReport({
      studentId: 's1',
      studentDisplayName: 'Asha',
      term: '2026-Summer',
      attendance: { total: 0, present: 0, absent: 0, late: 0 },
      paces: [],
      behaviour: {
        meritsEarned: 0,
        demeritsCount: 0,
        demeritsMerits: 0,
        generalEntries: [],
      },
      ledgerRows: [],
    });
    expect(out.attendance.attendancePct).toBe(0);
  });
});
