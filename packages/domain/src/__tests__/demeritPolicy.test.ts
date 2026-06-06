import { describe, expect, it } from 'vitest';
import {
  demeritMeritDeltaForCategory,
  demeritPolicyEscalationEntryIds,
  demeritPolicyStageForUnits,
  demeritPolicyStatusForEntries,
  demeritPolicyTransitionForEntries,
  demeritPolicyUnitsFromDelta,
  demeritPolicyUnitsForEntry,
} from '../demeritPolicy.js';

describe('demeritPolicyStageForUnits', () => {
  it('maps policy thresholds to stages', () => {
    expect(demeritPolicyStageForUnits(0)).toBe(0);
    expect(demeritPolicyStageForUnits(1)).toBe(1);
    expect(demeritPolicyStageForUnits(3)).toBe(2);
    expect(demeritPolicyStageForUnits(5)).toBe(3);
    expect(demeritPolicyStageForUnits(7)).toBe(3);
    expect(demeritPolicyStageForUnits(9)).toBe(3);
  });
});

describe('demeritPolicyUnitsFromDelta', () => {
  it('uses the stored negative delta as the selected demerit value', () => {
    expect(demeritPolicyUnitsFromDelta(-3)).toBe(3);
    expect(demeritPolicyUnitsFromDelta(-5)).toBe(5);
    expect(demeritPolicyUnitsFromDelta(-10)).toBe(10);
  });
});

describe('demeritMeritDeltaForCategory', () => {
  it('deducts one merit for normal demerits and two for Honesty', () => {
    expect(demeritMeritDeltaForCategory('Conduct')).toBe(-1);
    expect(demeritMeritDeltaForCategory('Honesty')).toBe(-2);
  });
});

describe('demeritPolicyUnitsForEntry', () => {
  it('counts stored demerit values from the saved merit delta', () => {
    expect(
      demeritPolicyUnitsForEntry({ category: 'Honesty', meritDelta: -2, type: 'Demerit' }),
    ).toBe(2);
    expect(
      demeritPolicyUnitsForEntry({ category: 'Honesty', meritDelta: -1, type: 'Demerit' }),
    ).toBe(1);
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

  it('flags serious misconduct for Head review without automatically escalating the stage', () => {
    expect(
      demeritPolicyStatusForEntries([
        { category: 'Serious Misconduct', meritDelta: -1, type: 'Demerit' },
      ]),
    ).toMatchObject({
      badgeTone: 'blue',
      demeritUnits: 1,
      requiresHeadReview: true,
      stage: 1,
    });
  });

  it('adds stored units for demerits', () => {
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

  it('uses a manual Head stage when it is higher than the count-derived stage', () => {
    expect(
      demeritPolicyStatusForEntries([{ category: 'Conduct', meritDelta: -1, type: 'Demerit' }], 4),
    ).toMatchObject({
      demeritUnits: 1,
      manualStage: 4,
      requiresHeadReview: false,
      stage: 4,
      stageLabel: 'Stage 4 - Parent Contact',
    });
  });

  it('flags counts over Stage 3 for Head review while holding the derived stage at Stage 3', () => {
    expect(
      demeritPolicyStatusForEntries([{ category: 'Conduct', meritDelta: -7, type: 'Demerit' }]),
    ).toMatchObject({
      demeritUnits: 7,
      requiresHeadReview: true,
      stage: 3,
    });
  });
});

describe('demeritPolicyTransitionForEntries', () => {
  it('does not require a note while the proposed demerit remains in Stage 2', () => {
    expect(
      demeritPolicyTransitionForEntries(
        [
          { category: 'Conduct', meritDelta: -1, type: 'Demerit' },
          { category: 'Diligence', meritDelta: -1, type: 'Demerit' },
        ],
        [{ category: 'Respect', meritDelta: -1, type: 'Demerit' }],
      ),
    ).toMatchObject({
      escalated: true,
      noteRequired: false,
      previousStatus: { stage: 1 },
      nextStatus: { stage: 2 },
    });
  });

  it('requires a note when the proposed demerit reaches Stage 3', () => {
    expect(
      demeritPolicyTransitionForEntries(
        [
          { category: 'Conduct', meritDelta: -1, type: 'Demerit' },
          { category: 'Diligence', meritDelta: -1, type: 'Demerit' },
          { category: 'Respect', meritDelta: -1, type: 'Demerit' },
          { category: 'Property', meritDelta: -1, type: 'Demerit' },
        ],
        [{ category: 'Conduct', meritDelta: -1, type: 'Demerit' }],
      ),
    ).toMatchObject({
      escalated: true,
      noteRequired: true,
      previousStatus: { stage: 2 },
      nextStatus: { stage: 3 },
    });
  });

  it('requires a note when serious misconduct needs Head review', () => {
    expect(
      demeritPolicyTransitionForEntries(
        [],
        [{ category: 'Serious Misconduct', meritDelta: -1, type: 'Demerit' }],
      ),
    ).toMatchObject({
      escalated: true,
      noteRequired: true,
      previousStatus: { stage: 0 },
      nextStatus: { requiresHeadReview: true, stage: 1 },
    });
  });
});

describe('demeritPolicyEscalationEntryIds', () => {
  it('selects entries that move beyond Stage 3 for Head review', () => {
    const ids = demeritPolicyEscalationEntryIds(
      Array.from({ length: 9 }, (_, index) => ({
        category: 'Conduct',
        createdAt: new Date(`2026-04-29T10:${String(index).padStart(2, '0')}:00.000Z`),
        id: `b${String(index + 1)}`,
        meritDelta: -1,
        studentId: 's1',
        type: 'Demerit' as const,
      })),
    );

    expect([...ids]).toEqual(['b7']);
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
