-- CreateTable
CREATE TABLE "ReachWebhook" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secretHash" TEXT,
    "events" "ReachContractEventType"[],
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReachWebhook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReachWebhookDelivery" (
    "id" TEXT NOT NULL,
    "webhookId" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "event" "ReachContractEventType" NOT NULL,
    "status" TEXT NOT NULL,
    "httpStatus" INTEGER,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "payload" JSONB,
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReachWebhookDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReachWebhook_actorId_isActive_idx" ON "ReachWebhook"("actorId", "isActive");

-- CreateIndex
CREATE INDEX "ReachWebhookDelivery_webhookId_createdAt_idx" ON "ReachWebhookDelivery"("webhookId", "createdAt");

-- CreateIndex
CREATE INDEX "ReachWebhookDelivery_contractId_event_idx" ON "ReachWebhookDelivery"("contractId", "event");

-- CreateIndex
CREATE INDEX "ReachWebhookDelivery_status_createdAt_idx" ON "ReachWebhookDelivery"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "ReachWebhook" ADD CONSTRAINT "ReachWebhook_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "ReachActor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReachWebhookDelivery" ADD CONSTRAINT "ReachWebhookDelivery_webhookId_fkey" FOREIGN KEY ("webhookId") REFERENCES "ReachWebhook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReachWebhookDelivery" ADD CONSTRAINT "ReachWebhookDelivery_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "ReachContract"("id") ON DELETE CASCADE ON UPDATE CASCADE;
