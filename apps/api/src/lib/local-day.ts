export const CENTRE_TIME_ZONE = 'Europe/London';

interface LocalDateParts {
  day: number;
  month: number;
  year: number;
}

const datePartFormatters = new Map<string, Intl.DateTimeFormat>();
const dateTimePartFormatters = new Map<string, Intl.DateTimeFormat>();

function dateFormatter(timeZone: string): Intl.DateTimeFormat {
  const existing = datePartFormatters.get(timeZone);
  if (existing) return existing;
  const formatter = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    timeZone,
    year: 'numeric',
  });
  datePartFormatters.set(timeZone, formatter);
  return formatter;
}

function dateTimeFormatter(timeZone: string): Intl.DateTimeFormat {
  const existing = dateTimePartFormatters.get(timeZone);
  if (existing) return existing;
  const formatter = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
    minute: '2-digit',
    month: '2-digit',
    second: '2-digit',
    timeZone,
    year: 'numeric',
  });
  dateTimePartFormatters.set(timeZone, formatter);
  return formatter;
}

function partValue(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): number {
  const value = parts.find((part) => part.type === type)?.value;
  return value ? Number(value) : 0;
}

function localDateParts(date: Date, timeZone: string): LocalDateParts {
  const parts = dateFormatter(timeZone).formatToParts(date);
  return {
    day: partValue(parts, 'day'),
    month: partValue(parts, 'month'),
    year: partValue(parts, 'year'),
  };
}

function timeZoneOffsetMs(date: Date, timeZone: string): number {
  const parts = dateTimeFormatter(timeZone).formatToParts(date);
  const asUtc = Date.UTC(
    partValue(parts, 'year'),
    partValue(parts, 'month') - 1,
    partValue(parts, 'day'),
    partValue(parts, 'hour'),
    partValue(parts, 'minute'),
    partValue(parts, 'second'),
  );
  return asUtc - date.getTime();
}

function localDayStartUtc(parts: LocalDateParts, timeZone: string): Date {
  const localMidnightAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day);
  let start = localMidnightAsUtc - timeZoneOffsetMs(new Date(localMidnightAsUtc), timeZone);
  start = localMidnightAsUtc - timeZoneOffsetMs(new Date(start), timeZone);
  return new Date(start);
}

export function localDateKey(date: Date, timeZone = CENTRE_TIME_ZONE): string {
  const parts = localDateParts(date, timeZone);
  return `${String(parts.year)}-${String(parts.month).padStart(2, '0')}-${String(
    parts.day,
  ).padStart(2, '0')}`;
}

export function localDayBounds(
  date: Date,
  timeZone = CENTRE_TIME_ZONE,
): { from: Date; key: string; to: Date } {
  const parts = localDateParts(date, timeZone);
  const nextLocalNoon = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + 1, 12));
  const nextParts = localDateParts(nextLocalNoon, timeZone);

  return {
    from: localDayStartUtc(parts, timeZone),
    key: localDateKey(date, timeZone),
    to: localDayStartUtc(nextParts, timeZone),
  };
}
