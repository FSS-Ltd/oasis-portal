export type OasisTermSeason = 'Spring' | 'Summer' | 'Autumn';
export type OasisTermId = `${string}-${OasisTermSeason}`;
export type OasisAcademicPeriodKind = 'term' | 'halfTerm' | 'holiday';

export interface OasisTerm {
  from: Date;
  id: OasisTermId;
  label: `${OasisTermSeason} term`;
  season: OasisTermSeason;
  to: Date;
}

export interface OasisAcademicPeriod {
  from: Date;
  kind: OasisAcademicPeriodKind;
  label: string;
  term: OasisTerm | null;
  to: Date;
}

interface TermDates {
  endsOn: string;
  halfTermEndsOn: string;
  halfTermStartsOn: string;
  season: OasisTermSeason;
  startsOn: string;
}

/**
 * Published dates used by the Oasis calendar seed. These drive operational
 * workflows throughout the portal; the 2026–27 dates are Oasis's supplied
 * academic calendar.
 */
const PUBLISHED_TERM_DATES: readonly TermDates[] = [
  {
    season: 'Autumn',
    startsOn: '2025-09-01',
    halfTermStartsOn: '2025-10-27',
    halfTermEndsOn: '2025-10-31',
    endsOn: '2025-12-19',
  },
  {
    season: 'Spring',
    startsOn: '2026-01-05',
    halfTermStartsOn: '2026-02-16',
    halfTermEndsOn: '2026-02-20',
    endsOn: '2026-03-27',
  },
  {
    season: 'Summer',
    startsOn: '2026-04-13',
    halfTermStartsOn: '2026-05-25',
    halfTermEndsOn: '2026-05-29',
    endsOn: '2026-07-20',
  },
  {
    season: 'Autumn',
    startsOn: '2026-09-08',
    halfTermStartsOn: '2026-10-17',
    halfTermEndsOn: '2026-11-02',
    endsOn: '2026-12-18',
  },
  {
    season: 'Spring',
    startsOn: '2027-01-05',
    halfTermStartsOn: '2027-02-13',
    halfTermEndsOn: '2027-02-22',
    endsOn: '2027-03-25',
  },
  {
    season: 'Summer',
    startsOn: '2027-04-13',
    halfTermStartsOn: '2027-05-29',
    halfTermEndsOn: '2027-06-07',
    endsOn: '2027-07-23',
  },
  {
    season: 'Autumn',
    startsOn: '2027-09-02',
    halfTermStartsOn: '2027-10-25',
    halfTermEndsOn: '2027-10-29',
    endsOn: '2027-12-17',
  },
  {
    season: 'Spring',
    startsOn: '2028-01-04',
    halfTermStartsOn: '2028-02-14',
    halfTermEndsOn: '2028-02-18',
    endsOn: '2028-04-07',
  },
  {
    season: 'Summer',
    startsOn: '2028-04-24',
    halfTermStartsOn: '2028-05-29',
    halfTermEndsOn: '2028-06-02',
    endsOn: '2028-07-21',
  },
];

function utcDate(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00.000Z`);
}

function addUtcDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function termForDates(dates: TermDates): OasisTerm {
  const year = utcDate(dates.startsOn).getUTCFullYear();
  return {
    season: dates.season,
    label: `${dates.season} term`,
    id: `${String(year)}-${dates.season}`,
    from: utcDate(dates.startsOn),
    to: addUtcDays(utcDate(dates.endsOn), 1),
  };
}

/** Returns every published Oasis term in chronological order. */
export function publishedOasisTerms(): OasisTerm[] {
  return PUBLISHED_TERM_DATES.map(termForDates);
}

function assertValidDate(referenceDate: Date): void {
  if (Number.isNaN(referenceDate.getTime())) throw new Error('referenceDate must be a valid date');
}

function isWithin(date: Date, from: Date, to: Date): boolean {
  return date.getTime() >= from.getTime() && date.getTime() < to.getTime();
}

function holidayLabel(nextTerm: TermDates): string {
  if (nextTerm.season === 'Spring') return 'Christmas holiday';
  if (nextTerm.season === 'Summer') return 'Easter holiday';
  return 'Summer holiday';
}

/** Returns the published term containing the date, or the latest completed term. */
export function currentOasisTerm(referenceDate: Date = new Date()): OasisTerm {
  assertValidDate(referenceDate);
  const date = startOfUtcDay(referenceDate);
  const terms = publishedOasisTerms();
  const containingTerm = terms.find((term) => isWithin(date, term.from, term.to));
  if (containingTerm) return containingTerm;

  const nextTermIndex = terms.findIndex((term) => term.from.getTime() > date.getTime());
  if (nextTermIndex > 0) return terms[nextTermIndex - 1] as OasisTerm;
  if (nextTermIndex === 0) return terms[0] as OasisTerm;
  return terms.at(-1) as OasisTerm;
}

/** Returns the first published term that has not started yet. */
export function nextOasisTerm(referenceDate: Date = new Date()): OasisTerm | null {
  assertValidDate(referenceDate);
  const date = startOfUtcDay(referenceDate);
  return publishedOasisTerms().find((term) => term.from.getTime() > date.getTime()) ?? null;
}

/** Resolves the current term, half-term, or holiday from the published timetable. */
export function currentOasisAcademicPeriod(
  referenceDate: Date = new Date(),
): OasisAcademicPeriod | null {
  assertValidDate(referenceDate);
  const date = startOfUtcDay(referenceDate);

  for (let index = 0; index < PUBLISHED_TERM_DATES.length; index += 1) {
    const dates = PUBLISHED_TERM_DATES[index] as TermDates;
    const term = termForDates(dates);
    const halfTermFrom = utcDate(dates.halfTermStartsOn);
    const halfTermTo = addUtcDays(utcDate(dates.halfTermEndsOn), 1);
    if (!isWithin(date, term.from, term.to)) continue;
    if (isWithin(date, halfTermFrom, halfTermTo)) {
      return { from: halfTermFrom, to: halfTermTo, kind: 'halfTerm', label: 'Half term', term };
    }
    if (date.getTime() < halfTermFrom.getTime()) {
      return {
        from: term.from,
        to: halfTermFrom,
        kind: 'term',
        label: `${term.season} term 1`,
        term,
      };
    }
    return { from: halfTermTo, to: term.to, kind: 'term', label: `${term.season} term 2`, term };
  }

  for (let index = 1; index < PUBLISHED_TERM_DATES.length; index += 1) {
    const previousTerm = termForDates(PUBLISHED_TERM_DATES[index - 1] as TermDates);
    const nextDates = PUBLISHED_TERM_DATES[index] as TermDates;
    const nextTerm = termForDates(nextDates);
    if (isWithin(date, previousTerm.to, nextTerm.from)) {
      return {
        from: previousTerm.to,
        to: nextTerm.from,
        kind: 'holiday',
        label: holidayLabel(nextDates),
        term: previousTerm,
      };
    }
  }

  return null;
}

export function isOasisOperatingDay(date: Date): boolean {
  assertValidDate(date);
  const period = currentOasisAcademicPeriod(date);
  if (period?.kind !== 'term') return false;
  const day = date.getUTCDay();
  return day >= 2 && day <= 5;
}

export function oasisReportTermOptions(referenceDate: Date = new Date()): OasisTermId[] {
  assertValidDate(referenceDate);
  const year = referenceDate.getUTCFullYear();
  return [`${String(year)}-Spring`, `${String(year)}-Summer`, `${String(year)}-Autumn`];
}
