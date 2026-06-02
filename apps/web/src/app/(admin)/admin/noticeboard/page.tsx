import { MotionPage } from '@/components/admin/motion';
import { getAdminOperationsUser } from '@/components/admin/require-full-admin';
import { StaffNoticeboard } from '@/components/noticeboard/staff-noticeboard';

export default async function AdminNoticeboardPage() {
  await getAdminOperationsUser();

  return (
    <MotionPage>
      <StaffNoticeboard mode="admin" />
    </MotionPage>
  );
}
