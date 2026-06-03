import { randomUUID } from 'node:crypto';
import { TRPCError } from '@trpc/server';
import { Prisma } from '@oasis/db';
import {
  AccessDeniedError,
  SHOP_CATEGORIES,
  SHOP_CATEGORY_DETAILS,
  assertCanManageShop,
  assertCanSellInShop,
  canManageShop,
  canSellInShop,
  prepareShopPurchase,
  prepareShopReservation,
  requireOwnChild,
  requireSelfStudent,
  rowsForReservationCancellation,
  rowsForReservationCollection,
  validateDraft,
  type ReservationResult,
  type ShopCategory,
  type ShopItemDraft,
  type SessionUser,
} from '@oasis/domain';
import { z } from 'zod';
import type { AppContext } from '../context.js';
import {
  assertStudentMeritShopAccess,
  assertStudentPortalUnlocked,
} from '../lib/student-portal-access.js';
import {
  assertUploadedShopItemPhoto,
  type UploadedShopItemPhoto,
} from '../services/shop-item-photo-storage.js';
import { authedProcedure, router } from '../trpc.js';

type AuthedContext = AppContext & { user: SessionUser };
interface LooseShopItemDraft {
  name: string;
  photoUrl?: string | null | undefined;
  category?: ShopCategory | null | undefined;
  blurb?: string | null | undefined;
  description?: string | null | undefined;
  priceExVat: number;
  vatRatePct: number;
  stockCount: number;
  lowStockThreshold?: number | null | undefined;
}
type ShopReservationStatus = 'Ready' | 'Collected' | 'Cancelled';

