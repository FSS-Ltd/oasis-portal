import { BarChart3, CalendarCheck } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { canExportAttendance, canUseAdminOperations } from '@oasis/domain';
import { MotionPage } from '@/components/admin/motion';
import { getAdminShellUser } from '@/components/admin/require-full-admin';
import { StaffAttendanceRoster } from '../staff-attendance-roster';

export default async function StaffAttendancePage() {
  const user = await getAdminShellUser();
  if (!canUseAdminOperations(user)) notFound();
  const canExport = canExportAttendance(user);

  return (
    <MotionPage>
      <div className="page-header">
        <div>
          <p>Daily register</p>
          <h1>Staff attendance</h1>
          <p>Mark scheduled supervisors and add unscheduled staff who came in.</p>
        </div>
        <div className="page-header__actions">
          <Link className="badge badge--blue" href="/admin/attendance">
            <CalendarCheck aria-hidden="true" size={14} />
            Student register
          </Link>
          <span className="badge badge--blue">
            <CalendarCheck aria-hidden="true" size={14} />
            Staff register
          </span>
          {canExport ? (
            <Link className="badge badge--blue" href="/admin/attendance/center">
              <BarChart3 aria-hidden="true" size={14} />
              Attendance center
            </Link>
          ) : null}
        </div>
      </div>
      <StaffAttendanceRoster />
    </MotionPage>
  );
}
