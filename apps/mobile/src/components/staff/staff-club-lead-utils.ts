import { type RouterInputs, type RouterOutputs } from '../../lib/trpc';

export type StaffClubLeadTab = 'overview' | 'behaviour' | 'attendance' | 'noticeboard';
export type StaffLeadClub = RouterOutputs['club']['leadClubs'][number];
export type StaffClubRosterRow = RouterOutputs['club']['roster']['signups'][number];
export type StaffClubAttendanceRow =
  RouterOutputs['club']['attendanceForSession']['students'][number];
export type StaffClubAttendanceStatus = NonNullable<StaffClubAttendanceRow['status']>;
export type StaffClubNotification = RouterOutputs['club']['notifications'][number];
export type StaffClubBehaviourEntry =
  RouterOutputs['behaviour']['recentEntries']['entries'][number];
export type StaffClubBehaviourType = RouterInputs['behaviour']['log']['type'];

export type StaffClubBehaviourDraft = {
  amount: string;
  category: string;
  note: string;
  studentId: string;
  type: StaffClubBehaviourType;
};

export type StaffClubNoticeDraft = {
  body: string;
  title: string;
};

export const clubLeadTabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'behaviour', label: 'Behaviour' },
  { id: 'attendance', label: 'Attendance' },
  { id: 'noticeboard', label: 'Notices' },
] as const satisfies readonly { id: StaffClubLeadTab; label: string }[];

export const clubAttendanceStatuses = [
  'Present',
  'Late',
  'Absent',
] as const satisfies readonly StaffClubAttendanceStatus[];

export const clubBehaviourTypes = [
  'Merit',
  'Demerit',
  'General',
] as const satisfies readonly StaffClubBehaviourType[];

const schoolTimeZone = 'Europe/London';

const clubCategories: Record<StaffClubBehaviourType, readonly string[]> = {
  Demerit: ['Conduct', 'Teamwork', 'Respect', 'Preparation', 'Misc'],
  General: ['Participation', 'Safeguarding', 'Parent follow-up', 'Misc'],
  Merit: ['Leadership', 'Teamwork', 'Service', 'Character', 'Creativity'],
};

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

export function formatYearGroup(value: string): string {
  return value.startsWith('Year ') ? value : `Year ${value}`;
}

export function behaviourCategories(type: StaffClubBehaviourType): readonly string[] {
  return clubCategories[type];
}

export function defaultBehaviourDraft(
  roster: readonly StaffClubRosterRow[],
): StaffClubBehaviourDraft {
  return {
    amount: '5',
    category: behaviourCategories('Merit')[0] ?? 'Leadership',
    note: '',
    studentId: roster[0]?.studentId ?? '',
    type: 'Merit',
  };
}

export function nextBehaviourDraftForType(
  draft: StaffClubBehaviourDraft,
  type: StaffClubBehaviourType,
): StaffClubBehaviourDraft {
  return {
    ...draft,
    amount: type === 'Merit' ? (draft.amount === '0' ? '5' : draft.amount) : '0',
    category: behaviourCategories(type)[0] ?? 'Misc',
    type,
  };
}

export function meritAmountValue(value: string): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export function validateBehaviourDraft(draft: StaffClubBehaviourDraft): string | null {
  if (!draft.studentId) return 'Choose a student before saving behaviour.';
  if (!draft.category.trim()) return 'Choose a behaviour category.';
  if (draft.type === 'Merit' && meritAmountValue(draft.amount) <= 0) {
    return 'Enter a positive merit amount.';
  }
  if (draft.type !== 'General' && !draft.note.trim()) return 'Add a short behaviour note.';
  return null;
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
