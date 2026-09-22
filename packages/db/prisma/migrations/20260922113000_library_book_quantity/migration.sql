ALTER TABLE "LibraryBook"
  ADD COLUMN "quantity" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "LibraryBook"
  ADD CONSTRAINT "LibraryBook_quantity_check" CHECK ("quantity" >= 1);
