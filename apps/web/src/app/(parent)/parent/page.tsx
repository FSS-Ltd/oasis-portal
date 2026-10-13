import { MotionPage } from '@/components/admin/motion';
import { getLinkedChildPortalUser } from '@/components/admin/require-full-admin';
import { ParentDashboardClient } from './parent-dashboard-client';
import { AgreementHomeAlert } from '@/components/agreements/my-agreements';

export default async function ParentPage() {
  await getLinkedChildPortalUser();

  return (
    <MotionPage>
      <AgreementHomeAlert href="/parent/compliance" />
      <ParentDashboardClient />
    </MotionPage>
  );
}
