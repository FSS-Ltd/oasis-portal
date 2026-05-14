import type { RouterOutputs } from '@/lib/trpc';

export type PaceRosterStudent = RouterOutputs['pace']['roster']['students'][number];
export type PaceSubject = RouterOutputs['pace']['forStudent']['subjects'][number];
export type PaceTestType = 'SelfTest' | 'FinalTest';

export function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function asDate(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

export function dateInputValue(value: Date | string | null | undefined): string {
  if (!value) return todayKey();
  return new Date(value).toISOString().slice(0, 10);
}

export function formatShortDate(value: Date | string | null): string {
  if (!value) return 'No date recorded';
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
  }).format(new Date(value));
}

export function formatScore(value: number | null | undefined): string {
  return value === null || value === undefined ? '-' : `${String(value)}%`;
}

export function scoreTone(
  score: number | null | undefined,
): 'danger' | 'muted' | 'success' | 'warning' {
  if (score === null || score === undefined) return 'muted';
  if (score >= 90) return 'success';
  if (score >= 75) return 'warning';
  return 'danger';
}

export function scoreLabel(score: number | null): string {
  if (score === null) return '-';
  if (score >= 90) return 'Excellent';
  if (score >= 80) return 'Good';
  if (score >= 70) return 'Satisfactory';
  if (score >= 60) return 'Needs support';
  return 'Below threshold';
}

export function statusTone(tone: string): 'amber' | 'blue' | 'green' | 'grey' | 'red' {
  if (tone === 'green') return 'green';
  if (tone === 'amber') return 'amber';
  if (tone === 'grey') return 'grey';
  if (tone === 'red') return 'red';
  return 'blue';
}
