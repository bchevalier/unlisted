-- AlterTable: add ipHash to Request for IP-based rate limiting
ALTER TABLE "Request" ADD COLUMN "ipHash" TEXT;

-- CreateIndex: support IP-based rate limiting queries
CREATE INDEX "Request_doorId_ipHash_createdAt_idx" ON "Request"("doorId", "ipHash", "createdAt");

-- CreateIndex: support sender-email rate limiting queries on form submissions
CREATE INDEX "Request_doorId_senderEmail_createdAt_idx" ON "Request"("doorId", "senderEmail", "createdAt");

-- CreateTable: per-door blocked sender list
CREATE TABLE "DoorBlockedSender" (
    "id" TEXT NOT NULL,
    "doorId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DoorBlockedSender_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DoorBlockedSender_doorId_idx" ON "DoorBlockedSender"("doorId");

-- CreateIndex
CREATE UNIQUE INDEX "DoorBlockedSender_doorId_email_key" ON "DoorBlockedSender"("doorId", "email");

-- AddForeignKey
ALTER TABLE "DoorBlockedSender" ADD CONSTRAINT "DoorBlockedSender_doorId_fkey" FOREIGN KEY ("doorId") REFERENCES "Door"("id") ON DELETE CASCADE ON UPDATE CASCADE;
