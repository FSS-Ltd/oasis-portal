import { describe, expect, it } from 'vitest';
import { attendanceRate, attendedCount } from '../attendance.js';

describe('attendance helpers', () => {
  it('counts late marks as attended while keeping present as on-time only', () => {
    expect(attendedCount({ present: 2, late: 1 })).toBe(3);
    expect(attendanceRate({ present: 2, late: 1, total: 4 })).toBe(75);
    expect(attendanceRate({ present: 2, late: 1, total: 7 }, { decimalPlaces: 1 })).toBe(42.9);
  });

  it('returns null when no attendance has been recorded', () => {
    expect(attendanceRate({ present: 0, late: 0, total: 0 })).toBeNull();
  });
});
