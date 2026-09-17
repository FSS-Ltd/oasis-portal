CREATE TYPE "ParentEmailNotificationCategory" AS ENUM (
  'Message',
  'Behaviour',
  'Notice',
  'Club',
  'Report'
);

ALTER TABLE "User"
  ADD COLUMN "parentEmailNotificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "parentEmailNotificationOptOuts" "ParentEmailNotificationCategory"[] NOT NULL DEFAULT ARRAY[]::"ParentEmailNotificationCategory"[];
