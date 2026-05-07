import { canExportAttendance, canRecordStudentAttendance } from '@oasis/domain';
import { MotionPage } from '@/components/admin/motion';
import { getStaffUser } from '@/components/admin/require-full-admin';
import { SupervisorDashboardClient } from '../supervisor-dashboard-client';

export default async function SupervisorAttendancePage() {
  const user = await getStaffUser();
  const canExportAttendanceCsv = canExportAttendance(user);
  const canRecordAttendance = canRecordStudentAttendance(user);

  return (
    <MotionPage>
      <div className="page-header">
        <div>
          <p>Daily register</p>
          <h1>Attendance</h1>
          <p>Mark the daily register and export attendance where your role allows it.</p>
        </div>
      </div>
      <SupervisorDashboardClient
        canExportAttendance={canExportAttendanceCsv}
        canRecordAttendance={canRecordAttendance}
        view="attendance"
      />
    </MotionPage>
  );
}
