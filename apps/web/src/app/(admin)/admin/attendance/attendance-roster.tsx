'use client';

import { AttendanceCapture } from '@/components/attendance/attendance-capture';

export function AttendanceRoster({ canRecord }: { canRecord: boolean }) {
  return <AttendanceCapture canExport canRecord={canRecord} />;
}
