import { redirect } from 'next/navigation';
import { getComplianceUser } from '@/components/admin/require-full-admin';
import { MedTabClient } from '../medtab-client';
import { portalComplianceRoute } from '../portal-compliance-route';

export default async function MedTabPage() {
  const user = await getComplianceUser();
  const portalRoute = portalComplianceRoute(user.role, 'medtab');
  if (portalRoute) redirect(portalRoute);
  return <MedTabClient />;
}
