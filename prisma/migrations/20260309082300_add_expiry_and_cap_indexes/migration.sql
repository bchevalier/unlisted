-- Performance indexes for auto-expire queries and category cap enforcement.

-- Auto-expire: find PENDING requests older than cutoff (no doorId filter)
CREATE INDEX "Request_status_createdAt_idx" ON "Request"("status", "createdAt");

-- Auto-expire: find AWAITING_COMPLETION requests past completionExpiresAt
CREATE INDEX "Request_status_completionExpiresAt_idx" ON "Request"("status", "completionExpiresAt");

-- Category weekly cap enforcement: count by categoryId within time window
CREATE INDEX "Request_categoryId_createdAt_idx" ON "Request"("categoryId", "createdAt");
