CREATE TYPE "ChildRegistrationPromptStatus" AS ENUM ('Unanswered', 'NoChildren', 'HasChildren');

ALTER TABLE "User"
  ADD COLUMN "childRegistrationPromptStatus" "ChildRegistrationPromptStatus" NOT NULL DEFAULT 'Unanswered',
  ADD COLUMN "childRegistrationPromptAnsweredAt" TIMESTAMP(3);
