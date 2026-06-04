import type { RouterOutputs } from '@/lib/trpc';
import type { ShopCategoryOption } from '@/components/shop/shop-shared';

export type ShopItem = RouterOutputs['shop']['listItems'][number];
export type StudentShopHistory = RouterOutputs['shop']['studentHistory'];
export type CartLine = { itemId: string; quantity: number };
export type CartLineWithItem = CartLine & { item: ShopItem; lineTotal: number };
export type CategoryFilter = ShopCategoryOption | 'All';
