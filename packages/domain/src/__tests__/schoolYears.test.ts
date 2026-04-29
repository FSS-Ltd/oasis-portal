import { describe, expect, it } from 'vitest';
import {
  createYearGroupBandInput,
  deriveEnglandWalesSchoolYear,
  updateYearGroupBandInput,
} from '../schoolYears.js';

function date(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

describe('deriveEnglandWalesSchoolYear', () => {
  const referenceDate = date('2026-04-29');

  it('uses the 31 August cutoff for the active academic year', () => {
    expect(deriveEnglandWalesSchoolYear(date('2014-08-31'), referenceDate)).toBe('Year 7');
    expect(deriveEnglandWalesSchoolYear(date('2014-09-01'), referenceDate)).toBe('Year 6');
  });

  it('moves to the next academic year from 1 September', () => {
    expect(deriveEnglandWalesSchoolYear(date('2014-08-31'), date('2026-08-31'))).toBe('Year 7');
    expect(deriveEnglandWalesSchoolYear(date('2014-08-31'), date('2026-09-01'))).toBe('Year 8');
  });

  it('derives representative standard years', () => {
    expect(deriveEnglandWalesSchoolYear(date('2022-01-15'), referenceDate)).toBe('Nursery');
    expect(deriveEnglandWalesSchoolYear(date('2021-07-20'), referenceDate)).toBe('Reception');
    expect(deriveEnglandWalesSchoolYear(date('2020-03-10'), referenceDate)).toBe('Year 1');
    expect(deriveEnglandWalesSchoolYear(date('2010-08-31'), referenceDate)).toBe('Year 11');
    expect(deriveEnglandWalesSchoolYear(date('2007-09-01'), referenceDate)).toBe('Year 13');
  });

  it('rejects dates outside the configured school-year range', () => {
    expect(() => deriveEnglandWalesSchoolYear(date('2024-01-01'), referenceDate)).toThrow(
      'date of birth does not map',
    );
    expect(() => deriveEnglandWalesSchoolYear(date('2007-08-31'), referenceDate)).toThrow(
      'date of birth does not map',
    );
  });
});

describe('year-group band schemas', () => {
  it('trims names, uppercases colours, and rejects invalid years', () => {
    expect(
      createYearGroupBandInput.parse({
        name: ' Lower Primary ',
        standardYears: ['Reception', 'Year 1'],
        colour: '#5b90c5',
      }),
    ).toEqual({
      name: 'Lower Primary',
      standardYears: ['Reception', 'Year 1'],
      colour: '#5B90C5',
      sortOrder: 0,
    });

    expect(() =>
      createYearGroupBandInput.parse({
        name: 'Invalid',
        standardYears: ['Y5'],
        colour: '#5B90C5',
      }),
    ).toThrow();
  });

  it('rejects empty names, duplicate year selections, invalid colours, and empty updates', () => {
    expect(() =>
      createYearGroupBandInput.parse({
        name: ' ',
        standardYears: ['Year 2'],
        colour: '#5B90C5',
      }),
    ).toThrow();
    expect(() =>
      createYearGroupBandInput.parse({
        name: 'Duplicate',
        standardYears: ['Year 2', 'Year 2'],
        colour: '#5B90C5',
      }),
    ).toThrow();
    expect(() =>
      createYearGroupBandInput.parse({
        name: 'Bad Colour',
        standardYears: ['Year 2'],
        colour: 'blue',
      }),
    ).toThrow();
    expect(() => updateYearGroupBandInput.parse({ id: 'band_1' })).toThrow();
  });
});
