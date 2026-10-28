import { MotionPage } from '@/components/admin/motion';
import { getAdminOperationsUser } from '@/components/admin/require-full-admin';
import { DeletionRequestsPanel } from './_components/deletion-requests-panel';
import { PeopleProfilesClient } from './people-profiles-client';

export default async function PeopleProfilesPage() {
  const user = await getAdminOperationsUser();

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
      <DeletionRequestsPanel currentUserRole={user.role} />
      <PeopleProfilesClient currentUserId={user.id} currentUserRole={user.role} />
    </MotionPage>
  );
}
