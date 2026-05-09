import { MotionPage } from '@/components/admin/motion';
import { getLinkedChildPortalUser } from '@/components/admin/require-full-admin';
import { StaffNoticeboard } from '@/components/noticeboard/staff-noticeboard';

export default async function ParentNoticeboardPage() {
  await getLinkedChildPortalUser();

  return (
    <MotionPage>
      <StaffNoticeboard mode="parent" />
    </MotionPage>
  );
}
