import { getStudentUser } from '@/components/admin/require-full-admin';
import { PublishedTimetableClient } from '@/components/timetable/published-timetable-client';

export default async function StudentTimetablePage() {
  await getStudentUser();

  return <PublishedTimetableClient mode="student" />;
}
