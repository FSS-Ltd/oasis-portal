import { MotionPage } from '@/components/admin/motion';
import { StudentDetail } from './student-detail';

export default async function StudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <MotionPage>
      <StudentDetail studentId={id} />
    </MotionPage>
  );
}
