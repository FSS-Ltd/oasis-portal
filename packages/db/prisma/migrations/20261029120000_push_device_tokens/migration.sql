-- Devices that have turned on push notifications. Purely additive.
-- Access is enforced in the pushNotification router (rows are always scoped to ctx.user.id),
-- matching User, which also has no RLS policy.
CREATE TYPE "PushPlatform" AS ENUM ('Ios', 'Android');

CREATE TABLE "PushDeviceToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenEnc" TEXT NOT NULL,
    "tokenBidx" TEXT NOT NULL,
    "platform" "PushPlatform" NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PushDeviceToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PushDeviceToken_tokenBidx_key" ON "PushDeviceToken"("tokenBidx");
CREATE INDEX "PushDeviceToken_userId_idx" ON "PushDeviceToken"("userId");

ALTER TABLE "PushDeviceToken" ADD CONSTRAINT "PushDeviceToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Realtime: per-device rows are not shown to anyone, so the table is excluded from change capture.
INSERT INTO oasis_private.model_coverage (model,areas,audience) VALUES
('PushDeviceToken',ARRAY[]::text[],'excluded');
