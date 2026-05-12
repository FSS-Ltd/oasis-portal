import { notFound } from 'next/navigation';
import { canUseFullPaceAccess, isFullAdmin } from '@oasis/domain';
import { MotionPage } from '@/components/admin/motion';
import { getAdminShellUser } from '@/components/admin/require-full-admin';
import { PaceWorkflowClient } from '@/components/pace/pace-workflow-client';

export default async function AdminPacePage() {
  const user = await getAdminShellUser();
  if (!canUseFullPaceAccess(user)) notFound();

  return (
    <MotionPage>
      <PaceWorkflowClient canManageProgress={isFullAdmin(user)} />
    </MotionPage>
  );
}
