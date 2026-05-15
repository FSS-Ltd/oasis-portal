import { canManageShop, canSellInShop } from '@oasis/domain';
import { MotionPage } from '@/components/admin/motion';
import { getShopWorkflowUser } from '@/components/admin/require-full-admin';
import { ShopWorkflowClient } from '@/components/shop/shop-workflow-client';

export default async function SupervisorShopPage() {
  const user = await getShopWorkflowUser();

  return (
    <MotionPage>
      <ShopWorkflowClient
        canManageItems={canManageShop(user)}
        canRecordPurchases={canSellInShop(user)}
        portal="supervisor"
      />
    </MotionPage>
  );
}
