import { MotionPage } from '@/components/admin/motion';
import { SupervisorDashboardClient } from '../supervisor-dashboard-client';

export default function SupervisorBehaviourPage() {
  return (
    <MotionPage>
      <div className="page-header">
        <div>
          <p>Supervisor workspace</p>
          <h1>Behaviour</h1>
          <p>Record merits, demerits, and visibility-controlled behaviour notes.</p>
        </div>
      </div>
      <SupervisorDashboardClient canExportAttendance={false} view="behaviour" />
    </MotionPage>
  );
}
