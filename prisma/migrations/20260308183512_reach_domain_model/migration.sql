-- CreateEnum
CREATE TYPE "public"."ReachActorType" AS ENUM ('HUMAN', 'AI_AGENT', 'ORGANIZATION');

-- CreateEnum
CREATE TYPE "public"."ReachContractType" AS ENUM ('HUMAN_HUMAN', 'HUMAN_AI', 'AI_HUMAN', 'AI_AI');

-- CreateEnum
CREATE TYPE "public"."ReachContractStatus" AS ENUM ('PROPOSED', 'ACTIVE', 'FULFILLED', 'REJECTED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "public"."ReachPolicyAction" AS ENUM ('ACCEPT', 'REJECT', 'ROUTE', 'ESCALATE');

-- CreateEnum
CREATE TYPE "public"."ReachContractEventType" AS ENUM ('CREATED', 'ROUTED', 'ACCEPTED', 'REJECTED', 'FULFILLED', 'ESCALATED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."ReachContractEventActor" AS ENUM ('SYSTEM', 'INITIATOR', 'TARGET', 'ADMIN');

-- CreateTable
CREATE TABLE "public"."ReachActor" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "type" "public"."ReachActorType" NOT NULL,
    "handle" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "capabilities" JSONB,
    "endpoint" TEXT,
    "apiKeyHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReachActor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ReachPolicy" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "contractTypes" "public"."ReachContractType"[],
    "action" "public"."ReachPolicyAction" NOT NULL DEFAULT 'ACCEPT',
    "maxWeeklyInbound" INTEGER,
    "requireVerifiedSender" BOOLEAN NOT NULL DEFAULT false,
    "autoAcceptMatching" BOOLEAN NOT NULL DEFAULT false,
    "escalateToHuman" BOOLEAN NOT NULL DEFAULT false,
    "filters" JSONB,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReachPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ReachContract" (
    "id" TEXT NOT NULL,
    "type" "public"."ReachContractType" NOT NULL,
    "status" "public"."ReachContractStatus" NOT NULL DEFAULT 'PROPOSED',
    "initiatorId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "policyId" TEXT,
    "purpose" TEXT NOT NULL,
    "message" TEXT,
    "structuredData" JSONB,
    "responseData" JSONB,
    "routedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReachContract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ReachContractEvent" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "type" "public"."ReachContractEventType" NOT NULL,
    "actor" "public"."ReachContractEventActor" NOT NULL DEFAULT 'SYSTEM',
    "note" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReachContractEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReachActor_userId_key" ON "public"."ReachActor"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ReachActor_handle_key" ON "public"."ReachActor"("handle");

-- CreateIndex
CREATE INDEX "ReachActor_type_isActive_idx" ON "public"."ReachActor"("type", "isActive");

-- CreateIndex
CREATE INDEX "ReachPolicy_actorId_isActive_priority_idx" ON "public"."ReachPolicy"("actorId", "isActive", "priority");

-- CreateIndex
CREATE INDEX "ReachContract_initiatorId_status_createdAt_idx" ON "public"."ReachContract"("initiatorId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ReachContract_targetId_status_createdAt_idx" ON "public"."ReachContract"("targetId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ReachContract_status_expiresAt_idx" ON "public"."ReachContract"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "ReachContractEvent_contractId_createdAt_idx" ON "public"."ReachContractEvent"("contractId", "createdAt");

-- AddForeignKey
ALTER TABLE "public"."ReachActor" ADD CONSTRAINT "ReachActor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReachPolicy" ADD CONSTRAINT "ReachPolicy_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "public"."ReachActor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReachContract" ADD CONSTRAINT "ReachContract_initiatorId_fkey" FOREIGN KEY ("initiatorId") REFERENCES "public"."ReachActor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReachContract" ADD CONSTRAINT "ReachContract_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "public"."ReachActor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReachContract" ADD CONSTRAINT "ReachContract_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "public"."ReachPolicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReachContractEvent" ADD CONSTRAINT "ReachContractEvent_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "public"."ReachContract"("id") ON DELETE CASCADE ON UPDATE CASCADE;
