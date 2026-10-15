import { canUseComplianceAdminTag } from '@oasis/domain';
import { getAdminShellUser } from '@/components/admin/require-full-admin';
import { MyAgreements } from '@/components/agreements/my-agreements';
import { ManageAgreements } from '@/components/agreements/manage-agreements';

export default async function AdminAgreementsPage() {
  const user = await getAdminShellUser();
  return user.role === 'Head' || canUseComplianceAdminTag(user) ? (
    <ManageAgreements />
  ) : (
    <MyAgreements />
  );
}
