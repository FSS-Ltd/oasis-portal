import { describe, expect, it } from 'vitest';

import {
  attemptedPaceRange,
  canOpenAcademicInventory,
  describePlacement,
  nextOrderStatus,
} from './staff-academic-inventory-utils';

describe('staff academic inventory helpers', () => {
  it('allows only Heads to open academic inventory', () => {
    expect(canOpenAcademicInventory({ role: 'Head' })).toBe(true);
    expect(canOpenAcademicInventory({ role: 'Supervisor' })).toBe(false);
    expect(canOpenAcademicInventory(undefined)).toBe(false);
  });

  it('builds the attempted PACE range for a diagnostic chart', () => {
    expect(attemptedPaceRange('1001', '1004')).toEqual([1001, 1002, 1003, 1004]);
    expect(attemptedPaceRange(' 1143 ', '1144')).toEqual([1143, 1144]);
    expect(attemptedPaceRange('1005', '1001')).toBeNull();
    expect(attemptedPaceRange('1000', '1005')).toBeNull();
    expect(attemptedPaceRange('1001', '1145')).toBeNull();
    expect(attemptedPaceRange('1001', '')).toBeNull();
    expect(attemptedPaceRange('10a1', '1004')).toBeNull();
  });

  it('describes the derived placement in the printed sheet wording', () => {
    expect(describePlacement({ learningGaps: [1008], performanceLevelPace: 1015 })).toBe(
      'Learning gaps: PACEs # 1008. Advance from PACE # 1015.',
    );
    expect(describePlacement({ learningGaps: [], performanceLevelPace: 1027 })).toBe(
      'Learning gaps: none. Advance from PACE # 1027.',
    );
    expect(describePlacement({ learningGaps: [1008, 1010], performanceLevelPace: null })).toBe(
      'Learning gaps: PACEs # 1008, 1010. Passed every PACE.',
    );
  });

  it('advances order status until delivery', () => {
    expect(nextOrderStatus('Ordered')).toBe('InTransit');
    expect(nextOrderStatus('InTransit')).toBe('Delivered');
    expect(nextOrderStatus('Delivered')).toBeNull();
  });
});