interface ShopItemRow {
  id: string;
  name: string;
  photoUrl: string | null;
  category: ShopCategory;
  blurb: string | null;
  description: string | null;
  priceExVat: number;
  vatRatePct: number;
  priceIncVat: number;
  stockCount: number;
  lowStockThreshold: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface ActiveStudent {
  id: string;
  active: boolean;
  userId: string | null;
}

interface PurchaseItemRow {
  id: string;
  priceIncVat: number;
  stockCount: number;
  active: boolean;
}

interface PurchaserStudentRow {
  id: string;
  fullNameEnc: string;
  yearGroup: string;
}

interface ReservationStudentRow {
  id: string;
  fullNameEnc: string;
  yearGroup: string;
}

interface ReservationLineRow {
  id: string;
  itemId: string;
  unitsReserved: number;
  unitPriceMerits: number;
  totalPriceMerits: number;
  item: Pick<
    ShopItemRow,
    | 'id'
    | 'name'
    | 'photoUrl'
    | 'category'
    | 'priceIncVat'
    | 'stockCount'
    | 'lowStockThreshold'
    | 'active'
  >;
}

interface ReservationRow {
  id: string;
  studentId: string;
  reservedById: string;
  status: ShopReservationStatus;
  totalPriceMerits: number;
  collectedAt: Date | null;
  collectedById: string | null;
  cancelledAt: Date | null;
  cancelledById: string | null;
  createdAt: Date;
  updatedAt: Date;
  student: ReservationStudentRow;
  lines: ReservationLineRow[];
}

interface ReservationLineRequest {
  itemId: string;
  unitsReserved: number;
}

interface ShopItemPhotoMetadata {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

export interface ShopItemDto {
  id: string;
  name: string;
  photoUrl: string | null;
  category: ShopCategory;
  categoryLabel: string;
  categoryTint: string;
  categoryInk: string;
  blurb: string | null;
  description: string | null;
  priceExVat: number;
  vatRatePct: number;
  priceIncVat: number;
  stockCount: number;
  availableStockCount: number;
  lowStockThreshold: number;
  stockStatus: 'Available' | 'LowStock' | 'OutOfStock' | 'Inactive';
  soldCount: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ShopPurchaseDto {
  id: string;
  studentId: string;
  itemId: string;
  unitsBought: number;
  totalPriceMerits: number;
  remainingStockCount: number;
  createdAt: Date;
}

export interface ShopPurchaserDto {
  id: string;
  fullName: string;
  yearGroup: string;
  spendBalance: number;
}

export interface ShopReservationLineDto {
  id: string;
  itemId: string;
  itemName: string;
  itemPhotoUrl: string | null;
  category: ShopCategory;
  categoryLabel: string;
  categoryTint: string;
  categoryInk: string;
  unitsReserved: number;
  unitPriceMerits: number;
  totalPriceMerits: number;
}

export interface ShopReservationDto {
  id: string;
  studentId: string;
  studentName: string;
  studentYearGroup: string;
  reservedById: string;
  status: ShopReservationStatus;
  totalPriceMerits: number;
  collectedAt: Date | null;
  collectedById: string | null;
  cancelledAt: Date | null;
  cancelledById: string | null;
  createdAt: Date;
  updatedAt: Date;
  lines: ShopReservationLineDto[];
}

const shopCategorySchema = z.enum(SHOP_CATEGORIES);
const reservationStatusSchema = z.enum(['Ready', 'Collected', 'Cancelled']);
const MAX_SHOP_ITEM_PHOTO_BYTES = 5 * 1024 * 1024;

const shopItemPhotoMetadataInput = z.object({
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1).max(120),
  sizeBytes: z.number().int().positive().max(MAX_SHOP_ITEM_PHOTO_BYTES),
});

const shopItemPhotoInput = shopItemPhotoMetadataInput.extend({
  storageBucket: z.string().trim().min(1).max(120),
  storagePath: z.string().trim().min(1).max(512),
});

const itemSelect = {
  id: true,
  name: true,
  photoUrl: true,
  category: true,
  blurb: true,
  description: true,
  priceExVat: true,
  vatRatePct: true,
  priceIncVat: true,
  stockCount: true,
  lowStockThreshold: true,
  active: true,
  createdAt: true,
  updatedAt: true,
} as const;

const reservationInclude = {
  student: { select: { id: true, fullNameEnc: true, yearGroup: true } },
  lines: {
    include: {
      item: {
        select: {
          id: true,
          name: true,
          photoUrl: true,
          category: true,
          priceIncVat: true,
          stockCount: true,
          lowStockThreshold: true,
          active: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  },
} as const;

const listItemsInput = z
  .object({
    includeInactive: z.boolean().default(false),
  })
  .optional();

const createItemInput = z.object({
  name: z.string().min(1),
  photoUrl: z.string().url().optional(),
  category: shopCategorySchema.default('Treats'),
  blurb: z.string().max(160).optional(),
  description: z.string().max(1000).optional(),
  priceExVat: z.number().int().nonnegative(),
  vatRatePct: z.number().int().min(0).max(100),
  stockCount: z.number().int().nonnegative(),
  lowStockThreshold: z.number().int().nonnegative().default(5),
});

const updateItemInput = z.object({
  id: z.string().cuid(),
  name: z.string().min(1).optional(),
  photoUrl: z.string().url().optional(),
  category: shopCategorySchema.optional(),
  blurb: z.string().max(160).nullable().optional(),
  description: z.string().max(1000).nullable().optional(),
  priceExVat: z.number().int().nonnegative().optional(),
  vatRatePct: z.number().int().min(0).max(100).optional(),
  stockCount: z.number().int().nonnegative().optional(),
  lowStockThreshold: z.number().int().nonnegative().optional(),
  active: z.boolean().optional(),
});

const reserveInput = z.object({
  studentId: z.string().cuid(),
  lines: z
    .array(
      z.object({
        itemId: z.string().cuid(),
        unitsReserved: z.number().int().positive(),
      }),
    )
    .min(1)
    .max(20),
});

const reservationIdInput = z.object({ reservationId: z.string().cuid() });

const listReservationsInput = z
  .object({
    status: reservationStatusSchema.optional(),
  })
  .optional();

const prepareItemPhotoUploadInput = z.object({
  photo: shopItemPhotoMetadataInput,
});

const updateItemPhotoInput = z.object({
  id: z.string().cuid(),
  photo: shopItemPhotoInput,
});

const SHOP_ITEM_PHOTO_EXTENSIONS = ['.jpeg', '.jpg', '.png', '.webp'] as const;

type AllowedShopItemPhotoExtension = (typeof SHOP_ITEM_PHOTO_EXTENSIONS)[number];

const shopItemPhotoMimeByExtension = {
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
} as const satisfies Record<AllowedShopItemPhotoExtension, string>;

function categoryDetails(category: ShopCategory) {
  return SHOP_CATEGORY_DETAILS[category];
}

function shopItemPhotoBucket(): string {
  return process.env['SUPABASE_SHOP_ITEM_PHOTOS_BUCKET'] ?? 'shop-item-photos';
}

function safeOriginalFileName(value: string): string {
  const fileName = value.replaceAll('\\', '/').split('/').pop()?.replace(/\0/gu, '').trim();
  return fileName?.replace(/^\.+/u, '').trim() || 'shop-item-photo';
}

function shopItemPhotoExtension(fileName: string): AllowedShopItemPhotoExtension | null {
  const lowerName = fileName.toLowerCase();
  const extension = SHOP_ITEM_PHOTO_EXTENSIONS.find((candidate) => lowerName.endsWith(candidate));
  return extension ?? null;
}

function safeStorageFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/gu, '-').replace(/-+/gu, '-');
}

function publicStorageObjectUrl(bucket: string, path: string): string {
  const url =
    process.env['SUPABASE_URL']?.trim() ?? process.env['NEXT_PUBLIC_SUPABASE_URL']?.trim();
  if (!url) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'shop item photo storage is not configured',
    });
  }

  const encodedPath = path
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  return new URL(
    `/storage/v1/object/public/${encodeURIComponent(bucket)}/${encodedPath}`,
    url.replace(/\/+$/u, ''),
  ).toString();
}

function validateShopItemPhotoMetadata(input: ShopItemPhotoMetadata): ShopItemPhotoMetadata {
  const fileName = safeOriginalFileName(input.fileName);
  const extension = shopItemPhotoExtension(fileName);
  if (!extension) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'unsupported shop item photo type' });
  }

  const mimeType = input.mimeType.toLowerCase();
  if (mimeType !== shopItemPhotoMimeByExtension[extension]) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'shop item photo type mismatch' });
  }
  if (input.sizeBytes > MAX_SHOP_ITEM_PHOTO_BYTES) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'shop item photo is too large' });
  }

  return {
    fileName,
    mimeType,
    sizeBytes: input.sizeBytes,
  };
}

