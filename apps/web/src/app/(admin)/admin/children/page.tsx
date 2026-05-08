import { MotionPage } from '@/components/admin/motion';
import { getLinkedChildPortalUser } from '@/components/admin/require-full-admin';
import { ParentChildrenList } from '../../../(parent)/parent/parent-children-list';

export default async function AdminChildrenPage() {
  await getLinkedChildPortalUser();

  return (
    <MotionPage>
      <div className="page-header">
        <div>
          <p>Linked child view</p>
          <h1>My Children</h1>
          <p>Open linked child records for attendance, behaviour, PACE, and merit progress.</p>
        </div>
      </div>
      <ParentChildrenList variant="admin" />
    </MotionPage>
  );
}
