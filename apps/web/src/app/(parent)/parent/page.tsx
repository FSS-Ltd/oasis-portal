import { MotionPage } from '@/components/admin/motion';
import { getLinkedChildPortalUser } from '@/components/admin/require-full-admin';
import { ParentDashboardClient } from './parent-dashboard-client';

export default async function ParentPage() {
  await getLinkedChildPortalUser();

  return (
    <MotionPage>
      <ParentDashboardClient />
    </MotionPage>
  );
}
