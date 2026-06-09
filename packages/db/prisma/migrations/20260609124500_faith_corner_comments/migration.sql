CREATE TYPE "FaithCornerCommentStatus" AS ENUM ('Pending', 'Approved', 'Rejected');

CREATE TABLE "FaithCornerContentLike" (
  "contentId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "FaithCornerContentLike_pkey" PRIMARY KEY ("contentId", "studentId")
);

CREATE TABLE "FaithCornerComment" (
  "id" TEXT NOT NULL,
  "contentId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "bodyEnc" TEXT NOT NULL,
  "status" "FaithCornerCommentStatus" NOT NULL DEFAULT 'Pending',
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "FaithCornerComment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FaithCornerCommentLike" (
  "commentId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "FaithCornerCommentLike_pkey" PRIMARY KEY ("commentId", "studentId")
);

CREATE INDEX "FaithCornerContentLike_studentId_createdAt_idx" ON "FaithCornerContentLike"("studentId", "createdAt");
CREATE INDEX "FaithCornerComment_contentId_status_createdAt_idx" ON "FaithCornerComment"("contentId", "status", "createdAt");
CREATE INDEX "FaithCornerComment_studentId_createdAt_idx" ON "FaithCornerComment"("studentId", "createdAt");
CREATE INDEX "FaithCornerComment_status_createdAt_idx" ON "FaithCornerComment"("status", "createdAt");
CREATE INDEX "FaithCornerComment_reviewedById_reviewedAt_idx" ON "FaithCornerComment"("reviewedById", "reviewedAt");
CREATE INDEX "FaithCornerCommentLike_studentId_createdAt_idx" ON "FaithCornerCommentLike"("studentId", "createdAt");

ALTER TABLE "FaithCornerContentLike"
  ADD CONSTRAINT "FaithCornerContentLike_contentId_fkey"
  FOREIGN KEY ("contentId") REFERENCES "FaithCornerContent"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FaithCornerContentLike"
  ADD CONSTRAINT "FaithCornerContentLike_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "Student"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FaithCornerComment"
  ADD CONSTRAINT "FaithCornerComment_contentId_fkey"
  FOREIGN KEY ("contentId") REFERENCES "FaithCornerContent"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FaithCornerComment"
  ADD CONSTRAINT "FaithCornerComment_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "Student"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FaithCornerComment"
  ADD CONSTRAINT "FaithCornerComment_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "FaithCornerCommentLike"
  ADD CONSTRAINT "FaithCornerCommentLike_commentId_fkey"
  FOREIGN KEY ("commentId") REFERENCES "FaithCornerComment"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FaithCornerCommentLike"
  ADD CONSTRAINT "FaithCornerCommentLike_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "Student"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
