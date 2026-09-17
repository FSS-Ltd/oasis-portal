import { MotionPage } from '@/components/admin/motion';
import { getLinkedChildPortalUser } from '@/components/admin/require-full-admin';
import { ParentPaceClient } from '@/components/parent/parent-pace-client';

export default async function ParentPacePage() {
  await getLinkedChildPortalUser();

  return (
    <MotionPage>
      <ParentPaceClient />
    </MotionPage>
  );
}
