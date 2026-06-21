export const attendanceStatuses = ['Present', 'Late', 'Absent'] as const;
export const absenceReasons = ['Sick', 'Holiday', 'NotScheduled', 'Excused', 'Unexcused'] as const;
export const specialAttendanceRegisters = [
  { id: 'FieldTrip', label: 'Field trip' },
  { id: 'MinibusInbound', label: 'Minibus inbound' },
  { id: 'MinibusOutbound', label: 'Minibus outbound' },
  { id: 'TheCedars', label: 'The Cedars' },
] as const;

export type AttendanceStatus = (typeof attendanceStatuses)[number];
export type AbsenceReason = (typeof absenceReasons)[number];
export type SpecialAttendanceRegister = (typeof specialAttendanceRegisters)[number]['id'];

export type AttendanceDraft = {
  status: AttendanceStatus;
  absenceReason: AbsenceReason | null;
};

export type AttendanceCounts = {
  total: number;
  marked: number;
  unmarked: number;
  present: number;
  late: number;
  absent: number;
};

const schoolTimeZone = 'Europe/London';

const reasonLabels: Record<AbsenceReason, string> = {
  Excused: 'Excused',
  Holiday: 'Holiday',
  NotScheduled: 'Not scheduled',
  Sick: 'Sick',
  Unexcused: 'Unexcused',
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

export function formatAttendanceDate(value: string): string {
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'full', timeZone: 'UTC' }).format(
    dateFromKey(value),
  );
}

export function reasonLabel(reason: AbsenceReason): string {
  return reasonLabels[reason];
}

export function specialRegisterLabel(register: SpecialAttendanceRegister): string {
  return specialAttendanceRegisters.find((option) => option.id === register)?.label ?? register;
}

export function isMinibusRegister(register: SpecialAttendanceRegister): boolean {
  return register === 'MinibusInbound' || register === 'MinibusOutbound';
}

export function buildDraft(
  status: AttendanceStatus,
  previousReason: AbsenceReason | null | undefined,
): AttendanceDraft {
  return {
    absenceReason: status === 'Absent' ? (previousReason ?? null) : null,
    status,
  };
}

export function isDraftSaveable(draft: AttendanceDraft | null | undefined): boolean {
  if (!draft) return false;
  return draft.status !== 'Absent' || draft.absenceReason !== null;
}

export function countAttendanceRows(rows: { status: AttendanceStatus | null }[]): AttendanceCounts {
  return rows.reduce<AttendanceCounts>(
    (counts, row) => {
      counts.total += 1;
      if (!row.status) {
        counts.unmarked += 1;
        return counts;
      }

      counts.marked += 1;
      if (row.status === 'Present') counts.present += 1;
      if (row.status === 'Late') counts.late += 1;
      if (row.status === 'Absent') counts.absent += 1;
      return counts;
    },
    { absent: 0, late: 0, marked: 0, present: 0, total: 0, unmarked: 0 },
  );
}
