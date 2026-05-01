import { MotionPage } from '@/components/admin/motion';
import { SupervisorDashboardClient } from '../supervisor-dashboard-client';

export default function SupervisorPacePage() {
  return (
    <MotionPage>
      <div className="page-header">
        <div>
          <p>Subject progress</p>
          <h1>PACE</h1>
          <p>Record self tests and final PACE tests against assigned subjects.</p>
        </div>
      </div>
      <SupervisorDashboardClient canExportAttendance={false} view="pace" />
    </MotionPage>
  );
}
