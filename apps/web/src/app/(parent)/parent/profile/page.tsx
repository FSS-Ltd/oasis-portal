import { MotionPage } from '@/components/admin/motion';
import { getLinkedChildPortalUser } from '@/components/admin/require-full-admin';
import { SelfProfileClient } from '@/components/profile/self-profile-client';

export default async function ParentProfilePage() {
  await getLinkedChildPortalUser();

  return (
    <MotionPage>
      <SelfProfileClient accent="crimson" />
    </MotionPage>
  );
}
