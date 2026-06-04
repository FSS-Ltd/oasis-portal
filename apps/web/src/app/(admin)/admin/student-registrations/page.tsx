import { MotionPage } from '@/components/admin/motion';
import { getAdminOperationsUser } from '@/components/admin/require-full-admin';
import { StudentRegistrationsClient } from './student-registrations-client';

export default async function AdminStudentRegistrationsPage() {
  await getAdminOperationsUser();

  return (
    <MotionPage>
      <StudentRegistrationsClient />
    </MotionPage>
  );
}
