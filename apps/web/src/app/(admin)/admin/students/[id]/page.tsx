import { MotionPage } from '@/components/admin/motion';
import { getStudentDrillThroughAdminUser } from '@/components/admin/require-full-admin';
import { StudentDetail } from './student-detail';

export default async function StudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getStudentDrillThroughAdminUser();
  const { id } = await params;

  return (
    <MotionPage>
      <StudentDetail canEdit={user.role === 'Head'} studentId={id} />
    </MotionPage>
  );
}
