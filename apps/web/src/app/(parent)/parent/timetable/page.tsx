import { MotionPage } from '@/components/admin/motion';
import { getLinkedChildPortalUser } from '@/components/admin/require-full-admin';
import { PublishedTimetableClient } from '@/components/timetable/published-timetable-client';

export default async function ParentTimetablePage() {
  await getLinkedChildPortalUser();

  return (
    <MotionPage>
      <PublishedTimetableClient mode="parent" />
    </MotionPage>
  );
}
