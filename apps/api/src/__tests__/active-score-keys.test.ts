import { describe, expect, it, vi } from 'vitest';
import type { RlsTx } from '../context.js';
import type { AppContext } from '../context.js';
import { loadActiveScoreKeyReport } from '../reports/active-score-keys.js';
import { scoreKeyReportRouter } from '../routers/scoreKeyReport.js';
import type { SessionUser } from '@oasis/domain';

describe('loadActiveScoreKeyReport', () => {
  it('groups active assignments by subject and current PACE without loading students', async () => {
    const groupBy = vi.fn().mockResolvedValue([
      { subjectId: 'math', currentPaceNumber: 1030, _count: { _all: 1 } },
      { subjectId: 'eng', currentPaceNumber: 1029, _count: { _all: 2 } },
      { subjectId: 'math', currentPaceNumber: 1029, _count: { _all: 3 } },
      { subjectId: 'archived-subject', currentPaceNumber: 7777, _count: { _all: 1 } },
    ]);
    const findMany = vi.fn().mockResolvedValue([
      { id: 'math', code: 'MATH', name: 'Mathematics' },
      { id: 'eng', code: 'ENG', name: 'English' },
    ]);
    const tx = {
      studentSubject: { groupBy },
      subject: { findMany },
    } as unknown as RlsTx;

    const result = await loadActiveScoreKeyReport(tx);

    expect(groupBy).toHaveBeenCalledWith({
      by: ['subjectId', 'currentPaceNumber'],
      where: { student: { active: true }, subject: { active: true } },
      _count: { _all: true },
    });
    expect(findMany).toHaveBeenCalledWith({
      where: { id: { in: ['math', 'eng', 'archived-subject'] }, active: true },
      select: { id: true, code: true, name: true },
    });
    expect(result.rows).toEqual([
      {
        subjectId: 'eng',
        subjectCode: 'ENG',
        subjectName: 'English',
        paceNumber: 1029,
        childCount: 2,
      },
      {
        subjectId: 'math',
        subjectCode: 'MATH',
        subjectName: 'Mathematics',
        paceNumber: 1029,
        childCount: 3,
      },
      {
        subjectId: 'math',
        subjectCode: 'MATH',
        subjectName: 'Mathematics',
        paceNumber: 1030,
        childCount: 1,
      },
    ]);
    expect(result.activeKeyCount).toBe(3);
    expect(result.subjectCount).toBe(2);
    expect(result.scope).toBe('all');
  });

  it.each([
    ['abc-primary', [1020, 1021, 1022, 1023]],
    ['secondary', [1080, 1081]],
  ] as const)('uses school year rather than signup level for %s', async (scope, paces) => {
    const students = [
      { yearGroup: 'Year 5', signupLevel: 'Primary', pace: 1020 },
      { yearGroup: 'Y6', signupLevel: null, pace: 1021 },
      { yearGroup: 'ABC', signupLevel: 'ABC', pace: 1022 },
      { yearGroup: 'Nursery', signupLevel: 'Primary', pace: 1023 },
      { yearGroup: 'Year 7', signupLevel: 'Primary', pace: 1080 },
      { yearGroup: 'Y13', signupLevel: 'Secondary', pace: 1081 },
      { yearGroup: 'Custom', signupLevel: 'Primary', pace: 1099 },
    ];
    type GroupByArgs = {
      where: {
        student?: {
          registrationProfile?: { is: { registrationLevel: string | { in: string[] } } };
          yearGroup?: { in: string[] };
        };
      };
    };
    const groupBy = vi.fn(({ where }: GroupByArgs) => {
      const years = where.student?.yearGroup?.in;
      const signupLevel = where.student?.registrationProfile?.is.registrationLevel;
      const levels = typeof signupLevel === 'string' ? [signupLevel] : signupLevel?.in;
      return students
        .filter((student) =>
          years ? years.includes(student.yearGroup) : levels?.includes(student.signupLevel ?? ''),
        )
        .map((student) => ({
          subjectId: 'math',
          currentPaceNumber: student.pace,
          _count: { _all: 1 },
        }));
    });
    const tx = {
      studentSubject: { groupBy },
      subject: {
        findMany: vi.fn().mockResolvedValue([{ id: 'math', code: 'MATH', name: 'Mathematics' }]),
      },
    } as unknown as RlsTx;

    const result = await loadActiveScoreKeyReport(tx, scope);

    expect(result.rows.map((row) => row.paceNumber)).toEqual(paces);
    expect(result.scope).toBe(scope);
  });

  it('returns a successful empty report without querying subjects', async () => {
    const groupBy = vi.fn().mockResolvedValue([]);
    const findMany = vi.fn();
    const tx = {
      studentSubject: { groupBy },
      subject: { findMany },
    } as unknown as RlsTx;

    const result = await loadActiveScoreKeyReport(tx);

    expect(result.rows).toEqual([]);
    expect(result.activeKeyCount).toBe(0);
    expect(result.subjectCount).toBe(0);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('checks access at the API boundary before reading aggregate data', async () => {
    const withRls = vi.fn();
    const parent: SessionUser = {
      id: 'parent-id',
      role: 'Parent',
      tags: [],
      requires2fa: false,
    };
    const context = { user: parent, withRls } as unknown as AppContext;
    const caller = scoreKeyReportRouter.createCaller(context);

    await expect(caller.current()).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(withRls).not.toHaveBeenCalled();
  });
});
