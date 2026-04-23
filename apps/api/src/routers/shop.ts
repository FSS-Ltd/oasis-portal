import { z } from 'zod';
import { authedProcedure, router } from '../trpc.js';
import { notImplemented } from './_notImplemented.js';

export const shopRouter = router({
  listItems: authedProcedure.query(() => notImplemented('shop.listItems')),
  createItem: authedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        photoUrl: z.string().url().optional(),
        priceExVat: z.number().int().nonnegative(),
        vatRatePct: z.number().int().min(0).max(100),
        stockCount: z.number().int().nonnegative(),
      }),
    )
    .mutation(() => notImplemented('shop.createItem')),
  updateItem: authedProcedure
    .input(
      z.object({
        id: z.string().cuid(),
        name: z.string().min(1).optional(),
        photoUrl: z.string().url().optional(),
        priceExVat: z.number().int().nonnegative().optional(),
        vatRatePct: z.number().int().min(0).max(100).optional(),
        stockCount: z.number().int().nonnegative().optional(),
        active: z.boolean().optional(),
      }),
    )
    .mutation(() => notImplemented('shop.updateItem')),
  purchase: authedProcedure
    .input(
      z.object({
        studentId: z.string().cuid(),
        itemId: z.string().cuid(),
        unitsBought: z.number().int().positive(),
      }),
    )
    .mutation(() => notImplemented('shop.purchase')),
});
