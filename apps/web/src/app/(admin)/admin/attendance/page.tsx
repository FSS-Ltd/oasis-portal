import { CalendarCheck, Download } from 'lucide-react';
import { notFound } from 'next/navigation';
import { canExportAttendance, canRecordStudentAttendance, isFullAdmin } from '@oasis/domain';
import { MotionPage } from '@/components/admin/motion';
import { getAdminShellUser } from '@/components/admin/require-full-admin';
import { AttendanceExportCentre } from './attendance-export-centre';
import { AttendanceRoster } from './attendance-roster';

export default async function AttendancePage() {
  const user = await getAdminShellUser();
  const canExport = canExportAttendance(user);
  const canReadRegister = isFullAdmin(user) || user.role === 'Supervisor';
  const canRecord = canRecordStudentAttendance(user);
  if (!canReadRegister && !canExport) notFound();

  return (
    <MotionPage>
      <div className="page-header">
        <div>
          <p>Daily register</p>
          <h1>Attendance</h1>
          <p>Record today&apos;s student attendance and export attendance records.</p>
        </div>
        <div className="page-header__actions">
          {canReadRegister ? (
            <span className="badge badge--blue">
              <CalendarCheck aria-hidden="true" size={14} />
              Student register
            </span>
          ) : null}
          <span className="badge badge--blue">
            <Download aria-hidden="true" size={14} />
            CSV
          </span>
        </div>
      </div>
      <div className="attendance-page-stack">
        {canExport ? <AttendanceExportCentre /> : null}
        {canReadRegister ? <AttendanceRoster canExport={canExport} canRecord={canRecord} /> : null}
      </div>
    </MotionPage>
  );
}
