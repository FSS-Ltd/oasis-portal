import { type RouterInputs, type RouterOutputs } from '../../lib/trpc';

export type StaffClubManagerTab = 'overview' | 'roster' | 'attendance' | 'notices' | 'rota';
export type StaffManagedClub = RouterOutputs['club']['managementList'][number];
export type StaffClubRosterRow = RouterOutputs['club']['roster']['signups'][number];
export type StaffClubAttendanceRow =
  RouterOutputs['club']['attendanceForSession']['students'][number];
export type StaffClubAttendanceStatus = NonNullable<StaffClubAttendanceRow['status']>;
export type StaffClubNotification = RouterOutputs['club']['notifications'][number];
export type StaffClubRotaShift = RouterOutputs['club']['clubRotaSchedule'][number];
export type StaffClubNoticeDraft = Pick<RouterInputs['club']['notify'], 'body' | 'title'>;

export const clubManagerTabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'roster', label: 'Roster' },
  { id: 'attendance', label: 'Attendance' },
  { id: 'notices', label: 'Notices' },
  { id: 'rota', label: 'Rota' },
] as const satisfies readonly { id: StaffClubManagerTab; label: string }[];

export const clubAttendanceStatuses = [
  'Present',
  'Late',
  'Absent',
] as const satisfies readonly StaffClubAttendanceStatus[];

const schoolTimeZone = 'Europe/London';

export function dateKeyInSchoolTimeZone(value: Date): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    timeZone: schoolTimeZone,
    year: 'numeric',
  }).formatToParts(value);
  const day = parts.find((part) => part.type === 'day')?.value ?? '01';
  const month = parts.find((part) => part.type === 'month')?.value ?? '01';
  const year = parts.find((part) => part.type === 'year')?.value ?? '1970';
  return `${year}-${month}-${day}`;
}

export function dateFromKey(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export function addDays(value: string, days: number): string {
  const date = dateFromKey(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function weekStartKey(value: Date): string {
  const date = dateFromKey(dateKeyInSchoolTimeZone(value));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - day + 1);
  return date.toISOString().slice(0, 10);
}

export function formatClubDate(value: string): string {
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'full', timeZone: 'UTC' }).format(
    dateFromKey(value),
  );
}

export function formatClubDateTime(value: string | Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: schoolTimeZone,
  }).format(new Date(value));
}

export function formatTime(value: string | Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: schoolTimeZone,
  }).format(new Date(value));
}

export function formatYearGroup(value: string): string {
  return value.startsWith('Year ') ? value : `Year ${value}`;
}

export function capacityLabel(club: StaffManagedClub): string {
  if (club.capacity === null) return `${String(club.activeSignupCount)} members`;
  return `${String(club.activeSignupCount)} / ${String(club.capacity)} members`;
}

export function leadLabel(club: StaffManagedClub): string {
  if (club.assignedLeads.length === 0) return 'No lead assigned';
  if (club.assignedLeads.length === 1) return club.assignedLeads[0]?.fullName ?? '1 lead';
  return `${String(club.assignedLeads.length)} leads`;
}

export function validateNoticeDraft(draft: StaffClubNoticeDraft): string | null {
  if (!draft.title.trim()) return 'Add a notice title.';
  if (!draft.body.trim()) return 'Add the notice body.';
  return null;
}

export function attendanceCounts(rows: readonly StaffClubAttendanceRow[]): {
  absent: number;
  late: number;
  present: number;
  unmarked: number;
} {
  return rows.reduce(
    (totals, row) => {
      if (row.status === 'Absent') totals.absent += 1;
      else if (row.status === 'Late') totals.late += 1;
      else if (row.status === 'Present') totals.present += 1;
      else totals.unmarked += 1;
      return totals;
    },
    { absent: 0, late: 0, present: 0, unmarked: 0 },
  );
}
