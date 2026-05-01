import { MotionPage } from '@/components/admin/motion';
import { getStaffUser } from '@/components/admin/require-full-admin';
import { PaceWorkflowClient } from '@/components/pace/pace-workflow-client';

export default async function SupervisorPacePage() {
  await getStaffUser();

  return (
    <MotionPage>
      <PaceWorkflowClient />
    </MotionPage>
  );
}
