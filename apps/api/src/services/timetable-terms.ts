const TERM_EVENT_ID = /^calendar-(\d{4})-(\d{2})-term-([1-6])-(start|end)$/;

interface CalendarBoundaryRow {
  id: string;
  startDate: Date;
}

export interface TimetableTermDb {
  calendarEvent: {
    findMany(input: {
      orderBy: { startDate: 'asc' };
      select: { id: true; startDate: true };
      where: { active: true; category: 'OasisDays'; id: { startsWith: 'calendar-' } };
    }): Promise<CalendarBoundaryRow[]>;
  };
}

export interface TeachingTerm {
  key: string;
  academicYearLabel: string;
  number: number;
  label: string;
  startsOn: Date;
  endsOn: Date;
}

interface PartialTeachingTerm {
  academicYearLabel: string;
  endsOn?: Date;
  key: string;
  number: number;
  startsOn?: Date;
}

export class IncompleteTeachingTermError extends Error {
  constructor(termKey: string) {
    super(`Term dates are incomplete for ${termKey}`);
    this.name = 'IncompleteTeachingTermError';
  }
}

export class TeachingTermNotFoundError extends Error {
  constructor(termKey: string) {
    super(`Teaching term not found: ${termKey}`);
    this.name = 'TeachingTermNotFoundError';
  }
}

function utcDay(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

async function loadTermParts(db: TimetableTermDb): Promise<Map<string, PartialTeachingTerm>> {
  const events = await db.calendarEvent.findMany({
    where: { active: true, category: 'OasisDays', id: { startsWith: 'calendar-' } },
    select: { id: true, startDate: true },
    orderBy: { startDate: 'asc' },
  });
  const parts = new Map<string, PartialTeachingTerm>();

  for (const event of events) {
    const match = TERM_EVENT_ID.exec(event.id);
    if (!match) continue;

    const [, startYear, endYear, numberText, boundary] = match;
    if (!startYear || !endYear || !numberText || !boundary) continue;
    const number = Number(numberText);
    const key = `${startYear}-${endYear}-term-${numberText}`;
    const current = parts.get(key) ?? {
      key,
      academicYearLabel: `${startYear}/${endYear}`,
      number,
    };
    if (boundary === 'start') current.startsOn = utcDay(event.startDate);
    else current.endsOn = utcDay(event.startDate);
    parts.set(key, current);
  }

  return parts;
}

function completeTerm(part: PartialTeachingTerm): TeachingTerm | null {
  if (!part.startsOn || !part.endsOn) return null;
  return {
    key: part.key,
    academicYearLabel: part.academicYearLabel,
    number: part.number,
    label: `Term ${String(part.number)}`,
    startsOn: part.startsOn,
    endsOn: part.endsOn,
  };
}

export async function loadTeachingTerms(db: TimetableTermDb): Promise<TeachingTerm[]> {
  const parts = await loadTermParts(db);
  return [...parts.values()]
    .map(completeTerm)
    .filter((term): term is TeachingTerm => term !== null)
    .sort(
      (left, right) =>
        left.startsOn.getTime() - right.startsOn.getTime() || left.number - right.number,
    );
}

export async function requireTeachingTerm(
  db: TimetableTermDb,
  termKey: string,
): Promise<TeachingTerm> {
  const parts = await loadTermParts(db);
  const part = parts.get(termKey);
  if (!part) throw new TeachingTermNotFoundError(termKey);
  const term = completeTerm(part);
  if (!term) throw new IncompleteTeachingTermError(termKey);
  return term;
}
