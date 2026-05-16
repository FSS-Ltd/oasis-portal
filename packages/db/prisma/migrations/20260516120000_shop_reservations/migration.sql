ALTER TYPE "MeritAccount" ADD VALUE IF NOT EXISTS 'ShopReserved';

CREATE TYPE "ShopCategory" AS ENUM (
  'Treats',
  'Privileges',
  'Stationery',
  'Vouchers',
  'Merch',
  'Recognition'
);

CREATE TYPE "ShopReservationStatus" AS ENUM (
  'Ready',
  'Collected',
  'Cancelled'
);

ALTER TABLE "ShopItem"
  ADD COLUMN "category" "ShopCategory" NOT NULL DEFAULT 'Treats',
  ADD COLUMN "blurb" TEXT,
  ADD COLUMN "description" TEXT,
  ADD COLUMN "lowStockThreshold" INTEGER NOT NULL DEFAULT 5;

CREATE TABLE "ShopReservation" (
  "id" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "reservedById" TEXT NOT NULL,
  "status" "ShopReservationStatus" NOT NULL DEFAULT 'Ready',
  "totalPriceMerits" INTEGER NOT NULL,
  "collectedAt" TIMESTAMP(3),
  "collectedById" TEXT,
  "cancelledAt" TIMESTAMP(3),
  "cancelledById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ShopReservation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ShopReservationLine" (
  "id" TEXT NOT NULL,
  "reservationId" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "unitsReserved" INTEGER NOT NULL,
  "unitPriceMerits" INTEGER NOT NULL,
  "totalPriceMerits" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ShopReservationLine_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ShopItem_category_active_idx" ON "ShopItem"("category", "active");
CREATE INDEX "ShopPurchase_itemId_createdAt_idx" ON "ShopPurchase"("itemId", "createdAt");
CREATE INDEX "ShopReservation_status_createdAt_idx" ON "ShopReservation"("status", "createdAt");
CREATE INDEX "ShopReservation_studentId_status_idx" ON "ShopReservation"("studentId", "status");
CREATE INDEX "ShopReservation_reservedById_createdAt_idx" ON "ShopReservation"("reservedById", "createdAt");
CREATE INDEX "ShopReservation_collectedById_idx" ON "ShopReservation"("collectedById");
CREATE INDEX "ShopReservation_cancelledById_idx" ON "ShopReservation"("cancelledById");
CREATE INDEX "ShopReservationLine_reservationId_idx" ON "ShopReservationLine"("reservationId");
CREATE INDEX "ShopReservationLine_itemId_idx" ON "ShopReservationLine"("itemId");

ALTER TABLE "ShopReservation"
  ADD CONSTRAINT "ShopReservation_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ShopReservation"
  ADD CONSTRAINT "ShopReservation_reservedById_fkey"
  FOREIGN KEY ("reservedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ShopReservation"
  ADD CONSTRAINT "ShopReservation_collectedById_fkey"
  FOREIGN KEY ("collectedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ShopReservation"
  ADD CONSTRAINT "ShopReservation_cancelledById_fkey"
  FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ShopReservationLine"
  ADD CONSTRAINT "ShopReservationLine_reservationId_fkey"
  FOREIGN KEY ("reservationId") REFERENCES "ShopReservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ShopReservationLine"
  ADD CONSTRAINT "ShopReservationLine_itemId_fkey"
  FOREIGN KEY ("itemId") REFERENCES "ShopItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
