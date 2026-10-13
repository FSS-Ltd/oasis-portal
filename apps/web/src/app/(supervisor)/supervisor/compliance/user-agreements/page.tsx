import { getStaffUser } from '@/components/admin/require-full-admin';
import { MyAgreements } from '@/components/agreements/my-agreements';

export default async function SupervisorAgreementsPage() {
  await getStaffUser();
  return <MyAgreements />;
}
