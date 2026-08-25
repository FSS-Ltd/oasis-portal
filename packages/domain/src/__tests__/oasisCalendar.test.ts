import { describe, expect, it } from 'vitest';
import {
  currentOasisAcademicPeriod,
  currentOasisTerm,
  isOasisOperatingDay,
  oasisReportTermOptions,
} from '../oasisCalendar.js';

describe('isOasisOperatingDay', () => {
  it.each([
    ['Sunday', '2026-05-03', false],
    ['Monday', '2026-05-04', false],
    ['Tuesday', '2026-05-05', true],
    ['Wednesday', '2026-05-06', true],
    ['Thursday', '2026-05-07', true],
    ['Friday', '2026-05-08', true],
    ['Saturday', '2026-05-09', false],
    ['May half term', '2026-05-26', false],
    ['Summer holiday', '2026-08-25', false],
  ] as const)('returns %s operating status', (_label, dateKey, expected) => {
    expect(isOasisOperatingDay(new Date(`${dateKey}T00:00:00.000Z`))).toBe(expected);
  });
});

describe('currentOasisTerm', () => {
  it.each([
    ['2026-01-01', 'Autumn', 'Autumn term', '2025-Autumn', '2025-09-01', '2025-12-20'],
    ['2026-03-27', 'Spring', 'Spring term', '2026-Spring', '2026-01-05', '2026-03-28'],
    ['2026-04-13', 'Summer', 'Summer term', '2026-Summer', '2026-04-13', '2026-07-21'],
    ['2026-08-31', 'Summer', 'Summer term', '2026-Summer', '2026-04-13', '2026-07-21'],
    ['2026-09-01', 'Autumn', 'Autumn term', '2026-Autumn', '2026-09-01', '2026-12-19'],
    ['2026-12-31', 'Autumn', 'Autumn term', '2026-Autumn', '2026-09-01', '2026-12-19'],
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

  it.each([
    ['2026-05-22', 'term', 'Summer term 1', '2026-04-13', '2026-05-25'],
    ['2026-05-25', 'halfTerm', 'Half term', '2026-05-25', '2026-05-30'],
    ['2026-06-02', 'term', 'Summer term 2', '2026-05-30', '2026-07-21'],
    ['2026-08-25', 'holiday', 'Summer holiday', '2026-07-21', '2026-09-01'],
    ['2026-12-21', 'holiday', 'Christmas holiday', '2026-12-19', '2027-01-04'],
  ] as const)('resolves %s as the current academic period', (dateKey, kind, label, from, to) => {
    expect(currentOasisAcademicPeriod(new Date(`${dateKey}T00:00:00.000Z`))).toMatchObject({
      kind,
      label,
      from: new Date(`${from}T00:00:00.000Z`),
      to: new Date(`${to}T00:00:00.000Z`),
    });
  });

  it('uses the current calendar year for report term choices', () => {
    expect(oasisReportTermOptions(new Date('2027-02-01T00:00:00.000Z'))).toEqual([
      '2027-Spring',
      '2027-Summer',
      '2027-Autumn',
    ]);
  });

  it('rejects invalid reference dates', () => {
    expect(() => currentOasisTerm(new Date('not-a-date'))).toThrow(
      'referenceDate must be a valid date',
    );
  });
});
