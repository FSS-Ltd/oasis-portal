import { MotionPage } from '@/components/admin/motion';
import { getAdminOperationsUser } from '@/components/admin/require-full-admin';
import { StudentPortalReadinessClient } from './student-portal-readiness-client';

export default async function AdminStudentPortalPage() {
  await getAdminOperationsUser();

  return (
    <MotionPage>
      <StudentPortalReadinessClient />
    </MotionPage>
  );
}
