import { describe, expect, it } from 'vitest';
import { createPaceGapPlanInput, nextPaceAfterGap, sortPaceNumbers } from '../paceGaps.js';

describe('PACE gap plans', () => {
  it('validates a catalogue selection and places the jump after every selected gap', () => {
    expect(
      createPaceGapPlanInput.safeParse({
        studentId: 'student',
        subjectId: 'subject',
        paceNumbers: [1023, 1024, 1026],
        jumpToPaceNumber: 1044,
        expectedCurrentPaceNumber: 1044,
      }).success,
    ).toBe(true);
  });

  it('rejects duplicate gaps and a destination at or below a selected gap', () => {
    for (const paceNumbers of [
      [1023, 1023],
      [1023, 1044],
    ]) {
      expect(
        createPaceGapPlanInput.safeParse({
          studentId: 'student',
          subjectId: 'subject',
          paceNumbers,
          jumpToPaceNumber: 1044,
          expectedCurrentPaceNumber: 1044,
        }).success,
      ).toBe(false);
    }
  });

  it('sorts gaps and skips unselected catalogue numbers', () => {
    expect(sortPaceNumbers([1026, 1023, 1026])).toEqual([1023, 1026]);
    expect(nextPaceAfterGap(1023, [1026], 1044)).toBe(1026);
    expect(nextPaceAfterGap(1026, [], 1044)).toBe(1044);
  });

  it('routes the example sequence to the destination itself before regular progression', () => {
    const gaps = [1023, 1024, 1025, 1026];
    const actual = gaps.map((pace, index) => nextPaceAfterGap(pace, gaps.slice(index + 1), 1044));
    expect(actual).toEqual([1024, 1025, 1026, 1044]);
    expect(actual[3]).toBe(1044);
    expect(1044 + 1).toBe(1045);
  });
});
