import type { StandardSchoolYear } from '@oasis/domain';

export const standardSchoolYearOptions = [
  { year: 'Nursery', label: 'Nursery' },
  { year: 'Reception', label: 'ABC' },
  { year: 'Year 1', label: 'Level 1' },
  { year: 'Year 2', label: 'Level 2' },
  { year: 'Year 3', label: 'Level 3' },
  { year: 'Year 4', label: 'Level 4' },
  { year: 'Year 5', label: 'Level 5' },
  { year: 'Year 6', label: 'Level 6' },
  { year: 'Year 7', label: 'Level 7' },
  { year: 'Year 8', label: 'Level 8' },
  { year: 'Year 9', label: 'Level 9' },
  { year: 'Year 10', label: 'Level 10' },
  { year: 'Year 11', label: 'Level 11' },
  { year: 'Year 12', label: 'Level 12' },
  { year: 'Year 13', label: 'Level 13' },
] as const satisfies ReadonlyArray<{ year: StandardSchoolYear; label: string }>;

const standardSchoolYearLabels = new Map<string, string>(
  standardSchoolYearOptions.map(({ label, year }) => [year, label]),
);

const standardSchoolYearSet: ReadonlySet<string> = new Set(
  standardSchoolYearOptions.map(({ year }) => year),
);

export function isStandardSchoolYear(year: string): year is StandardSchoolYear {
  return standardSchoolYearSet.has(year);
}

export function standardSchoolYearsFrom(years: readonly string[]): StandardSchoolYear[] {
  return years.filter(isStandardSchoolYear);
}

export function formatSchoolYearLabel(year: string): string {
  return standardSchoolYearLabels.get(year) ?? year;
}

export function formatSchoolYearList(years: readonly string[]): string {
  return years.map((year) => formatSchoolYearLabel(year)).join(', ');
}
