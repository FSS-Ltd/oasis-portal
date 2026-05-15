import { TRPCError } from '@trpc/server';
import {
  AccessDeniedError,
  assertCanManageShop,
  validateDraft,
  type ShopItemDraft,
  type SessionUser,
} from '@oasis/domain';
import { z } from 'zod';
import type { AppContext } from '../context.js';
import { authedProcedure, router } from '../trpc.js';

type AuthedContext = AppContext & { user: SessionUser };
type LooseShopItemDraft = Omit<ShopItemDraft, 'photoUrl'> & { photoUrl?: string | undefined };

interface ShopItemRow {
  id: string;
  name: string;
  photoUrl: string | null;
  priceExVat: number;
  vatRatePct: number;
  priceIncVat: number;
  stockCount: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ShopItemDto {
  id: string;
  name: string;
  photoUrl: string | null;
  priceExVat: number;
  vatRatePct: number;
  priceIncVat: number;
  stockCount: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const itemSelect = {
  id: true,
  name: true,
  photoUrl: true,
  priceExVat: true,
  vatRatePct: true,
  priceIncVat: true,
  stockCount: true,
  active: true,
  createdAt: true,
  updatedAt: true,
} as const;

const listItemsInput = z
  .object({
    includeInactive: z.boolean().default(false),
  })
  .optional();

const createItemInput = z.object({
  name: z.string().min(1),
  photoUrl: z.string().url().optional(),
  priceExVat: z.number().int().nonnegative(),
  vatRatePct: z.number().int().min(0).max(100),
  stockCount: z.number().int().nonnegative(),
});

const updateItemInput = z.object({
  id: z.string().cuid(),
  name: z.string().min(1).optional(),
  photoUrl: z.string().url().optional(),
  priceExVat: z.number().int().nonnegative().optional(),
  vatRatePct: z.number().int().min(0).max(100).optional(),
  stockCount: z.number().int().nonnegative().optional(),
  active: z.boolean().optional(),
});

function mapItem(row: ShopItemRow): ShopItemDto {
  return {
    id: row.id,
    name: row.name,
    photoUrl: row.photoUrl,
    priceExVat: row.priceExVat,
    vatRatePct: row.vatRatePct,
    priceIncVat: row.priceIncVat,
    stockCount: row.stockCount,
    active: row.active,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function draftInput(input: LooseShopItemDraft): ShopItemDraft {
  const draft: ShopItemDraft = {
    name: input.name,
    priceExVat: input.priceExVat,
    vatRatePct: input.vatRatePct,
    stockCount: input.stockCount,
  };
  if (input.photoUrl !== undefined) {
    draft.photoUrl = input.photoUrl;
  }
  return draft;
}

async function auditPermissionDenied(
  ctx: AuthedContext,
  entity: string,
  denied: AccessDeniedError,
): Promise<never> {
  await ctx.db.auditLog.create({
    data: {
      userId: ctx.user.id,
      action: 'PermissionDenied',
      entity,
      meta: { role: ctx.user.role, reason: denied.message },
    },
  });
  throw new TRPCError({ code: 'FORBIDDEN', message: denied.message, cause: denied });
}

async function requireCanManageShop(ctx: AuthedContext, entity: string): Promise<void> {
  try {
    assertCanManageShop(ctx.user);
  } catch (err) {
    if (err instanceof AccessDeniedError) {
      await auditPermissionDenied(ctx, entity, err);
    }
    throw err;
  }
}

function toBadRequest(err: unknown): never {
  throw new TRPCError({
    code: 'BAD_REQUEST',
    message: err instanceof Error ? err.message : 'invalid shop item',
    cause: err instanceof Error ? err : undefined,
  });
}

export const shopRouter = router({
  listItems: authedProcedure.input(listItemsInput).query(async ({ ctx, input }) => {
    const includeInactive = input?.includeInactive ?? false;

    if (includeInactive) {
      await requireCanManageShop(ctx, 'shop.listItems');
    }

    const items = await ctx.db.shopItem.findMany({
      where: includeInactive ? {} : { active: true },
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
      select: itemSelect,
    });

    return items.map(mapItem);
  }),

  createItem: authedProcedure.input(createItemInput).mutation(async ({ ctx, input }) => {
    await requireCanManageShop(ctx, 'shop.createItem');

    let draft: ReturnType<typeof validateDraft>;
    try {
      draft = validateDraft(draftInput(input));
    } catch (err) {
      toBadRequest(err);
    }

    const item = await ctx.db.shopItem.create({
      data: {
        name: draft.name,
        photoUrl: draft.photoUrl ?? null,
        priceExVat: draft.priceExVat,
        vatRatePct: draft.vatRatePct,
        priceIncVat: draft.priceIncVat,
        stockCount: draft.stockCount,
        createdById: ctx.user.id,
      },
      select: itemSelect,
    });

    await ctx.db.auditLog.create({
      data: {
        userId: ctx.user.id,
        action: 'Create',
        entity: 'ShopItem',
        entityId: item.id,
        meta: {
          source: 'shop.createItem',
          name: item.name,
          priceIncVat: item.priceIncVat,
          stockCount: item.stockCount,
          active: item.active,
        },
      },
    });

    return mapItem(item);
  }),

  updateItem: authedProcedure.input(updateItemInput).mutation(async ({ ctx, input }) => {
    await requireCanManageShop(ctx, 'shop.updateItem');

    const existing = await ctx.db.shopItem.findUnique({
      where: { id: input.id },
      select: itemSelect,
    });

    if (!existing) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'shop item not found' });
    }

    let draft: ReturnType<typeof validateDraft>;
    try {
      draft = validateDraft(draftInput({
        name: input.name ?? existing.name,
        photoUrl: input.photoUrl ?? existing.photoUrl ?? undefined,
        priceExVat: input.priceExVat ?? existing.priceExVat,
        vatRatePct: input.vatRatePct ?? existing.vatRatePct,
        stockCount: input.stockCount ?? existing.stockCount,
      }));
    } catch (err) {
      toBadRequest(err);
    }

    const item = await ctx.db.shopItem.update({
      where: { id: input.id },
      data: {
        name: draft.name,
        photoUrl: draft.photoUrl ?? null,
        priceExVat: draft.priceExVat,
        vatRatePct: draft.vatRatePct,
        priceIncVat: draft.priceIncVat,
        stockCount: draft.stockCount,
        active: input.active ?? existing.active,
      },
      select: itemSelect,
    });

    await ctx.db.auditLog.create({
      data: {
        userId: ctx.user.id,
        action: existing.active && !item.active ? 'Delete' : 'Update',
        entity: 'ShopItem',
        entityId: item.id,
        meta: {
          source: 'shop.updateItem',
          name: item.name,
          priceIncVat: item.priceIncVat,
          stockCount: item.stockCount,
          active: item.active,
          previousActive: existing.active,
        },
      },
    });

    return mapItem(item);
  }),

  purchase: authedProcedure
    .input(
      z.object({
        studentId: z.string().cuid(),
        itemId: z.string().cuid(),
        unitsBought: z.number().int().positive(),
      }),
    )
    .mutation(() => {
      throw new TRPCError({
        code: 'NOT_IMPLEMENTED',
        message: 'shop.purchase is implemented in PR-4.4',
      });
    }),
});
