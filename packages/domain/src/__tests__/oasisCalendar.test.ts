import { describe, expect, it } from 'vitest';
import { isOasisOperatingDay } from '../oasisCalendar.js';

describe('isOasisOperatingDay', () => {
  it.each([
    ['Sunday', '2026-05-03', false],
    ['Monday', '2026-05-04', false],
    ['Tuesday', '2026-05-05', true],
    ['Wednesday', '2026-05-06', true],
    ['Thursday', '2026-05-07', true],
    ['Friday', '2026-05-08', true],
    ['Saturday', '2026-05-09', false],
  ] as const)('returns %s operating status', (_label, dateKey, expected) => {
    expect(isOasisOperatingDay(new Date(`${dateKey}T00:00:00.000Z`))).toBe(expected);
  });
});
