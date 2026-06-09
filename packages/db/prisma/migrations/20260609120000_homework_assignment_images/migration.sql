-- CreateTable
CREATE TABLE "HomeworkAssignmentImage" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "originalFileNameEnc" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageBucket" TEXT NOT NULL,
    "storagePathEnc" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HomeworkAssignmentImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HomeworkAssignmentImage_assignmentId_createdAt_idx" ON "HomeworkAssignmentImage"("assignmentId", "createdAt");

-- CreateIndex
CREATE INDEX "HomeworkAssignmentImage_uploadedById_createdAt_idx" ON "HomeworkAssignmentImage"("uploadedById", "createdAt");

-- AddForeignKey
ALTER TABLE "HomeworkAssignmentImage" ADD CONSTRAINT "HomeworkAssignmentImage_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "HomeworkAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeworkAssignmentImage" ADD CONSTRAINT "HomeworkAssignmentImage_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
