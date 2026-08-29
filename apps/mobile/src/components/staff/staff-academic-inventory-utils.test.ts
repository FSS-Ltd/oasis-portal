import { describe, expect, it } from 'vitest';

import {
  canOpenAcademicInventory,
  diagnosticPlacementLabel,
  nextOrderStatus,
} from './staff-academic-inventory-utils';

describe('staff academic inventory helpers', () => {
  it('allows only Heads to open academic inventory', () => {
    expect(canOpenAcademicInventory({ role: 'Head' })).toBe(true);
    expect(canOpenAcademicInventory({ role: 'Supervisor' })).toBe(false);
    expect(canOpenAcademicInventory(undefined)).toBe(false);
  });

  it('formats diagnostic placement labels', () => {
    expect(diagnosticPlacementLabel(2)).toBe('Level 2 starts at PACE #1013');
  });

  it('advances order status until delivery', () => {
    expect(nextOrderStatus('Ordered')).toBe('InTransit');
    expect(nextOrderStatus('InTransit')).toBe('Delivered');
    expect(nextOrderStatus('Delivered')).toBeNull();
  });
});
