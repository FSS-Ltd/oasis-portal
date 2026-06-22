import type { RouterOutputs } from '../../lib/trpc';

export type StudentNotification = RouterOutputs['studentNotification']['list'][number];

const updateDateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  month: 'short',
  year: 'numeric',
});

export const studentNotificationAccessBlockedCopy = [
  'Student portal locked',
  'Off-limit day',
  'Usage limit reached',
] as const;

export function formatStudentNotificationDate(value: Date | string): string {
  return updateDateFormatter.format(new Date(value));
}

export function studentNotificationKindLabel(kind: StudentNotification['kind']): string {
  if (kind === 'MeritAward') return 'Merits';
  if (kind === 'ShopPurchase') return 'Shop';
  if (kind === 'ClubNotice') return 'Club';
  return 'Announcement';
}
