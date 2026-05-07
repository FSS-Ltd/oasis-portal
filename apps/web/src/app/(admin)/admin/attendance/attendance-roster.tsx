'use client';

import { AttendanceCapture } from '@/components/attendance/attendance-capture';

export function AttendanceRoster({ canExport, canRecord }: { canExport: boolean; canRecord: boolean }) {
  return <AttendanceCapture canExport={canExport} canRecord={canRecord} />;
}
