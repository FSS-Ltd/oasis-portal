import { describe, expect, it } from 'vitest';
import {
  demeritMeritDeltaForCategory,
  demeritPolicyEscalationEntryIds,
  demeritPolicyStageForUnits,
  demeritPolicyStatusForEntries,
  demeritPolicyUnitsFromDelta,
  demeritPolicyUnitsForEntry,
} from '../demeritPolicy.js';

describe('demeritPolicyStageForUnits', () => {
  it('maps policy thresholds to stages', () => {
    expect(demeritPolicyStageForUnits(0)).toBe(0);
    expect(demeritPolicyStageForUnits(1)).toBe(1);
    expect(demeritPolicyStageForUnits(3)).toBe(2);
    expect(demeritPolicyStageForUnits(5)).toBe(3);
    expect(demeritPolicyStageForUnits(7)).toBe(4);
    expect(demeritPolicyStageForUnits(9)).toBe(5);
  });

  it('forces serious misconduct to Stage 4 unless count is already higher', () => {
    expect(demeritPolicyStageForUnits(1, true)).toBe(4);
    expect(demeritPolicyStageForUnits(9, true)).toBe(5);
  });
});

describe('demeritPolicyUnitsFromDelta', () => {
  it('derives at least one policy unit for legacy demerit rows', () => {
    expect(demeritPolicyUnitsFromDelta(-3)).toBe(1);
    expect(demeritPolicyUnitsFromDelta(-5)).toBe(1);
    expect(demeritPolicyUnitsFromDelta(-10)).toBe(2);
  });
});

describe('demeritMeritDeltaForCategory', () => {
  it('deducts one merit for normal demerits and two for Honesty', () => {
    expect(demeritMeritDeltaForCategory('Conduct')).toBe(-1);
    expect(demeritMeritDeltaForCategory('Honesty')).toBe(-2);
  });
});

describe('demeritPolicyUnitsForEntry', () => {
  it('counts Honesty as two daily demerit units', () => {
    expect(
      demeritPolicyUnitsForEntry({ category: 'Honesty', meritDelta: -2, type: 'Demerit' }),
    ).toBe(2);
  });
});

describe('demeritPolicyStatusForEntries', () => {
  it('returns green zero status when there are no demerits', () => {
    expect(demeritPolicyStatusForEntries([])).toMatchObject({
      badgeTone: 'green',
      demeritUnits: 0,
      requiresHeadReview: false,
      stage: 0,
      stageLabel: 'No demerits',
    });
  });

  it('flags serious misconduct for Head review', () => {
    expect(
      demeritPolicyStatusForEntries([
        { category: 'Serious Misconduct', meritDelta: -5, type: 'Demerit' },
      ]),
    ).toMatchObject({
      badgeTone: 'red',
      demeritUnits: 1,
      requiresHeadReview: true,
      stage: 4,
    });
  });

  it('adds two units for Honesty demerits', () => {
    expect(
      demeritPolicyStatusForEntries([
        { category: 'Conduct', meritDelta: -1, type: 'Demerit' },
        { category: 'Honesty', meritDelta: -2, type: 'Demerit' },
      ]),
    ).toMatchObject({
      demeritUnits: 3,
      stage: 2,
    });
  });
});

describe('demeritPolicyEscalationEntryIds', () => {
  it('selects entries that cross Stage 4 or Stage 5', () => {
    const ids = demeritPolicyEscalationEntryIds(
      Array.from({ length: 9 }, (_, index) => ({
        category: 'Conduct',
        createdAt: new Date(`2026-04-29T10:${String(index).padStart(2, '0')}:00.000Z`),
        id: `b${String(index + 1)}`,
        meritDelta: -5,
        studentId: 's1',
        type: 'Demerit' as const,
      })),
    );

    expect([...ids]).toEqual(['b7', 'b9']);
  });

  it('selects serious misconduct immediately', () => {
    const ids = demeritPolicyEscalationEntryIds([
      {
        category: 'Serious Misconduct',
        createdAt: new Date('2026-04-29T10:00:00.000Z'),
        id: 'serious',
        meritDelta: -5,
        studentId: 's1',
        type: 'Demerit',
      },
    ]);

    expect([...ids]).toEqual(['serious']);
  });
});
