import { CalendarCheck, Download } from 'lucide-react';
import { canRecordStudentAttendance } from '@oasis/domain';
import { MotionPage } from '@/components/admin/motion';
import { getFullAdminUser } from '@/components/admin/require-full-admin';
import { AttendanceRoster } from './attendance-roster';

export default async function AttendancePage() {
  const user = await getFullAdminUser();
  const canRecord = canRecordStudentAttendance(user);

  return (
    <MotionPage>
      <div className="page-header">
        <div>
          <p>Daily register</p>
          <h1>Attendance</h1>
          <p>Record today&apos;s student attendance and export the student register.</p>
        </div>
        <div className="page-header__actions">
          <span className="badge badge--blue">
            <CalendarCheck aria-hidden="true" size={14} />
            Student register
          </span>
          <span className="badge badge--blue">
            <Download aria-hidden="true" size={14} />
            CSV
          </span>
        </div>
      </div>
      <AttendanceRoster canRecord={canRecord} />
    </MotionPage>
  );
}
