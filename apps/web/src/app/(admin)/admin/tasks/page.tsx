import { canUsePersonalTasks } from '@oasis/domain';
import { notFound } from 'next/navigation';
import { MotionPage } from '@/components/admin/motion';
import { getAdminShellUser } from '@/components/admin/require-full-admin';
import { PersonalTasksClient } from '@/components/personal-tasks/personal-tasks-client';

export default async function AdminTasksPage() {
  const user = await getAdminShellUser();

  if (!canUsePersonalTasks(user)) notFound();

  return (
    <MotionPage>
      <PersonalTasksClient />
    </MotionPage>
  );
}
