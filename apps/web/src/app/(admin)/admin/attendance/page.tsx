import { BarChart3, CalendarCheck } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  canExportAttendance,
  canRecordStudentAttendance,
  canUseAdminOperations,
  isStaff,
} from '@oasis/domain';
import { MotionPage } from '@/components/admin/motion';
import { getAdminShellUser } from '@/components/admin/require-full-admin';
import { AttendanceRoster } from './attendance-roster';

export default async function AttendancePage() {
  const user = await getAdminShellUser();
  const canExport = canExportAttendance(user);
  const canReadRegister = isStaff(user);
  const canRecord = canRecordStudentAttendance(user);
  const canUseOperations = canUseAdminOperations(user);
  if (!canReadRegister && !canExport) notFound();

  return (
    <MotionPage>
      <div className="page-header">
        <div>
          <p>Daily register</p>
          <h1>Student attendance</h1>
          <p>Record the daily student register with required absence reasons.</p>
        </div>
        <div className="page-header__actions">
          {canReadRegister ? (
            <span className="badge badge--blue">
              <CalendarCheck aria-hidden="true" size={14} />
              Student register
            </span>
          ) : null}
          {canUseOperations ? (
            <Link className="badge badge--blue" href="/admin/attendance/staff">
              <CalendarCheck aria-hidden="true" size={14} />
              Staff register
            </Link>
          ) : null}
          {canExport ? (
            <Link className="badge badge--blue" href="/admin/attendance/center">
              <BarChart3 aria-hidden="true" size={14} />
              Attendance center
            </Link>
          ) : null}
        </div>
      </div>
      <div className="attendance-page-stack">
        {canReadRegister ? <AttendanceRoster canExport={false} canRecord={canRecord} /> : null}
      </div>
    </MotionPage>
  );
}