function storagePathForItemPhoto(userId: string, fileName: string): string {
  return `shop-items/${userId}/${randomUUID()}-${safeStorageFileName(fileName)}`;
}

function assertShopItemPhotoStorageTarget(
  input: Pick<UploadedShopItemPhoto, 'storageBucket' | 'storagePath'>,
  userId: string,
): void {
  if (input.storageBucket !== shopItemPhotoBucket()) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'invalid shop item photo bucket' });
  }
  if (
    !input.storagePath.startsWith(`shop-items/${userId}/`) ||
    input.storagePath.includes('..') ||
    input.storagePath.startsWith('/') ||
    input.storagePath.endsWith('/')
  ) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'invalid shop item photo path' });
  }
}

function prepareShopItemPhoto(input: ShopItemPhotoMetadata, userId: string): UploadedShopItemPhoto {
  const metadata = validateShopItemPhotoMetadata(input);
  return {
    ...metadata,
    storageBucket: shopItemPhotoBucket(),
    storagePath: storagePathForItemPhoto(userId, metadata.fileName),
  };
}

function validateUploadedShopItemPhoto(
  input: z.infer<typeof shopItemPhotoInput>,
  userId: string,
): UploadedShopItemPhoto {
  const metadata = validateShopItemPhotoMetadata(input);
  assertShopItemPhotoStorageTarget(input, userId);
  return {
    ...metadata,
    storageBucket: input.storageBucket,
    storagePath: input.storagePath,
  };
}

function stockStatus(
  item: Pick<ShopItemRow, 'active' | 'stockCount' | 'lowStockThreshold'>,
): ShopItemDto['stockStatus'] {
  if (!item.active) return 'Inactive';
  if (item.stockCount <= 0) return 'OutOfStock';
  if (item.stockCount <= item.lowStockThreshold) return 'LowStock';
  return 'Available';
}

function mapItem(row: ShopItemRow, soldCount: number): ShopItemDto {
  const details = categoryDetails(row.category);
  return {
    id: row.id,
    name: row.name,
    photoUrl: row.photoUrl,
    category: row.category,
    categoryLabel: details.label,
    categoryTint: details.tint,
    categoryInk: details.ink,
    blurb: row.blurb,
    description: row.description,
    priceExVat: row.priceExVat,
    vatRatePct: row.vatRatePct,
    priceIncVat: row.priceIncVat,
    stockCount: row.stockCount,
    availableStockCount: row.stockCount,
    lowStockThreshold: row.lowStockThreshold,
    stockStatus: stockStatus(row),
    soldCount,
    active: row.active,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapReservation(ctx: AuthedContext, row: ReservationRow): ShopReservationDto {
  const studentName = decryptStudentName(ctx, row.student);
  return {
    id: row.id,
    studentId: row.studentId,
    studentName,
    studentYearGroup: row.student.yearGroup,
    reservedById: row.reservedById,
    status: row.status,
    totalPriceMerits: row.totalPriceMerits,
    collectedAt: row.collectedAt,
    collectedById: row.collectedById,
    cancelledAt: row.cancelledAt,
    cancelledById: row.cancelledById,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    lines: row.lines.map((line) => {
      const details = categoryDetails(line.item.category);
      return {
        id: line.id,
        itemId: line.itemId,
        itemName: line.item.name,
        itemPhotoUrl: line.item.photoUrl,
        category: line.item.category,
        categoryLabel: details.label,
        categoryTint: details.tint,
        categoryInk: details.ink,
        unitsReserved: line.unitsReserved,
        unitPriceMerits: line.unitPriceMerits,
        totalPriceMerits: line.totalPriceMerits,
      };
    }),
  };
}

function decryptStudentName(ctx: AuthedContext, student: PurchaserStudentRow): string {
  const fullName = ctx.db.$enc.decrypt(student.fullNameEnc);
  if (!fullName) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'student PII decrypt failed' });
  }
  return fullName;
}

function draftInput(input: LooseShopItemDraft): ShopItemDraft {
  const draft: ShopItemDraft = {
    name: input.name,
    priceExVat: input.priceExVat,
    vatRatePct: input.vatRatePct,
    stockCount: input.stockCount,
  };
  if (input.photoUrl !== null && input.photoUrl !== undefined) {
    draft.photoUrl = input.photoUrl;
  }
  if (input.category !== null && input.category !== undefined) {
    draft.category = input.category;
  }
  if (input.blurb !== null && input.blurb !== undefined) {
    draft.blurb = input.blurb;
  }
  if (input.description !== null && input.description !== undefined) {
    draft.description = input.description;
  }
  if (input.lowStockThreshold !== null && input.lowStockThreshold !== undefined) {
    draft.lowStockThreshold = input.lowStockThreshold;
  }
  return draft;
}

