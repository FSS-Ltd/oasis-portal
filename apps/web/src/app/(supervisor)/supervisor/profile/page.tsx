import { MotionPage } from '@/components/admin/motion';
import { getStaffUser } from '@/components/admin/require-full-admin';
import { SelfProfileClient } from '@/components/profile/self-profile-client';

export default async function SupervisorProfilePage() {
  await getStaffUser();

  return (
    <MotionPage>
      <SelfProfileClient accent="navy" childDetailContext="supervisor" />
    </MotionPage>
  );
}
