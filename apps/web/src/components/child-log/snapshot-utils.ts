const shortMonths = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;
const shortWeekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export type RangePreset = 'today' | 'previous-day' | 'previous-week' | 'custom';
export type SnapshotTab = 'overview' | 'behaviour' | 'pace' | 'notes';

export function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function previousDay(): string {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return dateKey(date);
}

export function todayDate(): string {
  return dateKey(new Date());
}

export function previousWeekStart(): string {
  const date = new Date();
  date.setDate(date.getDate() - 6);
  return dateKey(date);
}

export function formatShortDate(value: Date | string | null): string {
  if (!value) return 'Not dated';
  const date = new Date(value);
  return `${shortWeekdays[date.getUTCDay()] ?? ''} ${String(date.getUTCDate()).padStart(2, '0')} ${
    shortMonths[date.getUTCMonth()] ?? ''
  }`;
}

export function formatRange(from: string, to: string, preset: RangePreset): string {
  if (preset === 'today') return `Today — ${formatShortDate(from)}`;
  if (preset === 'previous-day') return `Yesterday — ${formatShortDate(from)}`;
  if (preset === 'previous-week')
    return `Last 7 days — ${formatShortDate(from)}-${formatShortDate(to)}`;
  return `${formatShortDate(from)}-${formatShortDate(to)}`;
}

export function scoreTone(score: number | null): 'amber' | 'blue' | 'green' | 'red' {
  if (score === null) return 'blue';
  if (score >= 90) return 'green';
  if (score >= 80) return 'amber';
  return 'red';
}

export function scoreLabel(score: number): string {
  if (score >= 90) return 'Excellent';
  if (score >= 80) return 'Good';
  if (score >= 70) return 'Satisfactory';
  return 'Needs support';
}
