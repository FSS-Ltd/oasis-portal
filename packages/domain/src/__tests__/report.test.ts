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
        generalEntries: [
          {
            createdAt: new Date('2026-05-12T09:00:00.000Z'),
            category: 'Character',
            note: 'Served others well.',
          },
        ],
      },
      notes: [{ createdAt: new Date('2026-05-13T09:00:00.000Z'), note: 'Strong reading.' }],
      ledgerRows: [
        {
          account: 'Spend',
          delta: 20,
          reason: 'Merit: Scripture memory',
          createdAt: new Date('2026-05-14T09:00:00.000Z'),
        },
        {
          account: 'Saving',
          delta: 10,
          reason: 'Transfer to Saving',
          createdAt: new Date('2026-05-15T09:00:00.000Z'),
        },
      ],
      headSummary: 'Great term.',
    });
    expect(out.attendance.attendancePct).toBe(95);
    expect(out.balances.Spend).toBe(20);
    expect(out.balances.Saving).toBe(10);
    expect(out.headSummary).toBe('Great term.');
    expect(out.behaviour.generalEntries[0]).toEqual({
      createdAt: '2026-05-12T09:00:00.000Z',
      category: 'Character',
      note: 'Served others well.',
    });
    expect(out.notes[0]).toEqual({
      createdAt: '2026-05-13T09:00:00.000Z',
      note: 'Strong reading.',
    });
    expect(out.meritActivity).toEqual([
      {
        createdAt: '2026-05-14T09:00:00.000Z',
        account: 'Spend',
        delta: 20,
        reason: 'Merit: Scripture memory',
      },
      {
        createdAt: '2026-05-15T09:00:00.000Z',
        account: 'Saving',
        delta: 10,
        reason: 'Transfer to Saving',
      },
    ]);
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
      notes: [],
      ledgerRows: [],
    });
    expect(out.attendance.attendancePct).toBe(0);
  });
});
