import { MotionPage } from '@/components/admin/motion';
import { assertAuditViewer } from '@/components/admin/require-full-admin';
import { AuditLogViewer } from './audit-log-viewer';

export default async function AuditPage() {
  await assertAuditViewer();

  return (
    <MotionPage>
      <div className="page-header">
        <div>
          <p>Inspection trail</p>
          <h1>Audit log</h1>
          <p>Review attendance, PACE, behaviour, notes, and profile changes across the portal.</p>
        </div>
      </div>
      <AuditLogViewer />
    </MotionPage>
  );
}
