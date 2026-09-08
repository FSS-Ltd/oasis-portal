import { describe, expect, it } from 'vitest';
import {
  canonicalSchoolYear,
  academicYearStart,
  createYearGroupBandInput,
  deriveEnglandWalesSchoolYear,
  displaySchoolYearLabel,
  expectedPaceLevelForYear,
  resolveAgeBand,
  schoolYearStorageAliases,
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

describe('academicYearStart', () => {
  it('starts the UK academic year on 1 September in UTC', () => {
    expect(academicYearStart(date('2026-08-31'))).toEqual(date('2025-09-01'));
    expect(academicYearStart(date('2026-09-01'))).toEqual(date('2026-09-01'));
  });
});

describe('displaySchoolYearLabel', () => {
  it('canonicalises legacy year-group abbreviations without changing schema validation', () => {
    expect(canonicalSchoolYear('Y5')).toBe('Year 5');
    expect(canonicalSchoolYear('year5')).toBe('Year 5');
    expect(canonicalSchoolYear('ABC')).toBe('Reception');
    expect(canonicalSchoolYear('Custom')).toBeNull();
    expect(schoolYearStorageAliases('Year 5')).toEqual(['Year 5', 'Y5']);
  });

  it('keeps stored values stable while showing canonical school-year labels', () => {
    expect(displaySchoolYearLabel('Nursery')).toBe('Nursery');
    expect(displaySchoolYearLabel('Reception')).toBe('Reception');
    expect(displaySchoolYearLabel('Y5')).toBe('Year 5');
    expect(displaySchoolYearLabel('Year 1')).toBe('Year 1');
    expect(displaySchoolYearLabel('Year 13')).toBe('Year 13');
    expect(displaySchoolYearLabel('Custom')).toBe('Custom');
  });

  it('maps year groups to expected PACE levels for status comparisons', () => {
    expect(expectedPaceLevelForYear('Nursery')).toBeNull();
    expect(expectedPaceLevelForYear('Reception')).toBe(0);
    expect(expectedPaceLevelForYear('Year 1')).toBe(1);
    expect(expectedPaceLevelForYear('Y5')).toBe(5);
    expect(expectedPaceLevelForYear('Year 13')).toBe(13);
  });
});

describe('resolveAgeBand', () => {
  const bands = [
    {
      id: 'lower',
      name: 'Lower Primary',
      colour: '#5B90C5',
      active: true,
      standardYears: ['Reception', 'Year 1', 'Year 2'],
    },
    {
      id: 'upper',
      name: 'Upper Primary',
      colour: '#0E5C3A',
      active: true,
      standardYears: ['Year 3', 'Year 4'],
    },
  ] as const;

  it('resolves a configured age band from a canonical or legacy school year', () => {
    expect(resolveAgeBand('Y1', bands)).toEqual({
      id: 'lower',
      name: 'Lower Primary',
      colour: '#5B90C5',
    });
  });

  it('returns null when configuration is missing or ambiguous', () => {
    expect(resolveAgeBand('Year 13', bands)).toBeNull();
    expect(
      resolveAgeBand('Year 3', [
        ...bands,
        {
          id: 'duplicate',
          name: 'Duplicate',
          colour: '#FFFFFF',
          active: true,
          standardYears: ['Year 3'],
        },
      ]),
    ).toBeNull();
  });
});

describe('year-group band schemas', () => {
  it('trims names, uppercases colours, and accepts explicit student membership', () => {
    expect(
      createYearGroupBandInput.parse({
        name: ' Lower Primary ',
        studentIds: ['student_a', 'student_b'],
        colour: '#5b90c5',
      }),
    ).toEqual({
      name: 'Lower Primary',
      studentIds: ['student_a', 'student_b'],
      colour: '#5B90C5',
      sortOrder: 0,
    });
  });

  it('rejects empty names, duplicate student selections, invalid colours, and empty updates', () => {
    expect(() =>
      createYearGroupBandInput.parse({
        name: ' ',
        studentIds: [],
        colour: '#5B90C5',
      }),
    ).toThrow();
    expect(() =>
      createYearGroupBandInput.parse({
        name: 'Duplicate',
        studentIds: ['student_a', 'student_a'],
        colour: '#5B90C5',
      }),
    ).toThrow();
    expect(() =>
      createYearGroupBandInput.parse({
        name: 'Bad Colour',
        studentIds: [],
        colour: 'blue',
      }),
    ).toThrow();
    expect(() => updateYearGroupBandInput.parse({ id: 'band_1' })).toThrow();
  });
});
