const LONDON_TIME_ZONE = 'Europe/London';
const MARKET_OPEN_MINUTE = 8 * 60;
const MARKET_CLOSE_MINUTE = 16 * 60 + 30;

function londonDateParts(date: Date): {
  dateKey: string;
  minuteOfDay: number;
  weekday: string;
} {
  const parts = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
    minute: '2-digit',
    month: '2-digit',
    timeZone: LONDON_TIME_ZONE,
    weekday: 'short',
    year: 'numeric',
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? '';
  const hour = Number(value('hour'));
  const minute = Number(value('minute'));

  return {
    dateKey: `${value('year')}-${value('month')}-${value('day')}`,
    minuteOfDay: hour * 60 + minute,
    weekday: value('weekday'),
  };
}

export function isLondonStockMarketOpen(
  date: Date,
  options: { closedDates?: Set<string> } = {},
): boolean {
  const london = londonDateParts(date);
  if (london.weekday === 'Sat' || london.weekday === 'Sun') return false;
  if (options.closedDates?.has(london.dateKey)) return false;
  return london.minuteOfDay >= MARKET_OPEN_MINUTE && london.minuteOfDay < MARKET_CLOSE_MINUTE;
}
