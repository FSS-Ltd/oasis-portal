import { hasTag, isFullAdmin } from '@oasis/domain';
import { MotionPage } from '@/components/admin/motion';
import { getStaffUser } from '@/components/admin/require-full-admin';
import { SupervisorDashboardClient } from './supervisor-dashboard-client';

export default async function SupervisorPage() {
  const user = await getStaffUser();
  const canExportAttendance = isFullAdmin(user) || hasTag(user, 'attendance-exporter');

  return (
    <MotionPage>
      <SupervisorDashboardClient canExportAttendance={canExportAttendance} view="dashboard" />
    </MotionPage>
  );
}
