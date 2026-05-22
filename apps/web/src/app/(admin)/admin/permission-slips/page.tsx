import { MotionPage } from '@/components/admin/motion';
import { getPermissionSlipManagerUser } from '@/components/admin/require-full-admin';
import { AdminPermissionSlipsClient } from '@/components/permission-slips/admin-permission-slips-client';

export default async function AdminPermissionSlipsPage() {
  await getPermissionSlipManagerUser();

  return (
    <MotionPage>
      <AdminPermissionSlipsClient />
    </MotionPage>
  );
}
