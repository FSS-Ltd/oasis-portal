export interface AttendanceCounts {
  late: number;
  present: number;
}

export interface AttendanceRateCounts extends AttendanceCounts {
  total: number;
}

export function attendedCount(counts: AttendanceCounts): number {
  return counts.present + counts.late;
}

export function attendanceRate(
  counts: AttendanceRateCounts,
  options: { decimalPlaces?: number } = {},
): number | null {
  if (counts.total <= 0) return null;
  const decimalPlaces = options.decimalPlaces ?? 0;
  const factor = 10 ** decimalPlaces;
  return Math.round((attendedCount(counts) / counts.total) * 100 * factor) / factor;
}
