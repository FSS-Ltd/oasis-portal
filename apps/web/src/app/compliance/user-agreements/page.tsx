import { canUseComplianceAdminTag } from '@oasis/domain';
import { getComplianceUser } from '@/components/admin/require-full-admin';
import { MyAgreements } from '@/components/agreements/my-agreements';
import { ManageAgreements } from '@/components/agreements/manage-agreements';

export default async function ComplianceAgreementsPage() {
  const user = await getComplianceUser();
  return user.role === 'Head' || canUseComplianceAdminTag(user) ? (
    <ManageAgreements />
  ) : (
    <MyAgreements />
  );
}
