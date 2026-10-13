import { getLinkedChildPortalUser } from '@/components/admin/require-full-admin';
import { MyAgreements } from '@/components/agreements/my-agreements';

export default async function ParentAgreementsPage() {
  await getLinkedChildPortalUser();
  return <MyAgreements />;
}
