import { MotionPage } from '@/components/admin/motion';
import { assertFullAdmin } from '@/components/admin/require-full-admin';
import { StudentDetail } from './student-detail';

export default async function StudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await assertFullAdmin();
  const { id } = await params;

  return (
    <MotionPage>
      <StudentDetail studentId={id} />
    </MotionPage>
  );
}
