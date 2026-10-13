import { canExportAttendance } from '@oasis/domain';
import { MotionPage } from '@/components/admin/motion';
import { getStaffUser } from '@/components/admin/require-full-admin';
import { SupervisorDashboardClient } from './supervisor-dashboard-client';
import { AgreementHomeAlert } from '@/components/agreements/my-agreements';

export default async function SupervisorPage() {
  const user = await getStaffUser();
  const canExportAttendanceCsv = canExportAttendance(user);

  return (
    <MotionPage>
      <AgreementHomeAlert href="/supervisor/compliance/user-agreements" />
      <SupervisorDashboardClient canExportAttendance={canExportAttendanceCsv} view="dashboard" />
    </MotionPage>
  );
}
