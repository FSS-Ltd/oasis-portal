import { notFound } from 'next/navigation';
import { canManageCalendar } from '@oasis/domain';
import { MotionPage } from '@/components/admin/motion';
import { getAdminShellUser } from '@/components/admin/require-full-admin';
import { SharedCalendar } from '@/components/calendar/shared-calendar';

export default async function AdminCalendarPage() {
  const user = await getAdminShellUser();
  const canManage = canManageCalendar(user);
  if (!canManage) notFound();

  return (
    <MotionPage>
      <SharedCalendar canManage={canManage} mode="admin" />
    </MotionPage>
  );
}
