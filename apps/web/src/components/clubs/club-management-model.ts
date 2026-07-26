import type { CSSProperties } from 'react';
import { fromTimeValue, todayKey, toTimeValue } from './club-schedule-utils';
import {
  CLUB_ICON_OPTIONS,
  isClubAccentColor,
  randomClubAccent,
  type ClubAccentColor,
  type ClubIconKey,
} from './club-visuals';

interface ClubSchedule {
  endMinute: number;
  frequency: 'Weekly';
  startDate: string;
  startMinute: number;
}

export interface Club {
  active: boolean;
  activeSignupCount: number;
  accentColor: string | null;
  assignedLeads: {
    active: boolean;
    email: string;
    fullName: string;
    id: string;
  }[];
  capacity: number | null;
  createdAt: Date | string;
  createdById: string;
  description: string | null;
  iconKey: string | null;
  id: string;
  legacySchedule: string | null;
  name: string;
  schedule: ClubSchedule | null;
  scheduleLabel: string | null;
  signedUpStudentIds: string[];
  updatedAt: Date | string;
}

export interface ClubNotification {
  clubId: string;
  id: string;
  sentAt: Date | string;
  sentByName: string;
  title: string;
}

export interface RosterSignup {
  id: string;
  signedUpAt: Date | string;
  studentId: string;
  studentName: string;
  yearGroup: string;
}

export type ClubTab = 'attendance' | 'students' | 'leads' | 'rota' | 'notices';

export interface ClubFormState {
  name: string;
  description: string;
  scheduleDate: string;
  scheduleStartTime: string;
  scheduleEndTime: string;
  capacity: string;
  iconKey: ClubIconKey;
  accentColor: ClubAccentColor;
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
}

export interface NotificationFormState {
  title: string;
  body: string;
}

export const clubTabs = [
  ['attendance', 'Attendance'],
  ['students', 'Students'],
  ['leads', 'Club Lead'],
  ['rota', 'Rota'],
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
}: {
  failedCount: number;
  recipientCount: number;
  sentCount: number;
}): string {
  if (recipientCount === 0) return 'Notice saved. No active signup guardians were found.';
  if (failedCount > 0) {
    return `Notice saved. ${String(sentCount)} sent, ${String(failedCount)} failed.`;
  }
  return `Notice posted to ${String(sentCount)} guardian${sentCount === 1 ? '' : 's'}.`;
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
