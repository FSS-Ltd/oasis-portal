import { MotionPage } from '@/components/admin/motion';
import { getFullAdminUser } from '@/components/admin/require-full-admin';
import { ReportWorkflowClient } from '@/components/reports/report-workflow-client';

export default async function AdminReportsPage() {
  await getFullAdminUser();

  return (
    <MotionPage>
      <ReportWorkflowClient mode="admin" />
    </MotionPage>
  );
}
