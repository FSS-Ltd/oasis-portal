import { BarChart3, CalendarCheck } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { canExportAttendance, isFullAdmin } from '@oasis/domain';
import { MotionPage } from '@/components/admin/motion';
import { getAdminShellUser } from '@/components/admin/require-full-admin';
import { AttendanceExportCentre } from '../attendance-export-centre';

export default async function AttendanceCenterPage() {
  const user = await getAdminShellUser();
  const canViewCenter = canExportAttendance(user);
  if (!canViewCenter) notFound();

  return (
    <MotionPage>
      <div className="page-header">
        <div>
          <p>Visual center</p>
          <h1>Attendance center</h1>
          <p>Review visual attendance trends and individual drilldowns.</p>
        </div>
        <div className="page-header__actions">
          <Link className="badge badge--blue" href="/admin/attendance">
            <CalendarCheck aria-hidden="true" size={14} />
            Student register
          </Link>
          {isFullAdmin(user) ? (
            <Link className="badge badge--blue" href="/admin/attendance/staff">
              <CalendarCheck aria-hidden="true" size={14} />
              Staff register
            </Link>
          ) : null}
          <span className="badge badge--blue">
            <BarChart3 aria-hidden="true" size={14} />
            Visual center
          </span>
        </div>
      </div>
      <AttendanceExportCentre />
    </MotionPage>
  );
}
