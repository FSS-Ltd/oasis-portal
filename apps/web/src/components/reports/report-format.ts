import type { RouterOutputs } from '@/lib/trpc';

export type TermReport = RouterOutputs['report']['listForStudent']['reports'][number];
export type TermReportStatus = TermReport['status'];
type BadgeTone = 'amber' | 'blue' | 'green' | 'grey' | 'red';

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const numberFormatter = new Intl.NumberFormat('en-GB');

export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return 'Not set';
  return dateFormatter.format(new Date(value));
}

export function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

export function formatSignedNumber(value: number): string {
  if (value === 0) return '0';
  return `${value > 0 ? '+' : ''}${formatNumber(value)}`;
}

export function reportCountLabel(count: number): string {
  return count === 1 ? '1 report' : `${formatNumber(count)} reports`;
}

export function reportStatusLabel(status: TermReportStatus): string {
  switch (status) {
    case 'Draft':
      return 'Draft';
    case 'UnderReview':
      return 'Reviewed';
    case 'Sent':
      return 'Sent';
  }
}

export function reportStatusTone(status: TermReportStatus): BadgeTone {
  switch (status) {
    case 'Draft':
      return 'amber';
    case 'UnderReview':
      return 'blue';
    case 'Sent':
      return 'green';
  }
}
