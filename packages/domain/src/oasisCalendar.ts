export type OasisTermSeason = 'Spring' | 'Summer' | 'Autumn';

export interface OasisTerm {
  from: Date;
  id: `${number}-${OasisTermSeason}`;
  label: `${OasisTermSeason} term`;
  season: OasisTermSeason;
  to: Date;
}

export function isOasisOperatingDay(date: Date): boolean {
  const day = date.getUTCDay();
  return day >= 2 && day <= 5;
}

function utcDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

export function currentOasisTerm(referenceDate: Date = new Date()): OasisTerm {
  if (Number.isNaN(referenceDate.getTime())) {
    throw new Error('referenceDate must be a valid date');
  }

  const year = referenceDate.getUTCFullYear();
  const month = referenceDate.getUTCMonth() + 1;
  if (month >= 9) {
    return {
      season: 'Autumn',
      label: 'Autumn term',
      id: `${year}-Autumn`,
      from: utcDate(year, 9, 1),
      to: utcDate(year + 1, 1, 1),
    };
  }
  if (month >= 4) {
    return {
      season: 'Summer',
      label: 'Summer term',
      id: `${year}-Summer`,
      from: utcDate(year, 4, 1),
      to: utcDate(year, 9, 1),
    };
  }

  return {
    season: 'Spring',
    label: 'Spring term',
    id: `${year}-Spring`,
    from: utcDate(year, 1, 1),
    to: utcDate(year, 4, 1),
  };
}
