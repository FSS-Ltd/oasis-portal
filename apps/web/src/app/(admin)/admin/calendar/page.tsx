import { canManageCalendar, canUseAdminOperations, isFullAdmin } from '@oasis/domain';
import { MotionPage } from '@/components/admin/motion';
import { getAdminShellUser } from '@/components/admin/require-full-admin';
import { SharedCalendar } from '@/components/calendar/shared-calendar';

export default async function AdminCalendarPage() {
  const user = await getAdminShellUser();
  const canManage = canManageCalendar(user);

  return (
    <MotionPage>
      <SharedCalendar
        canAssignRequiredPeople={canUseAdminOperations(user)}
        canDelete={isFullAdmin(user)}
        canManage={canManage}
        mode="admin"
      />
    </MotionPage>
  );
}
