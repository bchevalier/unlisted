-- CreateEnum
CREATE TYPE "ReachSocialPlatform" AS ENUM ('YOUTUBE', 'INSTAGRAM', 'TIKTOK', 'FACEBOOK', 'X');

-- CreateEnum
CREATE TYPE "ReachSocialVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'FAILED');

-- CreateTable
CREATE TABLE "ReachSocialVerification" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "platform" "ReachSocialPlatform" NOT NULL,
    "status" "ReachSocialVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "handle" TEXT NOT NULL,
    "platformUserId" TEXT,
    "profileUrl" TEXT,
    "challengeToken" TEXT NOT NULL,
    "challengePhrase" TEXT NOT NULL,
    "followerCount" INTEGER,
    "followerCountUpdatedAt" TIMESTAMP(3),
    "bioSnapshot" TEXT,
    "failureReason" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "lastCheckedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReachSocialVerification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReachSocialVerification_actorId_platform_status_idx" ON "ReachSocialVerification"("actorId", "platform", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ReachSocialVerification_actorId_platform_handle_key" ON "ReachSocialVerification"("actorId", "platform", "handle");

-- AddForeignKey
ALTER TABLE "ReachSocialVerification" ADD CONSTRAINT "ReachSocialVerification_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "ReachActor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