async function auditPermissionDenied(
  ctx: AuthedContext,
  entity: string,
  denied: AccessDeniedError,
  entityId?: string,
): Promise<never> {
  await ctx.db.auditLog.create({
    data: {
      userId: ctx.user.id,
      action: 'PermissionDenied',
      entity,
      entityId: entityId ?? null,
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

async function requireCanSellInShop(
  ctx: AuthedContext,
  entity: string,
  entityId?: string,
): Promise<void> {
  try {
    assertCanSellInShop(ctx.user);
  } catch (err) {
    if (err instanceof AccessDeniedError) {
      await auditPermissionDenied(ctx, entity, err, entityId);
    }
    throw err;
  }
}

async function requireCanUploadShopItemPhoto(
  ctx: AuthedContext,
  entity: string,
  entityId?: string,
): Promise<void> {
  if (canManageShop(ctx.user) || canSellInShop(ctx.user)) return;
  await auditPermissionDenied(
    ctx,
    entity,
    new AccessDeniedError('shop item photo uploads require full-admin, shopadmin, or shopkeeper'),
    entityId,
  );
}

function requireReservationListAccess(ctx: AuthedContext): Prisma.ShopReservationWhereInput {
  if (canManageShop(ctx.user) || canSellInShop(ctx.user)) return {};
  if (ctx.user.role === 'Parent' || ctx.user.role === 'Student') {
    return { reservedById: ctx.user.id };
  }
  throw new TRPCError({
    code: 'FORBIDDEN',
    message: 'shop reservations require Parent, Student, full-admin, or shopkeeper',
  });
}

async function requireCanReserveForStudent(
  ctx: AuthedContext,
  student: ActiveStudent,
): Promise<void> {
  if (ctx.user.role === 'Parent') {
    const guardian = await ctx.db.guardian.findUnique({
      where: { userId_studentId: { userId: ctx.user.id, studentId: student.id } },
      select: { studentId: true },
    });
    try {
      requireOwnChild(ctx.user, student.id, guardian ? [guardian.studentId] : []);
      return;
    } catch (err) {
      if (err instanceof AccessDeniedError) {
        await auditPermissionDenied(ctx, 'shop.reserve', err, student.id);
      }
      throw err;
    }
  }

  if (ctx.user.role === 'Student') {
    try {
      requireSelfStudent(ctx.user, student.id, student.userId);
      return;
    } catch (err) {
      if (err instanceof AccessDeniedError) {
        await auditPermissionDenied(ctx, 'shop.reserve', err, student.id);
      }
      throw err;
    }
  }

  await auditPermissionDenied(
    ctx,
    'shop.reserve',
    new AccessDeniedError('shop reservations require Parent or Student'),
    student.id,
  );
}

async function requireCanCancelReservation(
  ctx: AuthedContext,
  reservation: Pick<ReservationRow, 'studentId' | 'reservedById'> & {
    student: Pick<ActiveStudent, 'id' | 'userId'>;
  },
): Promise<void> {
  if (canManageShop(ctx.user) || canSellInShop(ctx.user)) return;
  if (reservation.reservedById === ctx.user.id) return;

  if (ctx.user.role === 'Parent') {
    const guardian = await ctx.db.guardian.findUnique({
      where: { userId_studentId: { userId: ctx.user.id, studentId: reservation.studentId } },
      select: { studentId: true },
    });
    try {
      requireOwnChild(ctx.user, reservation.studentId, guardian ? [guardian.studentId] : []);
      return;
    } catch (err) {
      if (err instanceof AccessDeniedError) {
        await auditPermissionDenied(ctx, 'shop.cancelReservation', err, reservation.studentId);
      }
      throw err;
    }
  }

  if (ctx.user.role === 'Student') {
    try {
      requireSelfStudent(ctx.user, reservation.studentId, reservation.student.userId);
      return;
    } catch (err) {
      if (err instanceof AccessDeniedError) {
        await auditPermissionDenied(ctx, 'shop.cancelReservation', err, reservation.studentId);
      }
      throw err;
    }
  }

  await auditPermissionDenied(
    ctx,
    'shop.cancelReservation',
    new AccessDeniedError('reservation cancellation requires reservation owner or shop staff'),
    reservation.studentId,
  );
}

function toBadRequest(err: unknown): never {
  throw new TRPCError({
    code: 'BAD_REQUEST',
    message: err instanceof Error ? err.message : 'invalid shop item',
    cause: err instanceof Error ? err : undefined,
  });
}

async function loadActiveStudent(ctx: AuthedContext, studentId: string): Promise<ActiveStudent> {
  const student = await ctx.db.student.findUnique({
    where: { id: studentId },
    select: { id: true, active: true, userId: true },
  });

  if (!student?.active) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'student not found' });
  }

  return student;
}

async function loadOwnActiveStudent(ctx: AuthedContext): Promise<ActiveStudent> {
  const student = await ctx.db.student.findUnique({
    where: { userId: ctx.user.id },
    select: { id: true, active: true, userId: true },
  });

  if (!student?.active) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'student profile not found' });
  }

  return student;
}

async function loadSpendBalance(
  store: Pick<AppContext['db'], 'meritLedger'>,
  studentId: string,
): Promise<number> {
  const result = await store.meritLedger.aggregate({
    where: { studentId, account: 'Spend' },
    _sum: { delta: true },
  });
  return result._sum.delta ?? 0;
}

async function loadSpendBalances(
  ctx: AuthedContext,
  studentIds: readonly string[],
): Promise<ReadonlyMap<string, number>> {
  if (studentIds.length === 0) return new Map();

  const balances = await ctx.db.meritLedger.groupBy({
    by: ['studentId'],
    where: { studentId: { in: [...studentIds] }, account: 'Spend' },
    _sum: { delta: true },
  });

  return new Map(balances.map((row) => [row.studentId, row._sum.delta ?? 0]));
}

