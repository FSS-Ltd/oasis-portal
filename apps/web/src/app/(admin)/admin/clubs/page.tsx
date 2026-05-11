import { MotionPage } from '@/components/admin/motion';
import { getClubManagerUser } from '@/components/admin/require-full-admin';
import { ClubsManagementClient } from '@/components/clubs/clubs-management-client';

export default async function AdminClubsPage() {
  await getClubManagerUser();

  return (
    <MotionPage>
      <ClubsManagementClient />
    </MotionPage>
  );
}
