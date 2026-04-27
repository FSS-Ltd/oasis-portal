import { MotionPage } from '@/components/admin/motion';
import { NewStudentForm } from './new-student-form';

export default function NewStudentPage() {
  return (
    <MotionPage>
      <div className="page-header">
        <div>
          <h1>New student</h1>
          <p>Add a student with encrypted personal details and an initial centre year group.</p>
        </div>
      </div>
      <NewStudentForm />
    </MotionPage>
  );
}
