import { MotionPage } from '@/components/admin/motion';
import { getLinkedChildPortalUser } from '@/components/admin/require-full-admin';
import { StudentDrillThroughContent } from '@/components/student-drillthrough/student-drillthrough-content';

export default async function SupervisorChildPage({ params }: { params: Promise<{ id: string }> }) {
  await getLinkedChildPortalUser();
  const { id } = await params;

  return (
    <MotionPage>
      <StudentDrillThroughContent
        backHref="/supervisor/children"
        backLabel="Back to Linked Children"
        studentId={id}
      />
    </MotionPage>
  );
}
