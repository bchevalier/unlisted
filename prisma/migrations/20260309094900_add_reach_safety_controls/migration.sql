-- CreateEnum
CREATE TYPE "ReachAbuseReportReason" AS ENUM ('SPAM', 'HARASSMENT', 'IMPERSONATION', 'PHISHING', 'OTHER');

-- CreateEnum
CREATE TYPE "ReachAbuseReportStatus" AS ENUM ('OPEN', 'REVIEWED', 'DISMISSED');

-- CreateTable
CREATE TABLE "ReachBlockedActor" (
    "id" TEXT NOT NULL,
    "blockerId" TEXT NOT NULL,
    "blockedId" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReachBlockedActor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReachAbuseReport" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "reason" "ReachAbuseReportReason" NOT NULL,
    "description" TEXT,
    "status" "ReachAbuseReportStatus" NOT NULL DEFAULT 'OPEN',
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReachAbuseReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReachBlockedActor_blockerId_blockedId_key" ON "ReachBlockedActor"("blockerId", "blockedId");

-- CreateIndex
CREATE INDEX "ReachBlockedActor_blockedId_blockerId_idx" ON "ReachBlockedActor"("blockedId", "blockerId");

-- CreateIndex
CREATE UNIQUE INDEX "ReachAbuseReport_contractId_reporterId_key" ON "ReachAbuseReport"("contractId", "reporterId");

-- CreateIndex
CREATE INDEX "ReachAbuseReport_status_createdAt_idx" ON "ReachAbuseReport"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ReachAbuseReport_reporterId_createdAt_idx" ON "ReachAbuseReport"("reporterId", "createdAt");

-- AddForeignKey
ALTER TABLE "ReachBlockedActor" ADD CONSTRAINT "ReachBlockedActor_blockerId_fkey" FOREIGN KEY ("blockerId") REFERENCES "ReachActor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReachBlockedActor" ADD CONSTRAINT "ReachBlockedActor_blockedId_fkey" FOREIGN KEY ("blockedId") REFERENCES "ReachActor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReachAbuseReport" ADD CONSTRAINT "ReachAbuseReport_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "ReachContract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReachAbuseReport" ADD CONSTRAINT "ReachAbuseReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "ReachActor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
