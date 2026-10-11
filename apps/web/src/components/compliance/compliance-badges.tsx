import type { AdultComplianceBadgeSummary } from '@oasis/domain';
import { Badge } from '@/components/ui/badge';
import styles from './compliance-badges.module.css';

export function ComplianceBadges({ summary }: { summary: AdultComplianceBadgeSummary | null }) {
  if (!summary) return null;
  return (
    <span className={styles.badges} aria-label="Recorded compliance status">
      {summary.dbsStatus === 'RecordedCurrent' ? <Badge tone="green">DBS current</Badge> : null}
      {summary.dbsStatus === 'NoLongerCurrent' ? <Badge tone="amber">DBS not current</Badge> : null}
      {summary.dbsStatus === 'AwaitingCertificate' ? <Badge tone="grey">DBS awaiting</Badge> : null}
      {summary.dbsStatus === 'NotRecorded' ? <Badge tone="grey">DBS not recorded</Badge> : null}
      {summary.firstAidTrained ? <Badge tone="blue">First aid</Badge> : null}
      {summary.safeguardingTrained ? <Badge tone="blue">Safeguarding</Badge> : null}
    </span>
  );
}
