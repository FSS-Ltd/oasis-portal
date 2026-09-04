import { MotionPage } from '@/components/admin/motion';
import { getHeadUser } from '@/components/admin/require-full-admin';
import { HeadTimetableClient } from '@/components/timetable/head-timetable-client';

export default async function AdminTimetablesPage() {
  await getHeadUser();

  return (
    <MotionPage>
      <HeadTimetableClient />
    </MotionPage>
  );
}
