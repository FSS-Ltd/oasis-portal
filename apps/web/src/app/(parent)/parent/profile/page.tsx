import { MotionPage } from '@/components/admin/motion';
import { getParentUser } from '@/components/admin/require-full-admin';
import { SelfProfileClient } from '@/components/profile/self-profile-client';

export default async function ParentProfilePage() {
  await getParentUser();

  return (
    <MotionPage>
      <SelfProfileClient accent="crimson" />
    </MotionPage>
  );
}
