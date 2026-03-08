-- Add AWAITING_COMPLETION to RequestStatus enum
ALTER TYPE "RequestStatus" ADD VALUE 'AWAITING_COMPLETION';

-- Add completion token fields to Request
ALTER TABLE "Request" ADD COLUMN "completionToken" TEXT;
ALTER TABLE "Request" ADD COLUMN "completionExpiresAt" TIMESTAMP(3);

-- Unique index on completionToken (only non-null values)
CREATE UNIQUE INDEX "Request_completionToken_key" ON "Request"("completionToken") WHERE "completionToken" IS NOT NULL;

-- Index for looking up by completionToken
CREATE INDEX "Request_completionToken_status_idx" ON "Request"("completionToken", "status") WHERE "completionToken" IS NOT NULL;
