import { MotionPage } from '@/components/admin/motion';
import { canUseAdminOperations, canViewScoreKeyReport } from '@oasis/domain';
import { notFound } from 'next/navigation';
import { getAdminShellUser } from '@/components/admin/require-full-admin';
import { ReportsWorkspaceClient } from '@/components/reports/reports-workspace-client';

export default async function AdminReportsPage() {
  const user = await getAdminShellUser();
  if (!canViewScoreKeyReport(user)) notFound();

  return (
    <MotionPage>
      <ReportsWorkspaceClient canViewStudentReports={canUseAdminOperations(user)} />
    </MotionPage>
  );
}
