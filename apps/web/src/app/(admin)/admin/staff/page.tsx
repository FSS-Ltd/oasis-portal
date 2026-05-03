import { MotionPage } from '@/components/admin/motion';
import { getFullAdminUser } from '@/components/admin/require-full-admin';
import { PeopleProfilesClient } from './people-profiles-client';

export default async function PeopleProfilesPage() {
  const user = await getFullAdminUser();

  return (
    <MotionPage>
      <div className="page-header">
        <div>
          <p>Access and profiles</p>
          <h1>People & Profiles</h1>
          <p>
            Manage students, supervisors, and parents from one directory while preserving role and
            permission boundaries.
          </p>
        </div>
      </div>
      <PeopleProfilesClient canDeleteAccounts={user.role === 'Head'} currentUserId={user.id} />
    </MotionPage>
  );
}
