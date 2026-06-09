import { MotionPage } from '@/components/admin/motion';
import { getFullAdminUser } from '@/components/admin/require-full-admin';
import { AdminHomeworkClient } from '@/components/homework/admin-homework-client';

export default async function AdminHomeworkPage() {
  await getFullAdminUser();

  return (
    <MotionPage>
      <AdminHomeworkClient />
    </MotionPage>
  );
}
