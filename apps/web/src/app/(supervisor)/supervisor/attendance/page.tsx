import { canRecordStudentAttendance, hasTag, isFullAdmin } from '@oasis/domain';
import { MotionPage } from '@/components/admin/motion';
import { getStaffUser } from '@/components/admin/require-full-admin';
import { SupervisorDashboardClient } from '../supervisor-dashboard-client';

export default async function SupervisorAttendancePage() {
  const user = await getStaffUser();
  const canExportAttendance = isFullAdmin(user) || hasTag(user, 'attendance-exporter');
  const canRecordAttendance = canRecordStudentAttendance(user);

  return (
    <MotionPage>
      <div className="page-header">
        <div>
          <p>Supervisor workspace</p>
          <h1>Attendance</h1>
          <p>Mark the daily register and export attendance where your role allows it.</p>
        </div>
      </div>
      <SupervisorDashboardClient
        canExportAttendance={canExportAttendance}
        canRecordAttendance={canRecordAttendance}
        view="attendance"
      />
    </MotionPage>
  );
}
