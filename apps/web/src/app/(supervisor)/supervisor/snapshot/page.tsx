import { MotionPage } from '@/components/admin/motion';
import { ChildSnapshotClient } from '@/components/child-log/child-snapshot-client';
import { assertStaffUser } from '@/components/admin/require-full-admin';

export default async function SupervisorSnapshotPage() {
  await assertStaffUser();

  return (
    <MotionPage>
      <ChildSnapshotClient />
    </MotionPage>
  );
}
