BEGIN;

-- Keep the backfill and replacement of the single-copy guard atomic with circulation.
LOCK TABLE "LibraryBook", "LibraryLoan" IN ACCESS EXCLUSIVE MODE;
CREATE TYPE "LibraryBookCollection" AS ENUM ('General', 'RhinoReaders');
ALTER TABLE "LibraryBook" ADD COLUMN "collection" "LibraryBookCollection" NOT NULL DEFAULT 'General';
ALTER TABLE "LibraryBook" ADD COLUMN "loanedCopies" INTEGER NOT NULL DEFAULT 0;
UPDATE "LibraryBook" b SET "loanedCopies" = (
  SELECT count(*) FROM "LibraryLoan" l WHERE l."bookId" = b.id AND l."returnedAt" IS NULL
);
ALTER TABLE "LibraryBook" ADD CONSTRAINT "LibraryBook_copy_stock_check"
  CHECK ("loanedCopies" >= 0 AND "loanedCopies" <= quantity);
DROP INDEX "LibraryLoan_one_open_loan_per_book";

-- Invoker rights preserve existing RLS. Atomic row updates serialize competing loans.
CREATE FUNCTION public.library_adjust_copy_stock() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW."bookId" IS DISTINCT FROM OLD."bookId" THEN
    RAISE EXCEPTION 'A library loan cannot change books' USING ERRCODE = '23514';
  END IF;

  IF TG_OP <> 'INSERT' THEN
    IF OLD."returnedAt" IS NULL AND (TG_OP = 'DELETE' OR NEW."returnedAt" IS NOT NULL) THEN
      UPDATE public."LibraryBook" SET "loanedCopies" = "loanedCopies" - 1
        WHERE id = OLD."bookId";
    END IF;
  END IF;

  IF TG_OP <> 'DELETE' THEN
    IF NEW."returnedAt" IS NULL AND (TG_OP = 'INSERT' OR OLD."returnedAt" IS NOT NULL) THEN
      UPDATE public."LibraryBook" SET "loanedCopies" = "loanedCopies" + 1
        WHERE id = NEW."bookId" AND "loanedCopies" < quantity;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'No copies are available to check out' USING ERRCODE = '23514';
      END IF;
    END IF;
    RETURN NEW;
  END IF;
  RETURN OLD;
END;
$$;
REVOKE ALL ON FUNCTION public.library_adjust_copy_stock() FROM PUBLIC;
CREATE TRIGGER library_copy_stock
  BEFORE INSERT OR UPDATE OF "returnedAt", "bookId" OR DELETE ON "LibraryLoan"
  FOR EACH ROW EXECUTE FUNCTION public.library_adjust_copy_stock();

COMMIT;
