import { canManageCalendar } from '@oasis/domain';
import { MotionPage } from '@/components/admin/motion';
import { getStaffUser } from '@/components/admin/require-full-admin';
import { SharedCalendar } from '@/components/calendar/shared-calendar';

export default async function SupervisorCalendarPage() {
  const user = await getStaffUser();

  return (
    <MotionPage>
      <SharedCalendar canManage={canManageCalendar(user)} mode="supervisor" />
    </MotionPage>
  );
}
