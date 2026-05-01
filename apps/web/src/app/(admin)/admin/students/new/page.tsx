import { MotionPage } from '@/components/admin/motion';
import { assertFullAdmin } from '@/components/admin/require-full-admin';
import { NewStudentForm } from './new-student-form';

export default async function NewStudentPage() {
  await assertFullAdmin();

  return (
    <MotionPage>
      <div className="page-header">
        <div>
          <p>Student profile</p>
          <h1>New student</h1>
          <p>Add a student with encrypted personal details and an initial centre year group.</p>
        </div>
      </div>
      <NewStudentForm />
    </MotionPage>
  );
}
