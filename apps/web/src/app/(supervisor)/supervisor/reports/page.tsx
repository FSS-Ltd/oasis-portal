import { notFound } from 'next/navigation';
import { canViewScoreKeyReport } from '@oasis/domain';
import { getStaffUser } from '@/components/admin/require-full-admin';
import { ActiveScoreKeysReport } from '@/components/reports/active-score-keys-report';

export default async function SupervisorReportsPage() {
  const user = await getStaffUser();
  if (!canViewScoreKeyReport(user)) notFound();
  return <ActiveScoreKeysReport />;
}
