import type { CSSProperties } from 'react';
import type { RouterOutputs } from '@/lib/trpc';
import { fromTimeValue, todayKey, toTimeValue } from './club-schedule-utils';
import {
  CLUB_ICON_OPTIONS,
  isClubAccentColor,
  randomClubAccent,
  type ClubAccentColor,
  type ClubIconKey,
} from './club-visuals';

export type Club = RouterOutputs['club']['managementList'][number];
export type ClubYearGroupBand = RouterOutputs['club']['yearGroupBands'][number];
export type ClubNotification = RouterOutputs['club']['notifications'][number];
export type RosterSignup = RouterOutputs['club']['roster']['signups'][number];
export type ClubTab = 'attendance' | 'students' | 'leads' | 'notices';

export interface ClubFormState {
  name: string;
  description: string;
  scheduleDate: string;
  scheduleStartTime: string;
  scheduleEndTime: string;
  capacity: string;
  iconKey: ClubIconKey;
  accentColor: ClubAccentColor;
  yearGroupBandIds: string[];
}

interface ClubFormPayload {
  name: string;
  description: string | null;
  schedule: {
    startDate: Date;
    startMinute: number;
    endMinute: number;
    frequency: 'Weekly';
  };
  capacity: number | null;
  iconKey: ClubIconKey;
  accentColor: ClubAccentColor;
  yearGroupBandIds: string[];
}

export interface NotificationFormState {
  title: string;
  body: string;
}

export const clubTabs = [
  ['attendance', 'Attendance'],
  ['students', 'Students'],
  ['leads', 'Club Lead'],
  ['notices', 'Notices'],
] as const satisfies readonly [ClubTab, string][];

export function accentStyle(value: string): CSSProperties {
  return { '--accent': value } as CSSProperties;
}

export function clubAccentValueStyle(value: string): CSSProperties {
  return { '--club-accent': value } as CSSProperties;
}

export function emptyClubForm(): ClubFormState {
  return {
    name: '',
    description: '',
    scheduleDate: todayKey(),
    scheduleStartTime: '15:30',
    scheduleEndTime: '16:30',
    capacity: '',
    iconKey: 'drama',
    accentColor: randomClubAccent(),
    yearGroupBandIds: [],
  };
}

export function emptyNotificationForm(): NotificationFormState {
  return { title: '', body: '' };
}

export function formFromClub(club: Club): ClubFormState {
  return {
    name: club.name,
    description: club.description ?? '',
    scheduleDate: club.schedule?.startDate ?? todayKey(),
    scheduleStartTime: club.schedule ? toTimeValue(club.schedule.startMinute) : '15:30',
    scheduleEndTime: club.schedule ? toTimeValue(club.schedule.endMinute) : '16:30',
    capacity: club.capacity === null ? '' : String(club.capacity),
    iconKey: CLUB_ICON_OPTIONS.find((option) => option.key === club.iconKey)?.key ?? 'drama',
    accentColor: isClubAccentColor(club.accentColor) ? club.accentColor : randomClubAccent(),
    yearGroupBandIds: club.yearGroupBands.map((band) => band.id),
  };
}

function normaliseOptionalText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function buildClubPayload(form: ClubFormState): ClubFormPayload | string {
  const name = form.name.trim();
  if (!name) return 'Club name is required.';

  const capacityValue = form.capacity.trim();
  const capacity = capacityValue ? Number(capacityValue) : null;
  if (
    capacity !== null &&
    (!Number.isInteger(capacity) || capacity <= 0 || !Number.isSafeInteger(capacity))
  ) {
    return 'Capacity must be a positive whole number.';
  }
  if (!form.scheduleDate) return 'First club date is required.';
  if (form.yearGroupBandIds.length === 0) return 'Select at least one year group.';

  const startMinute = fromTimeValue(form.scheduleStartTime);
  const endMinute = fromTimeValue(form.scheduleEndTime);
  if (startMinute >= endMinute) return 'Start time must be before end time.';

  return {
    name,
    description: normaliseOptionalText(form.description),
    schedule: {
      startDate: new Date(`${form.scheduleDate}T00:00:00.000Z`),
      startMinute,
      endMinute,
      frequency: 'Weekly',
    },
    capacity,
    iconKey: form.iconKey,
    accentColor: form.accentColor,
    yearGroupBandIds: form.yearGroupBandIds,
  };
}

export function buildNotificationPayload(
  club: Club,
  form: NotificationFormState,
): { body: string; clubId: string; title: string } | string {
  if (!club.active) return 'Reactivate this club before posting notices.';

  const title = form.title.trim();
  if (!title) return 'Notice title is required.';

  const body = form.body.trim();
  if (!body) return 'Notice message is required.';

  return { clubId: club.id, title, body };
}

export function notificationStatusText({
  failedCount,
  recipientCount,
  sentCount,
  skippedOptOutCount,
}: {
  failedCount: number;
  recipientCount: number;
  sentCount: number;
  skippedOptOutCount: number;
}): string {
  if (recipientCount === 0) return 'Notice saved. No active signup guardians were found.';
  const optedOutText =
    skippedOptOutCount > 0
      ? ` ${String(skippedOptOutCount)} opted out of email notifications.`
      : '';
  if (failedCount > 0) {
    return `Notice saved. ${String(sentCount)} sent, ${String(failedCount)} failed.${optedOutText}`;
  }
  return `Notice posted to ${String(sentCount)} guardian${sentCount === 1 ? '' : 's'}.${optedOutText}`;
}

export function capacityText(club: Club): string {
  if (club.capacity === null) return `${String(club.activeSignupCount)} members`;
  return `${String(club.activeSignupCount)} / ${String(club.capacity)} members`;
}

export function capacityPercent(club: Club): number {
  if (club.capacity === null || club.capacity <= 0) return 0;
  return Math.min(100, Math.round((club.activeSignupCount / club.capacity) * 100));
}

export function formatDateTime(value: Date | string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}
