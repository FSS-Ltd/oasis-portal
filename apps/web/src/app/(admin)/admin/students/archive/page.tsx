import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Archive } from 'lucide-react';
import { MotionPage } from '@/components/admin/motion';
import { getFullAdminUser } from '@/components/admin/require-full-admin';
import { ArchivedStudentsClient } from './archived-students-client';

export default async function ArchivedStudentsPage() {
  const user = await getFullAdminUser();
  if (user.role !== 'Head') notFound();

  return (
    <MotionPage>
      <div className="page-header">
        <div>
          <p>Student records</p>
          <h1>Archived Students</h1>
          <p>Review archived student profiles and restore a profile to active rosters.</p>
        </div>
        <div className="page-header__actions">
          <Link className="button button--secondary button--md" href="/admin/students">
            <ArrowLeft aria-hidden="true" size={17} />
            Active Students
          </Link>
          <span className="badge badge--grey">
            <Archive aria-hidden="true" size={14} />
            Head Only
          </span>
        </div>
      </div>
      <ArchivedStudentsClient />
    </MotionPage>
  );
}
