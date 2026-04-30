import { FileText } from 'lucide-react';
import { MotionPage } from '@/components/admin/motion';
import { ChildSnapshotClient } from '@/components/child-log/child-snapshot-client';
import { assertStaffUser } from '@/components/admin/require-full-admin';

export default async function SupervisorSnapshotPage() {
  await assertStaffUser();

  return (
    <MotionPage>
      <div className="page-header">
        <div>
          <p>Supervisor workspace</p>
          <h1>Child snapshot</h1>
          <p>Review recent attendance, PACE tests, merits, demerits, and visible notes for one child.</p>
        </div>
        <span className="badge badge--blue">
          <FileText aria-hidden="true" size={14} />
          Child log
        </span>
      </div>
      <ChildSnapshotClient />
    </MotionPage>
  );
}
