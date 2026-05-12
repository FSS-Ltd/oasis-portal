export const attendanceStatuses = ['Present', 'Absent', 'Late'] as const;
export const absenceReasons = ['Sick', 'Holiday', 'NotScheduled', 'Excused', 'Unexcused'] as const;

export type AttendanceStatus = (typeof attendanceStatuses)[number];
export type AbsenceReason = (typeof absenceReasons)[number];

export const absenceReasonLabels = {
  Sick: 'Sick',
  Holiday: 'Holiday',
  NotScheduled: 'Not scheduled',
  Excused: 'Excused',
  Unexcused: 'Unexcused',
} as const satisfies Record<AbsenceReason, string>;

export function attendanceStatusLabel(
  status: AttendanceStatus | null,
  absenceReason?: AbsenceReason | null,
  absenceReasonLabel?: string | null,
): string {
  if (!status) return 'Unmarked';
  if (status !== 'Absent') return status;
  return `Absent · ${absenceReasonLabel ?? (absenceReason ? absenceReasonLabels[absenceReason] : 'Unknown')}`;
}
