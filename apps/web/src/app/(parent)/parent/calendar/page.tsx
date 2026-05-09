import { MotionPage } from '@/components/admin/motion';
import { getLinkedChildPortalUser } from '@/components/admin/require-full-admin';
import { SharedCalendar } from '@/components/calendar/shared-calendar';

export default async function ParentCalendarPage() {
  await getLinkedChildPortalUser();

  return (
    <MotionPage>
      <SharedCalendar canManage={false} mode="parent" />
    </MotionPage>
  );
}
