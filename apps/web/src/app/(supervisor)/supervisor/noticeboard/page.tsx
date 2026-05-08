import { MotionPage } from '@/components/admin/motion';
import { getStaffUser } from '@/components/admin/require-full-admin';
import { StaffNoticeboard } from '@/components/noticeboard/staff-noticeboard';

export default async function SupervisorNoticeboardPage() {
  await getStaffUser();

  return (
    <MotionPage>
      <StaffNoticeboard canPost={false} />
    </MotionPage>
  );
}
