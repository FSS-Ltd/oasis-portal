import { FileText } from 'lucide-react';
import { MotionPage } from '@/components/admin/motion';
import { ChildSnapshotClient } from '@/components/child-log/child-snapshot-client';
import { assertFullAdmin } from '@/components/admin/require-full-admin';

export default async function AdminSnapshotPage() {
  await assertFullAdmin();

  return (
    <MotionPage>
      <div className="page-header">
        <div>
          <p>Child log</p>
          <h1>Snapshot</h1>
          <p>Review a child&apos;s attendance, PACE tests, merits, demerits, and notes over a selected range.</p>
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
