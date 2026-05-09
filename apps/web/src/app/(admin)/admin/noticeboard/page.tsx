import { MotionPage } from '@/components/admin/motion';
import { getFullAdminUser } from '@/components/admin/require-full-admin';
import { StaffNoticeboard } from '@/components/noticeboard/staff-noticeboard';

export default async function AdminNoticeboardPage() {
  await getFullAdminUser();

  return (
    <MotionPage>
      <StaffNoticeboard canPost />
    </MotionPage>
  );
}
