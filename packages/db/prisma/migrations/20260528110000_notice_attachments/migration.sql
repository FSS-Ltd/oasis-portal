CREATE TABLE "StaffNoticeAttachment" (
    "id" TEXT NOT NULL,
    "noticeId" TEXT NOT NULL,
    "originalFileNameEnc" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageBucket" TEXT NOT NULL,
    "storagePathEnc" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffNoticeAttachment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StaffNoticeAttachment_noticeId_position_idx"
ON "StaffNoticeAttachment"("noticeId", "position");

ALTER TABLE "StaffNoticeAttachment"
ADD CONSTRAINT "StaffNoticeAttachment_noticeId_fkey"
FOREIGN KEY ("noticeId") REFERENCES "StaffNotice"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
