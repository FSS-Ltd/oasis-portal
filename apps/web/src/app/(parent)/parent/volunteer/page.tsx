import { MotionPage } from '@/components/admin/motion';
import { getLinkedChildPortalUser } from '@/components/admin/require-full-admin';
import { ParentVolunteerClient } from '@/components/parent/parent-volunteer-client';

export default async function ParentVolunteerPage() {
  await getLinkedChildPortalUser();

  return (
    <MotionPage>
      <ParentVolunteerClient />
    </MotionPage>
  );
}
