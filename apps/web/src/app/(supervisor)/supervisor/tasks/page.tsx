import { MotionPage } from '@/components/admin/motion';
import { getStaffUser } from '@/components/admin/require-full-admin';
import { PersonalTasksClient } from '@/components/personal-tasks/personal-tasks-client';

export default async function SupervisorTasksPage() {
  await getStaffUser();

  return (
    <MotionPage>
      <PersonalTasksClient />
    </MotionPage>
  );
}
