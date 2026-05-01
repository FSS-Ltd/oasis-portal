import { MotionPage } from '@/components/admin/motion';
import { getParentUser } from '@/components/admin/require-full-admin';
import { StudentDrillThroughContent } from '@/components/student-drillthrough/student-drillthrough-content';

export default async function ParentChildPage({ params }: { params: Promise<{ id: string }> }) {
  await getParentUser();
  const { id } = await params;

  return (
    <MotionPage>
      <StudentDrillThroughContent backHref="/parent" backLabel="Back to My Children" studentId={id} />
    </MotionPage>
  );
}
