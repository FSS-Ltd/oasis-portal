import { MotionPage } from '@/components/admin/motion';
import { AuditLogViewer } from './audit-log-viewer';

export default function AuditPage() {
  return (
    <MotionPage>
      <div className="page-header">
        <div>
          <p>Audit trail</p>
          <h1>Audit log</h1>
          <p>Review admin actions, PII decrypts, and permission events from Phase 1 onboarding.</p>
        </div>
      </div>
      <AuditLogViewer />
    </MotionPage>
  );
}
