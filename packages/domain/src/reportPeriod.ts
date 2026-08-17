import { z } from 'zod';

const isoDateKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/u);
const termSchema = z.string().regex(/^\d{4}-(Spring|Summer|Autumn)$/u);

export const reportPeriodInputSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('AcademicYear'),
    startYear: z.number().int().min(2000).max(2100),
  }),
  z.object({ type: z.literal('Term'), term: termSchema }),
  z.object({ type: z.literal('Custom'), from: isoDateKeySchema, to: isoDateKeySchema }),
]);

export type ReportPeriodInput = z.infer<typeof reportPeriodInputSchema>;
export type ReportPeriodType = ReportPeriodInput['type'];

export interface ReportPeriodSnapshot {
  type: ReportPeriodType;
  key: string;
  label: string;
  from: string;
  to: string;
}

export interface ResolvedReportPeriod {
  snapshot: ReportPeriodSnapshot;
  queryFrom: Date;
  queryToExclusive: Date;
}

const displayDateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

function dateKey(date: Date): string {
  return [
    String(date.getUTCFullYear()).padStart(4, '0'),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

function parseDateKey(value: string, field: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
  if (!match) throw new Error(`${field} must be a valid ISO date`);

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (dateKey(date) !== value) throw new Error(`${field} must be a valid ISO date`);
  return date;
}

function addUtcDays(date: Date, days: number): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days),
  );
}

function resolvedPeriod(snapshot: ReportPeriodSnapshot): ResolvedReportPeriod {
  const queryFrom = parseDateKey(snapshot.from, 'from');
  const inclusiveTo = parseDateKey(snapshot.to, 'to');
  return {
    snapshot,
    queryFrom,
    queryToExclusive: addUtcDays(inclusiveTo, 1),
  };
}

function formatDate(date: Date): string {
  return displayDateFormatter.format(date);
}

export function resolveReportPeriod(input: ReportPeriodInput): ResolvedReportPeriod {
  if (input.type === 'AcademicYear') {
    const endYear = input.startYear + 1;
    return resolvedPeriod({
      type: input.type,
      key: `${String(input.startYear)}-AcademicYear`,
      label: `${String(input.startYear)}/${String(endYear).slice(-2)} Academic Year`,
      from: `${String(input.startYear)}-09-01`,
      to: `${String(endYear)}-08-31`,
    });
  }

  if (input.type === 'Term') {
    const match = /^(\d{4})-(Spring|Summer|Autumn)$/u.exec(input.term);
    if (!match) throw new Error('term must be a valid Oasis term id');
    const yearValue = match[1];
    const season = match[2];
    if (!yearValue || !season) throw new Error('term must be a valid Oasis term id');
    const year = Number(yearValue);
    const range =
      season === 'Spring'
        ? { from: `${String(year)}-01-01`, to: `${String(year)}-03-31` }
        : season === 'Summer'
          ? { from: `${String(year)}-04-01`, to: `${String(year)}-08-31` }
          : { from: `${String(year)}-09-01`, to: `${String(year)}-12-31` };
    return resolvedPeriod({
      type: input.type,
      key: input.term,
      label: `${season} ${String(year)}`,
      ...range,
    });
  }

  const from = parseDateKey(input.from, 'from');
  const to = parseDateKey(input.to, 'to');
  if (from > to) throw new Error('from must not be after to');
  return resolvedPeriod({
    type: input.type,
    key: `${input.from}_to_${input.to}`,
    label: `${formatDate(from)} - ${formatDate(to)}`,
    from: input.from,
    to: input.to,
  });
}
