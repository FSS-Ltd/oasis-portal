import { MotionPage } from '@/components/admin/motion';
import { getLinkedChildPortalUser } from '@/components/admin/require-full-admin';
import { LinkedChildClubSignupClient } from '@/components/clubs/linked-child-club-signup-client';

export default async function SupervisorClubsPage() {
  await getLinkedChildPortalUser();

  return (
    <MotionPage>
      <LinkedChildClubSignupClient variant="supervisor" />
    </MotionPage>
  );
}
