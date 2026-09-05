import { describe, expect, it } from 'vitest';
import { compileStudentReport, DEFAULT_REPORT_SECTIONS } from '../report.js';

describe('compileStudentReport', () => {
  it('freezes period, sections, PACE status, text origins, and computed summaries', () => {
    const out = compileStudentReport({
      studentId: 's1',
      studentDisplayName: 'Asha',
      period: {
        type: 'Term',
        key: '2026-Summer',
        label: 'Summer 2026',
        from: '2026-04-01',
        to: '2026-08-31',
      },
      sections: DEFAULT_REPORT_SECTIONS,
      attendance: { total: 40, present: 36, absent: 2, late: 2 },
      paces: [
        {
          subjectCode: 'MATH',
          subjectName: 'Mathematics',
          currentPace: 1042,
          pacesCompletedThisTerm: 4,
          averageTestScore: 92,
          status: {
            status: 'On Track',
            tone: 'blue',
            testingLevel: 4,
            detail: 'Ahead',
          },
        },
      ],
      behaviour: {
        meritsEarned: 42,
        demeritsCount: 2,
        demeritsMerits: 10,
        generalEntries: [
          {
            id: 'behaviour_1',
            origin: 'Source',
            createdAt: new Date('2026-05-12T09:00:00.000Z'),
            category: 'Character',
            note: 'Served others well.',
          },
        ],
      },
      notes: [
        {
          id: 'note_1',
          origin: 'Source',
          createdAt: new Date('2026-05-13T09:00:00.000Z'),
          note: 'Strong reading.',
        },
      ],
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
    expect(out.period).toEqual({
      type: 'Term',
      key: '2026-Summer',
      label: 'Summer 2026',
      from: '2026-04-01',
      to: '2026-08-31',
    });
    expect(out.sections).toEqual(DEFAULT_REPORT_SECTIONS);
    expect(out.paces[0]?.status.status).toBe('On Track');
    expect(out.behaviour.generalEntries[0]).toEqual({
      id: 'behaviour_1',
      origin: 'Source',
      createdAt: '2026-05-12T09:00:00.000Z',
      category: 'Character',
      note: 'Served others well.',
    });
    expect(out.notes[0]).toEqual({
      id: 'note_1',
      origin: 'Source',
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
    const out = compileStudentReport({
      studentId: 's1',
      studentDisplayName: 'Asha',
      period: {
        type: 'Term',
        key: '2026-Summer',
        label: 'Summer 2026',
        from: '2026-04-01',
        to: '2026-08-31',
      },
      sections: DEFAULT_REPORT_SECTIONS,
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
