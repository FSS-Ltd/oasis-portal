import Link from 'next/link';
import { Plus } from 'lucide-react';
import { MotionPage } from '@/components/admin/motion';
import { assertFullAdmin } from '@/components/admin/require-full-admin';
import { StudentsList } from './students-list';

export default async function StudentsPage() {
  await assertFullAdmin();

  return (
    <MotionPage>
      <div className="page-header">
        <div>
          <p>Student records</p>
          <h1>Students</h1>
          <p>Create students, check active subject assignments, and open a record for edits.</p>
        </div>
        <Link className="button button--primary button--md" href="/admin/students/new">
          <Plus aria-hidden="true" size={17} />
          New student
        </Link>
      </div>
      <StudentsList />
    </MotionPage>
  );
}
