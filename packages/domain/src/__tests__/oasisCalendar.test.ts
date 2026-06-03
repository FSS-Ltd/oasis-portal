import { describe, expect, it } from 'vitest';
import { currentOasisTerm, isOasisOperatingDay } from '../oasisCalendar.js';

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

describe('currentOasisTerm', () => {
  it.each([
    ['2026-01-01', 'Spring', 'Spring term', '2026-Spring', '2026-01-01', '2026-04-01'],
    ['2026-03-31', 'Spring', 'Spring term', '2026-Spring', '2026-01-01', '2026-04-01'],
    ['2026-04-01', 'Summer', 'Summer term', '2026-Summer', '2026-04-01', '2026-09-01'],
    ['2026-08-31', 'Summer', 'Summer term', '2026-Summer', '2026-04-01', '2026-09-01'],
    ['2026-09-01', 'Autumn', 'Autumn term', '2026-Autumn', '2026-09-01', '2027-01-01'],
    ['2026-12-31', 'Autumn', 'Autumn term', '2026-Autumn', '2026-09-01', '2027-01-01'],
  ] as const)('maps %s to the %s term', (dateKey, season, label, id, expectedFrom, expectedTo) => {
    const term = currentOasisTerm(new Date(`${dateKey}T00:00:00.000Z`));

    expect(term).toEqual({
      season,
      label,
      id,
      from: new Date(`${expectedFrom}T00:00:00.000Z`),
      to: new Date(`${expectedTo}T00:00:00.000Z`),
    });
  });

  it('rejects invalid reference dates', () => {
    expect(() => currentOasisTerm(new Date('not-a-date'))).toThrow(
      'referenceDate must be a valid date',
    );
  });
});
