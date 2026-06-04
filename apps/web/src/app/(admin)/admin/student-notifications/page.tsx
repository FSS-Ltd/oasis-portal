import { MotionPage } from '@/components/admin/motion';
import { getAdminOperationsUser } from '@/components/admin/require-full-admin';
import { StudentNotificationAdminClient } from '@/components/student-notifications/student-notification-admin-client';

export default async function AdminStudentNotificationsPage() {
  await getAdminOperationsUser();

  return (
    <MotionPage>
      <StudentNotificationAdminClient />
    </MotionPage>
  );
}
