import { redirect } from 'next/navigation';
import { getComplianceUser } from '@/components/admin/require-full-admin';
import { RegisterClient } from '../register-client';
import { portalComplianceRoute } from '../portal-compliance-route';

export default async function DbsTrainingPage() {
  const user = await getComplianceUser();
  const portalRoute = portalComplianceRoute(user.role, 'dbs-training');
  if (portalRoute) redirect(portalRoute);
  return <RegisterClient />;
}
