import { getLinkedChildPortalUser } from '@/components/admin/require-full-admin';
import { ParentPermissionSlipsClient } from '@/components/permission-slips/parent-permission-slips-client';

export default async function ParentPermissionSlipsPage() {
  await getLinkedChildPortalUser();

  return <ParentPermissionSlipsClient />;
}
