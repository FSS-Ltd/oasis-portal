import { MotionPage } from '@/components/admin/motion';
import { SupervisorDashboardClient } from '../supervisor-dashboard-client';

export default function SupervisorRotaPage() {
  return (
    <MotionPage>
      <div className="page-header">
        <div>
          <p>Supervisor workspace</p>
          <h1>Rota</h1>
          <p>Review your shifts, maintain weekly availability, and request shift swaps.</p>
        </div>
      </div>
      <SupervisorDashboardClient canExportAttendance={false} view="rota" />
    </MotionPage>
  );
}
