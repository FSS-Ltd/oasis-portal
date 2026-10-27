import { describe, expect, it } from 'vitest';

import {
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
