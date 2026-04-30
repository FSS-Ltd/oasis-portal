import { Star } from 'lucide-react';
import { MotionPage } from '@/components/admin/motion';
import { assertBehaviourReportViewer } from '@/components/admin/require-full-admin';
import { BehaviourReportClient } from './behaviour-report-client';

export default async function AdminBehaviourPage() {
  await assertBehaviourReportViewer();

  return (
    <MotionPage>
      <div className="page-header">
        <div>
          <p>Behaviour reporting</p>
          <h1>Behaviour</h1>
          <p>Review daily merits and behaviour trends for Head-level oversight.</p>
        </div>
        <span className="badge badge--blue">
          <Star aria-hidden="true" size={14} />
          Head discretion
        </span>
      </div>
      <BehaviourReportClient />
    </MotionPage>
  );
}
