import { MotionPage } from '@/components/admin/motion';
import { getLinkedChildPortalUser } from '@/components/admin/require-full-admin';
import { ReportWorkflowClient } from '@/components/reports/report-workflow-client';

export default async function ParentReportsPage() {
  await getLinkedChildPortalUser();

  return (
    <MotionPage>
      <ReportWorkflowClient mode="parent" />
    </MotionPage>
  );
}
