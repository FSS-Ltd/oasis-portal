import Link from 'next/link';
import { Plus } from 'lucide-react';
import { MotionPage } from '@/components/admin/motion';
import { getStudentDrillThroughAdminUser } from '@/components/admin/require-full-admin';
import { StudentsList } from './students-list';

export default async function StudentsPage() {
  const user = await getStudentDrillThroughAdminUser();
  const canManageStudents = user.role === 'Head';

  return (
    <MotionPage>
      <div className="page-header">
        <div>
          <p>Student records</p>
          <h1>Students</h1>
          <p>
            {canManageStudents
              ? 'Create students, check active subject assignments, and open a record.'
              : 'Check active students and open read-only drill-through records.'}
          </p>
        </div>
        {canManageStudents ? (
          <Link className="button button--primary button--md" href="/admin/students/new">
            <Plus aria-hidden="true" size={17} />
            New student
          </Link>
        ) : null}
      </div>
      <StudentsList canManageStudents={canManageStudents} />
    </MotionPage>
  );
}
