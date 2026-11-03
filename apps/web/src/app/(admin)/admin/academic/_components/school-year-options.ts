import {
  STANDARD_SCHOOL_YEARS,
  displaySchoolYearLabel,
  type StandardSchoolYear,
} from '@oasis/domain';

export const standardSchoolYearOptions = STANDARD_SCHOOL_YEARS.map((year) => ({
  year,
  label: displaySchoolYearLabel(year),
}));

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
  return displaySchoolYearLabel(year);
}

export function formatSchoolYearList(years: readonly string[]): string {
  return years.map((year) => formatSchoolYearLabel(year)).join(', ');
}
