import { getLinkedChildPortalUser } from '@/components/admin/require-full-admin';
import { ParentFeesClient } from '@/components/invoices/parent-fees-client';

export default async function ParentFeesPage() {
  await getLinkedChildPortalUser();

  return <ParentFeesClient />;
}
