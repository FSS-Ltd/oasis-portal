CREATE TYPE "LibraryReminderStage" AS ENUM ('DueInTwoDays', 'DueToday', 'OverdueOneDay');
CREATE TYPE "LibraryReminderEmailStatus" AS ENUM ('Pending', 'Sent', 'Failed', 'NoEmail');

CREATE TABLE "LibraryBook" (
  "id" TEXT NOT NULL,
  "barcode" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "author" TEXT NOT NULL,
  "coverUrl" TEXT NOT NULL,
  "coverBucket" TEXT NOT NULL,
  "coverPath" TEXT NOT NULL,
  "coverMimeType" TEXT NOT NULL,
  "coverSizeBytes" INTEGER NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT NOT NULL,
  "updatedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LibraryBook_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LibraryBook_barcode_key" UNIQUE ("barcode"),
  CONSTRAINT "LibraryBook_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "LibraryBook_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "LibraryLoan" (
  "id" TEXT NOT NULL,
  "bookId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "checkedOutById" TEXT NOT NULL,
  "checkedOutAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dueOn" DATE NOT NULL,
  "returnedAt" TIMESTAMP(3),
  "returnedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LibraryLoan_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LibraryLoan_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "LibraryBook"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "LibraryLoan_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "LibraryLoan_checkedOutById_fkey" FOREIGN KEY ("checkedOutById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "LibraryLoan_returnedById_fkey" FOREIGN KEY ("returnedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "LibraryEmailReminder" (
  "id" TEXT NOT NULL,
  "loanId" TEXT NOT NULL,
  "recipientUserId" TEXT NOT NULL,
  "stage" "LibraryReminderStage" NOT NULL,
  "status" "LibraryReminderEmailStatus" NOT NULL DEFAULT 'Pending',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "emailMessageId" TEXT,
  "emailSentAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LibraryEmailReminder_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LibraryEmailReminder_loanId_recipientUserId_stage_key" UNIQUE ("loanId", "recipientUserId", "stage"),
  CONSTRAINT "LibraryEmailReminder_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "LibraryLoan"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "LibraryEmailReminder_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "LibraryBook_active_title_idx" ON "LibraryBook"("active", "title");
CREATE INDEX "LibraryBook_active_author_idx" ON "LibraryBook"("active", "author");
CREATE INDEX "LibraryLoan_bookId_returnedAt_idx" ON "LibraryLoan"("bookId", "returnedAt");
CREATE INDEX "LibraryLoan_studentId_returnedAt_dueOn_idx" ON "LibraryLoan"("studentId", "returnedAt", "dueOn");
CREATE INDEX "LibraryLoan_dueOn_returnedAt_idx" ON "LibraryLoan"("dueOn", "returnedAt");
CREATE INDEX "LibraryEmailReminder_recipientUserId_createdAt_idx" ON "LibraryEmailReminder"("recipientUserId", "createdAt");
CREATE UNIQUE INDEX "LibraryLoan_one_open_loan_per_book" ON "LibraryLoan"("bookId") WHERE "returnedAt" IS NULL;

ALTER TABLE "LibraryBook" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LibraryBook" FORCE ROW LEVEL SECURITY;
ALTER TABLE "LibraryLoan" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LibraryLoan" FORCE ROW LEVEL SECURITY;
ALTER TABLE "LibraryEmailReminder" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LibraryEmailReminder" FORCE ROW LEVEL SECURITY;

CREATE POLICY library_book_librarian_all ON "LibraryBook" FOR ALL
  USING (EXISTS (SELECT 1 FROM "User" u WHERE u."id" = current_setting('app.user_id', true) AND u."active" = true AND u."tags" @> ARRAY['librarian']::text[] AND current_setting('app.user_role', true) NOT IN ('Parent', 'Student')))
  WITH CHECK (EXISTS (SELECT 1 FROM "User" u WHERE u."id" = current_setting('app.user_id', true) AND u."active" = true AND u."tags" @> ARRAY['librarian']::text[] AND current_setting('app.user_role', true) NOT IN ('Parent', 'Student')));

CREATE POLICY library_loan_librarian_all ON "LibraryLoan" FOR ALL
  USING (EXISTS (SELECT 1 FROM "User" u WHERE u."id" = current_setting('app.user_id', true) AND u."active" = true AND u."tags" @> ARRAY['librarian']::text[] AND current_setting('app.user_role', true) NOT IN ('Parent', 'Student')))
  WITH CHECK (EXISTS (SELECT 1 FROM "User" u WHERE u."id" = current_setting('app.user_id', true) AND u."active" = true AND u."tags" @> ARRAY['librarian']::text[] AND current_setting('app.user_role', true) NOT IN ('Parent', 'Student')));

CREATE POLICY library_loan_guardian_select ON "LibraryLoan" FOR SELECT
  USING (EXISTS (SELECT 1 FROM "Guardian" g WHERE g."studentId" = "LibraryLoan"."studentId" AND g."userId" = current_setting('app.user_id', true)));

CREATE POLICY library_book_guardian_select ON "LibraryBook" FOR SELECT
  USING (EXISTS (SELECT 1 FROM "LibraryLoan" l JOIN "Guardian" g ON g."studentId" = l."studentId" WHERE l."bookId" = "LibraryBook"."id" AND g."userId" = current_setting('app.user_id', true)));

CREATE POLICY library_reminder_librarian_all ON "LibraryEmailReminder" FOR ALL
  USING (EXISTS (SELECT 1 FROM "User" u WHERE u."id" = current_setting('app.user_id', true) AND u."active" = true AND u."tags" @> ARRAY['librarian']::text[] AND current_setting('app.user_role', true) NOT IN ('Parent', 'Student')))
  WITH CHECK (EXISTS (SELECT 1 FROM "User" u WHERE u."id" = current_setting('app.user_id', true) AND u."active" = true AND u."tags" @> ARRAY['librarian']::text[] AND current_setting('app.user_role', true) NOT IN ('Parent', 'Student')));

CREATE POLICY library_reminder_recipient_select ON "LibraryEmailReminder" FOR SELECT
  USING ("recipientUserId" = current_setting('app.user_id', true));
