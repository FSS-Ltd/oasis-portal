-- CreateEnum
CREATE TYPE "UserInvitationStatus" AS ENUM ('Pending', 'Accepted');

-- CreateEnum
CREATE TYPE "UserInvitationEmailStatus" AS ENUM ('NotSent', 'Sent', 'Failed');

-- CreateTable
CREATE TABLE "UserInvitation" (
    "id" TEXT NOT NULL,
    "clerkInvitationId" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "emailEnc" TEXT NOT NULL,
    "emailBidx" TEXT NOT NULL,
    "status" "UserInvitationStatus" NOT NULL DEFAULT 'Pending',
    "emailStatus" "UserInvitationEmailStatus" NOT NULL DEFAULT 'NotSent',
    "emailMessageId" TEXT,
    "invitedById" TEXT NOT NULL,
    "acceptedUserId" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserInvitation_clerkInvitationId_key" ON "UserInvitation"("clerkInvitationId");

-- CreateIndex
CREATE INDEX "UserInvitation_emailBidx_status_idx" ON "UserInvitation"("emailBidx", "status");

-- CreateIndex
CREATE INDEX "UserInvitation_status_role_createdAt_idx" ON "UserInvitation"("status", "role", "createdAt");

-- CreateIndex
CREATE INDEX "UserInvitation_invitedById_createdAt_idx" ON "UserInvitation"("invitedById", "createdAt");

-- CreateIndex
CREATE INDEX "UserInvitation_acceptedUserId_idx" ON "UserInvitation"("acceptedUserId");

-- CreateIndex
CREATE UNIQUE INDEX "UserInvitation_pending_emailBidx_key" ON "UserInvitation"("emailBidx") WHERE "status" = 'Pending';

-- AddForeignKey
ALTER TABLE "UserInvitation" ADD CONSTRAINT "UserInvitation_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserInvitation" ADD CONSTRAINT "UserInvitation_acceptedUserId_fkey" FOREIGN KEY ("acceptedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
