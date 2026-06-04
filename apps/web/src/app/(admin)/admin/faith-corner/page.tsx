import { MotionPage } from '@/components/admin/motion';
import { getAdminOperationsUser } from '@/components/admin/require-full-admin';
import { FaithCornerAdminClient } from '@/components/faith-corner/faith-corner-admin-client';

export default async function AdminFaithCornerPage() {
  await getAdminOperationsUser();

  return (
    <MotionPage>
      <FaithCornerAdminClient />
    </MotionPage>
  );
}
