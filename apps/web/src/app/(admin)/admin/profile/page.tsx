import { MotionPage } from '@/components/admin/motion';
import { getAdminShellUser } from '@/components/admin/require-full-admin';
import { SelfProfileClient } from '@/components/profile/self-profile-client';

export default async function AdminProfilePage() {
  await getAdminShellUser();

  return (
    <MotionPage>
      <SelfProfileClient accent="navy" childDetailContext="admin" />
    </MotionPage>
  );
}