async function loadSoldCountByItemId(
  ctx: AuthedContext,
  itemIds: readonly string[],
): Promise<ReadonlyMap<string, number>> {
  if (itemIds.length === 0) return new Map();

  const soldRows = await ctx.db.shopPurchase.findMany({
    where: { itemId: { in: [...itemIds] } },
    select: { itemId: true, unitsBought: true },
  });

  const soldCountByItemId = new Map<string, number>();
  for (const row of soldRows) {
    soldCountByItemId.set(row.itemId, (soldCountByItemId.get(row.itemId) ?? 0) + row.unitsBought);
  }
  return soldCountByItemId;
}

function aggregateReservationLines(lines: readonly ReservationLineRequest[]) {
  const totals = new Map<string, number>();
  for (const line of lines) {
    totals.set(line.itemId, (totals.get(line.itemId) ?? 0) + line.unitsReserved);
  }
  return [...totals].map(([itemId, unitsReserved]) => ({ itemId, unitsReserved }));
}

async function auditPurchaserListDecrypt(ctx: AuthedContext, count: number): Promise<void> {
  await ctx.db.auditLog.create({
    data: {
      userId: ctx.user.id,
      action: 'DecryptPii',
      entity: 'Student',
      meta: { count, source: 'shop.listPurchasers' },
    },
  });
}

async function auditReservationListDecrypt(ctx: AuthedContext, count: number): Promise<void> {
  if (count === 0) return;
  await ctx.db.auditLog.create({
    data: {
      userId: ctx.user.id,
      action: 'DecryptPii',
      entity: 'Student',
      meta: { count, source: 'shop.listReservations' },
    },
  });
}

async function auditRejectedPurchase(
  ctx: AuthedContext,
  input: { studentId: string; itemId: string; unitsBought: number },
  reason: string,
): Promise<void> {
  await ctx.db.auditLog.create({
    data: {
      userId: ctx.user.id,
      action: 'Update',
      entity: 'ShopPurchase',
      entityId: input.studentId,
      meta: {
        source: 'shop.purchase',
        outcome: 'Rejected',
        reason,
        itemId: input.itemId,
        unitsBought: input.unitsBought,
      },
    },
  });
}

function purchaseRejection(err: unknown): string {
  if (!(err instanceof Error)) return 'InvalidPurchase';
  if (err.message.includes('inactive')) return 'ItemInactive';
  if (err.message.includes('stock')) return 'InsufficientStock';
  if (err.message.includes('balance')) return 'InsufficientSpend';
  return err.message;
}

function planError(err: unknown): never {
  throw new TRPCError({
    code: 'BAD_REQUEST',
    message: err instanceof Error ? err.message : 'invalid shop reservation',
    cause: err instanceof Error ? err : undefined,
  });
}

function ledgerWithReservationId(plan: ReservationResult, reservationId: string) {
  return plan.ledger.map((row) => ({
    ...row,
    reason: row.reason.replace('shop-reservation:hold', `shop-reservation:${reservationId}:hold`),
  }));
}

async function loadReservationById(
  ctx: AuthedContext,
  reservationId: string,
): Promise<ReservationRow> {
  const reservation = await ctx.db.shopReservation.findUnique({
    where: { id: reservationId },
    include: reservationInclude,
  });
  if (!reservation) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'shop reservation not found' });
  }
  return reservation;
}

