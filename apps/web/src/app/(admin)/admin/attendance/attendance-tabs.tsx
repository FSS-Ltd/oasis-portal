'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AttendanceCapture } from '@/components/attendance/attendance-capture';
import { SpecialAttendanceCapture } from '@/components/attendance/special-attendance-capture';
import { AttendanceExportCentre } from './attendance-export-centre';
import { StaffAttendanceRoster } from './staff-attendance-roster';

type AttendanceTab = 'student' | 'staff' | 'special' | 'center';

type AttendanceTabsProps = {
  canReadStudentRegister: boolean;
  canRecordStudentAttendance: boolean;
  canUseStaffRegister: boolean;
  canViewCenter: boolean;
};

const tabLabels = {
  student: 'Student register',
  staff: 'Staff & volunteers',
  special: 'Special attendance',
  center: 'Attendance center',
} as const satisfies Record<AttendanceTab, string>;

function isAttendanceTab(value: string | null): value is AttendanceTab {
  return value === 'student' || value === 'staff' || value === 'special' || value === 'center';
}

export function AttendanceTabs({
  canReadStudentRegister,
  canRecordStudentAttendance,
  canUseStaffRegister,
  canViewCenter,
}: AttendanceTabsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const availableTabs = useMemo(
    () =>
      [
        canReadStudentRegister ? 'student' : null,
        canUseStaffRegister ? 'staff' : null,
        canRecordStudentAttendance ? 'special' : null,
        canViewCenter ? 'center' : null,
      ].filter((tab): tab is AttendanceTab => tab !== null),
    [canReadStudentRegister, canRecordStudentAttendance, canUseStaffRegister, canViewCenter],
  );
  const requestedTab = searchParams?.get('tab') ?? null;
  const [activeTab, setActiveTab] = useState<AttendanceTab>(
    isAttendanceTab(requestedTab) && availableTabs.includes(requestedTab)
      ? requestedTab
      : (availableTabs[0] ?? 'student'),
  );

  useEffect(() => {
    if (availableTabs.includes(activeTab)) return;
    const fallback = availableTabs[0];
    if (fallback) setActiveTab(fallback);
  }, [activeTab, availableTabs]);

  function selectTab(tab: AttendanceTab): void {
    setActiveTab(tab);
    router.replace(`/admin/attendance?tab=${tab}`, { scroll: false });
  }

  return (
    <div className="attendance-page-stack">
      <div
        className="admin-club-detail-tabs attendance-admin-tabs"
        role="tablist"
        aria-label="Attendance sections"
      >
        {availableTabs.map((tab) => (
          <button
            aria-selected={activeTab === tab}
            className={activeTab === tab ? 'is-selected' : ''}
            key={tab}
            onClick={() => {
              selectTab(tab);
            }}
            role="tab"
            type="button"
          >
            {tabLabels[tab]}
          </button>
        ))}
      </div>

      {activeTab === 'student' ? (
        <AttendanceCapture canExport={false} canRecord={canRecordStudentAttendance} />
      ) : null}
      {activeTab === 'staff' ? <StaffAttendanceRoster /> : null}
      {activeTab === 'special' ? (
        <SpecialAttendanceCapture canRecord={canRecordStudentAttendance} />
      ) : null}
      {activeTab === 'center' ? <AttendanceExportCentre /> : null}
    </div>
  );
}
