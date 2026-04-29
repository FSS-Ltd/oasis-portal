import { CalendarCheck, Download } from 'lucide-react';
import { MotionPage } from '@/components/admin/motion';
import { AttendanceRoster } from './attendance-roster';

export default function AttendancePage() {
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
      <AttendanceRoster />
    </MotionPage>
  );
}
