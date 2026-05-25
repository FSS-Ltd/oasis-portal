import { MotionPage } from '@/components/admin/motion';
import { getLinkedChildPortalUser } from '@/components/admin/require-full-admin';
import { ParentMyClubsClient } from '@/components/clubs/parent-my-clubs-client';

export default async function SupervisorClubsPage() {
  await getLinkedChildPortalUser();

  return (
    <MotionPage>
      <ParentMyClubsClient variant="supervisor" />
    </MotionPage>
  );
}