export const shopRouter = router({
  listItems: authedProcedure.input(listItemsInput).query(async ({ ctx, input }) => {
    const includeInactive = input?.includeInactive ?? false;

    if (includeInactive) {
      await requireCanManageShop(ctx, 'shop.listItems');
    }
    if (ctx.user.role === 'Student') {
      const student = await loadOwnActiveStudent(ctx);
      await assertStudentPortalUnlocked(ctx, { entity: 'shop.listItems', studentId: student.id });
    }

    const items = (await ctx.db.shopItem.findMany({
      where: includeInactive ? {} : { active: true },
      orderBy: [{ active: 'desc' }, { category: 'asc' }, { name: 'asc' }],
      select: itemSelect,
    })) as ShopItemRow[];
    const soldCountByItemId = await loadSoldCountByItemId(
      ctx,
      items.map((item) => item.id),
    );

    return items.map((item) => mapItem(item, soldCountByItemId.get(item.id) ?? 0));
  }),

  listPurchasers: authedProcedure.query(async ({ ctx }) => {
    await requireCanSellInShop(ctx, 'shop.listPurchasers');

    const students = await ctx.db.student.findMany({
      where: { active: true },
      orderBy: { createdAt: 'desc' },
      select: { id: true, fullNameEnc: true, yearGroup: true },
    });
    const spendBalanceByStudentId = await loadSpendBalances(
      ctx,
      students.map((student) => student.id),
    );

    const rows = students.map((student) => ({
      id: student.id,
      fullName: decryptStudentName(ctx, student),
      yearGroup: student.yearGroup,
      spendBalance: spendBalanceByStudentId.get(student.id) ?? 0,
    }));

    await auditPurchaserListDecrypt(ctx, rows.length);
    return rows satisfies ShopPurchaserDto[];
  }),

  listReservations: authedProcedure.input(listReservationsInput).query(async ({ ctx, input }) => {
    const baseWhere = requireReservationListAccess(ctx);
    if (ctx.user.role === 'Student') {
      const student = await loadOwnActiveStudent(ctx);
      await assertStudentPortalUnlocked(ctx, {
        entity: 'shop.listReservations',
        studentId: student.id,
      });
    }
    const where: Prisma.ShopReservationWhereInput = {
      ...baseWhere,
      ...(input?.status ? { status: input.status } : {}),
    };

    const reservations = (await ctx.db.shopReservation.findMany({
      where,
      include: reservationInclude,
      orderBy: { createdAt: 'desc' },
    })) as ReservationRow[];
    const rows = reservations.map((reservation) => mapReservation(ctx, reservation));
    await auditReservationListDecrypt(ctx, rows.length);
    return rows satisfies ShopReservationDto[];
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
        category: draft.category,
        blurb: draft.blurb ?? null,
        description: draft.description ?? null,
        priceExVat: draft.priceExVat,
        vatRatePct: draft.vatRatePct,
        priceIncVat: draft.priceIncVat,
        stockCount: draft.stockCount,
        lowStockThreshold: draft.lowStockThreshold,
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
          category: item.category,
          priceIncVat: item.priceIncVat,
          stockCount: item.stockCount,
          active: item.active,
        },
      },
    });

    return mapItem(item, 0);
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
    const clearBlurb = input.blurb === null;
    const clearDescription = input.description === null;
    try {
      draft = validateDraft(
        draftInput({
          name: input.name ?? existing.name,
          photoUrl: input.photoUrl ?? existing.photoUrl ?? undefined,
          category: input.category ?? existing.category,
          blurb: clearBlurb ? undefined : (input.blurb ?? existing.blurb ?? undefined),
          description: clearDescription
            ? undefined
            : (input.description ?? existing.description ?? undefined),
          priceExVat: input.priceExVat ?? existing.priceExVat,
          vatRatePct: input.vatRatePct ?? existing.vatRatePct,
          stockCount: input.stockCount ?? existing.stockCount,
          lowStockThreshold: input.lowStockThreshold ?? existing.lowStockThreshold,
        }),
      );
    } catch (err) {
      toBadRequest(err);
    }

    const item = await ctx.db.shopItem.update({
      where: { id: input.id },
      data: {
        name: draft.name,
        photoUrl: draft.photoUrl ?? null,
        category: draft.category,
        blurb: clearBlurb ? null : (draft.blurb ?? null),
        description: clearDescription ? null : (draft.description ?? null),
        priceExVat: draft.priceExVat,
        vatRatePct: draft.vatRatePct,
        priceIncVat: draft.priceIncVat,
        stockCount: draft.stockCount,
        lowStockThreshold: draft.lowStockThreshold,
        active: input.active ?? existing.active,
      },
      select: itemSelect,
    });
    const soldCountByItemId = await loadSoldCountByItemId(ctx, [item.id]);

    await ctx.db.auditLog.create({
      data: {
        userId: ctx.user.id,
        action: existing.active && !item.active ? 'Delete' : 'Update',
        entity: 'ShopItem',
        entityId: item.id,
        meta: {
          source: 'shop.updateItem',
          name: item.name,
          category: item.category,
          priceIncVat: item.priceIncVat,
          stockCount: item.stockCount,
          active: item.active,
          previousActive: existing.active,
        },
      },
    });

    return mapItem(item, soldCountByItemId.get(item.id) ?? 0);
  }),

  prepareItemPhotoUpload: authedProcedure
    .input(prepareItemPhotoUploadInput)
    .mutation(async ({ ctx, input }) => {
      await requireCanUploadShopItemPhoto(ctx, 'shop.prepareItemPhotoUpload');
      const photo = prepareShopItemPhoto(input.photo, ctx.user.id);
      return {
        ...photo,
        publicUrl: publicStorageObjectUrl(photo.storageBucket, photo.storagePath),
      };
    }),

  updateItemPhoto: authedProcedure.input(updateItemPhotoInput).mutation(async ({ ctx, input }) => {
    await requireCanUploadShopItemPhoto(ctx, 'shop.updateItemPhoto', input.id);

    const existing = await ctx.db.shopItem.findUnique({
      where: { id: input.id },
      select: itemSelect,
    });
    if (!existing) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'shop item not found' });
    }

    const photo = validateUploadedShopItemPhoto(input.photo, ctx.user.id);
    await assertUploadedShopItemPhoto(photo);
    const photoUrl = publicStorageObjectUrl(photo.storageBucket, photo.storagePath);

    const item = await ctx.db.shopItem.update({
      where: { id: input.id },
      data: { photoUrl },
      select: itemSelect,
    });
    const soldCountByItemId = await loadSoldCountByItemId(ctx, [item.id]);

    await ctx.db.auditLog.create({
      data: {
        userId: ctx.user.id,
        action: 'Update',
        entity: 'ShopItem',
        entityId: item.id,
        meta: {
          source: 'shop.updateItemPhoto',
          storageBucket: photo.storageBucket,
          storagePath: photo.storagePath,
          sizeBytes: photo.sizeBytes,
          mimeType: photo.mimeType,
        },
      },
    });

    return mapItem(item, soldCountByItemId.get(item.id) ?? 0);
  }),

  reserve: authedProcedure.input(reserveInput).mutation(async ({ ctx, input }) => {
    const student = await loadActiveStudent(ctx, input.studentId);
    await requireCanReserveForStudent(ctx, student);
    await assertStudentMeritShopAccess(ctx, { entity: 'shop.reserve', studentId: student.id });
    const requestedLines = aggregateReservationLines(input.lines);

    const reservationId = await ctx.db.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const items = await tx.shopItem.findMany({
          where: { id: { in: requestedLines.map((line) => line.itemId) } },
          select: { id: true, priceIncVat: true, stockCount: true, active: true },
        });
        const itemById = new Map(items.map((item) => [item.id, item]));
        if (itemById.size !== requestedLines.length) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'shop item not found' });
        }

        let plan: ReservationResult;
        try {
          plan = prepareShopReservation({
            studentId: student.id,
            spendBalance: await loadSpendBalance(tx, student.id),
            lines: requestedLines.map((line) => ({
              item: itemById.get(line.itemId) as PurchaseItemRow,
              unitsReserved: line.unitsReserved,
            })),
          });
        } catch (err) {
          planError(err);
        }

        for (const line of plan.lines) {
          const stockUpdate = await tx.shopItem.updateMany({
            where: {
              id: line.itemId,
              active: true,
              stockCount: { gte: line.unitsReserved },
            },
            data: { stockCount: { decrement: line.unitsReserved } },
          });
          if (stockUpdate.count !== 1) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'insufficient stock' });
          }
        }

        const reservation = await tx.shopReservation.create({
          data: {
            studentId: student.id,
            reservedById: ctx.user.id,
            totalPriceMerits: plan.totalPriceMerits,
          },
          select: { id: true },
        });

        await tx.shopReservationLine.createMany({
          data: plan.lines.map((line) => ({
            reservationId: reservation.id,
            itemId: line.itemId,
            unitsReserved: line.unitsReserved,
            unitPriceMerits: line.unitPriceMerits,
            totalPriceMerits: line.totalPriceMerits,
          })),
        });
        await tx.meritLedger.createMany({
          data: ledgerWithReservationId(plan, reservation.id),
        });
        await tx.auditLog.create({
          data: {
            userId: ctx.user.id,
            action: 'Create',
            entity: 'ShopReservation',
            entityId: reservation.id,
            meta: {
              source: 'shop.reserve',
              studentId: student.id,
              totalPriceMerits: plan.totalPriceMerits,
              lines: plan.lines.map((line) => ({
                itemId: line.itemId,
                unitsReserved: line.unitsReserved,
              })),
            },
          },
        });

        return reservation.id;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    const reservation = await loadReservationById(ctx, reservationId);
    return mapReservation(ctx, reservation);
  }),

  collectReservation: authedProcedure.input(reservationIdInput).mutation(async ({ ctx, input }) => {
    await requireCanSellInShop(ctx, 'shop.collectReservation', input.reservationId);
    const existing = await ctx.db.shopReservation.findUnique({
      where: { id: input.reservationId },
      select: { studentId: true, status: true },
    });
    if (!existing) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'shop reservation not found' });
    }
    if (existing.status !== 'Ready') {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'reservation is not ready' });
    }
    await assertStudentMeritShopAccess(ctx, {
      entity: 'shop.collectReservation',
      studentId: existing.studentId,
    });

    await ctx.db.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const reservation = await tx.shopReservation.findUnique({
          where: { id: input.reservationId },
          include: { lines: true },
        });
        if (!reservation) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'shop reservation not found' });
        }
        if (reservation.status !== 'Ready') {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'reservation is not ready' });
        }

        const statusUpdate = await tx.shopReservation.updateMany({
          where: { id: reservation.id, status: 'Ready' },
          data: { status: 'Collected', collectedAt: new Date(), collectedById: ctx.user.id },
        });
        if (statusUpdate.count !== 1) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'reservation is not ready' });
        }

        await tx.shopPurchase.createMany({
          data: reservation.lines.map((line) => ({
            studentId: reservation.studentId,
            itemId: line.itemId,
            unitsBought: line.unitsReserved,
            totalPriceMerits: line.totalPriceMerits,
            shopkeeperId: ctx.user.id,
          })),
        });
        await tx.meritLedger.createMany({
          data: rowsForReservationCollection({
            studentId: reservation.studentId,
            reservationId: reservation.id,
            totalPriceMerits: reservation.totalPriceMerits,
          }),
        });
        await tx.auditLog.create({
          data: {
            userId: ctx.user.id,
            action: 'Update',
            entity: 'ShopReservation',
            entityId: reservation.id,
            meta: {
              source: 'shop.collectReservation',
              studentId: reservation.studentId,
              totalPriceMerits: reservation.totalPriceMerits,
            },
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    const reservation = await loadReservationById(ctx, input.reservationId);
    return mapReservation(ctx, reservation);
  }),

  cancelReservation: authedProcedure.input(reservationIdInput).mutation(async ({ ctx, input }) => {
    const existing = await ctx.db.shopReservation.findUnique({
      where: { id: input.reservationId },
      include: { student: { select: { id: true, userId: true } } },
    });
    if (!existing) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'shop reservation not found' });
    }
    await requireCanCancelReservation(ctx, existing);

    await ctx.db.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const reservation = await tx.shopReservation.findUnique({
          where: { id: input.reservationId },
          include: { lines: true },
        });
        if (!reservation) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'shop reservation not found' });
        }
        if (reservation.status !== 'Ready') {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'reservation is not ready' });
        }

        const statusUpdate = await tx.shopReservation.updateMany({
          where: { id: reservation.id, status: 'Ready' },
          data: { status: 'Cancelled', cancelledAt: new Date(), cancelledById: ctx.user.id },
        });
        if (statusUpdate.count !== 1) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'reservation is not ready' });
        }

        for (const line of reservation.lines) {
          await tx.shopItem.update({
            where: { id: line.itemId },
            data: { stockCount: { increment: line.unitsReserved } },
          });
        }
        await tx.meritLedger.createMany({
          data: rowsForReservationCancellation({
            studentId: reservation.studentId,
            reservationId: reservation.id,
            totalPriceMerits: reservation.totalPriceMerits,
          }),
        });
        await tx.auditLog.create({
          data: {
            userId: ctx.user.id,
            action: 'Update',
            entity: 'ShopReservation',
            entityId: reservation.id,
            meta: {
              source: 'shop.cancelReservation',
              studentId: reservation.studentId,
              totalPriceMerits: reservation.totalPriceMerits,
            },
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    const reservation = await loadReservationById(ctx, input.reservationId);
    return mapReservation(ctx, reservation);
  }),

  purchase: authedProcedure
    .input(
      z.object({
        studentId: z.string().cuid(),
        itemId: z.string().cuid(),
        unitsBought: z.number().int().positive(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireCanSellInShop(ctx, 'shop.purchase', input.studentId);
      const student = await loadActiveStudent(ctx, input.studentId);
      await assertStudentMeritShopAccess(ctx, { entity: 'shop.purchase', studentId: student.id });

      const result = await ctx.db.$transaction(
        async (tx: Prisma.TransactionClient) => {
          const item = await tx.shopItem.findUnique({
            where: { id: input.itemId },
            select: { id: true, priceIncVat: true, stockCount: true, active: true },
          });

          if (!item) {
            return { ok: false as const, code: 'NOT_FOUND' as const, reason: 'ItemNotFound' };
          }

          const spendBalance = await loadSpendBalance(tx, student.id);
          let purchasePlan: ReturnType<typeof prepareShopPurchase>;

          try {
            purchasePlan = prepareShopPurchase({
              shopkeeper: ctx.user,
              studentId: student.id,
              item: item satisfies PurchaseItemRow,
              unitsBought: input.unitsBought,
              spendBalance,
            });
          } catch (err) {
            return {
              ok: false as const,
              code: 'BAD_REQUEST' as const,
              reason: purchaseRejection(err),
            };
          }

          const stockUpdate = await tx.shopItem.updateMany({
            where: {
              id: item.id,
              active: true,
              stockCount: { gte: input.unitsBought },
            },
            data: { stockCount: { decrement: input.unitsBought } },
          });

          if (stockUpdate.count !== 1) {
            return {
              ok: false as const,
              code: 'BAD_REQUEST' as const,
              reason: 'InsufficientStock',
            };
          }

          const purchase = await tx.shopPurchase.create({
            data: {
              studentId: student.id,
              itemId: item.id,
              unitsBought: input.unitsBought,
              totalPriceMerits: purchasePlan.totalPriceMerits,
              shopkeeperId: ctx.user.id,
            },
            select: {
              id: true,
              studentId: true,
              itemId: true,
              unitsBought: true,
              totalPriceMerits: true,
              createdAt: true,
            },
          });

          await tx.meritLedger.createMany({ data: purchasePlan.ledger });
          await tx.auditLog.create({
            data: {
              userId: ctx.user.id,
              action: 'Create',
              entity: 'ShopPurchase',
              entityId: purchase.id,
              meta: {
                source: 'shop.purchase',
                studentId: student.id,
                itemId: item.id,
                unitsBought: input.unitsBought,
                totalPriceMerits: purchasePlan.totalPriceMerits,
              },
            },
          });

          return {
            ok: true as const,
            purchase,
            remainingStockCount: purchasePlan.newStockCount,
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );

      if (!result.ok) {
        await auditRejectedPurchase(ctx, input, result.reason);
        throw new TRPCError({
          code: result.code,
          message:
            result.reason === 'ItemNotFound'
              ? 'shop item not found'
              : result.reason === 'ItemInactive'
                ? 'shop item is inactive'
                : result.reason === 'InsufficientSpend'
                  ? 'insufficient spend balance'
                  : 'insufficient stock',
        });
      }

      return {
        id: result.purchase.id,
        studentId: result.purchase.studentId,
        itemId: result.purchase.itemId,
        unitsBought: result.purchase.unitsBought,
        totalPriceMerits: result.purchase.totalPriceMerits,
        remainingStockCount: result.remainingStockCount,
        createdAt: result.purchase.createdAt,
      } satisfies ShopPurchaseDto;
    }),
});
