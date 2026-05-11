import { canManageCalendar } from '@oasis/domain';
import { notFound } from 'next/navigation';
import { MotionPage } from '@/components/admin/motion';
import { getAdminShellUser } from '@/components/admin/require-full-admin';
import { SharedCalendar } from '@/components/calendar/shared-calendar';

export default async function AdminCalendarPage() {
  const user = await getAdminShellUser();
  if (user.role === 'ClubsAdmin') notFound();
  const canManage = canManageCalendar(user);

  return (
    <MotionPage>
      <SharedCalendar canManage={canManage} mode="admin" />
    </MotionPage>
  );
}
