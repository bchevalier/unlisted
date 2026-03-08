-- CreateEnum
CREATE TYPE "AbuseReportReason" AS ENUM ('SPAM', 'HARASSMENT', 'IMPERSONATION', 'PHISHING', 'OTHER');

-- CreateEnum
CREATE TYPE "AbuseReportStatus" AS ENUM ('OPEN', 'REVIEWED', 'DISMISSED');

-- CreateTable
CREATE TABLE "AbuseReport" (
    "id" TEXT NOT NULL,
    "requestId" TEXT,
    "doorId" TEXT,
    "reason" "AbuseReportReason" NOT NULL,
    "description" TEXT,
    "reporterEmail" TEXT,
    "ipHash" TEXT,
    "status" "AbuseReportStatus" NOT NULL DEFAULT 'OPEN',
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AbuseReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AbuseReport_status_createdAt_idx" ON "AbuseReport"("status", "createdAt");

-- CreateIndex
CREATE INDEX "AbuseReport_doorId_createdAt_idx" ON "AbuseReport"("doorId", "createdAt");

-- CreateIndex
CREATE INDEX "AbuseReport_requestId_idx" ON "AbuseReport"("requestId");

-- CreateIndex
CREATE INDEX "AbuseReport_ipHash_createdAt_idx" ON "AbuseReport"("ipHash", "createdAt");

-- AddForeignKey
ALTER TABLE "AbuseReport" ADD CONSTRAINT "AbuseReport_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbuseReport" ADD CONSTRAINT "AbuseReport_doorId_fkey" FOREIGN KEY ("doorId") REFERENCES "Door"("id") ON DELETE SET NULL ON UPDATE CASCADE;
