import { notFound, redirect } from 'next/navigation';
import { canViewIncidentReports } from '@oasis/domain';
import { getComplianceUser } from '@/components/admin/require-full-admin';
import { IncidentStaffWorkflow } from '@/components/incidents/incident-staff-workflow';
import { portalComplianceRoute } from '../portal-compliance-route';

export default async function ComplianceSafeguardingPage() {
  const user = await getComplianceUser();
  if (!canViewIncidentReports(user)) notFound();
  const portalRoute = portalComplianceRoute(user, 'incidents');
  if (portalRoute) redirect(portalRoute);
  return <IncidentStaffWorkflow portal="compliance" />;
}
