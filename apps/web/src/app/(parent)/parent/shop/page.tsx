import { MotionPage } from '@/components/admin/motion';
import { getLinkedChildPortalUser } from '@/components/admin/require-full-admin';
import { ParentShopClient } from '@/components/shop/parent-shop-client';

export default async function ParentShopPage() {
  await getLinkedChildPortalUser();

  return (
    <MotionPage>
      <ParentShopClient />
    </MotionPage>
  );
}
