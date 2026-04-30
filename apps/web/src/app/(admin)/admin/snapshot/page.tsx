import { MotionPage } from '@/components/admin/motion';
import { ChildSnapshotClient } from '@/components/child-log/child-snapshot-client';
import { assertFullAdmin } from '@/components/admin/require-full-admin';

export default async function AdminSnapshotPage() {
  await assertFullAdmin();

  return (
    <MotionPage>
      <ChildSnapshotClient />
    </MotionPage>
  );
}
