import { MotionPage } from '@/components/admin/motion';
import { getLinkedChildPortalUser } from '@/components/admin/require-full-admin';
import { ParentStudentSettingsClient } from '@/components/parent/parent-student-settings-client';

export default async function ParentSettingsPage() {
  await getLinkedChildPortalUser();

  return (
    <MotionPage>
      <ParentStudentSettingsClient />
    </MotionPage>
  );
}
