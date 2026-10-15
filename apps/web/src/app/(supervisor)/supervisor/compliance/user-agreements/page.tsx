import { canUseComplianceAdminTag } from '@oasis/domain';
import { getStaffUser } from '@/components/admin/require-full-admin';
import { MyAgreements } from '@/components/agreements/my-agreements';
import { ManageAgreements } from '@/components/agreements/manage-agreements';

export default async function SupervisorAgreementsPage() {
  const user = await getStaffUser();
  return canUseComplianceAdminTag(user) ? <ManageAgreements /> : <MyAgreements />;
}
