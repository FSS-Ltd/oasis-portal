import { getParentUser } from '@/components/admin/require-full-admin';
import { ParentFeesClient } from '@/components/invoices/parent-fees-client';

export default async function ParentFeesPage() {
  await getParentUser();

  return <ParentFeesClient />;
}
