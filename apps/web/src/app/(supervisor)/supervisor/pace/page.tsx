import { isFullAdmin } from '@oasis/domain';
import { MotionPage } from '@/components/admin/motion';
import { getStaffUser } from '@/components/admin/require-full-admin';
import { PaceWorkflowClient } from '@/components/pace/pace-workflow-client';

export default async function SupervisorPacePage() {
  const user = await getStaffUser();

  return (
    <MotionPage>
      <PaceWorkflowClient canManageProgress={isFullAdmin(user)} />
    </MotionPage>
  );
}
