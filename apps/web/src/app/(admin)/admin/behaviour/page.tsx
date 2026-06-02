import { notFound } from 'next/navigation';
import {
  canUseAdminOperations,
  canViewBehaviourReports,
  canViewSensitiveBehaviour,
} from '@oasis/domain';
import { MotionPage } from '@/components/admin/motion';
import { getAdminShellUser } from '@/components/admin/require-full-admin';
import { BehaviourLogClient } from '@/components/behaviour/behaviour-log-client';

export default async function AdminBehaviourPage() {
  const user = await getAdminShellUser();
  if (!canViewBehaviourReports(user)) notFound();
  const canLogBehaviour = canUseAdminOperations(user);
  const sensitiveMode = canViewSensitiveBehaviour(user) ? 'all' : 'none';

  return (
    <MotionPage>
      <BehaviourLogClient
        canLogBehaviour={canLogBehaviour}
        canManageEntries={canLogBehaviour}
        sensitiveMode={sensitiveMode}
        showTrends
      />
    </MotionPage>
  );
}
