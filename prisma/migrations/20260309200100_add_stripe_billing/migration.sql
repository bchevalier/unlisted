-- CreateEnum
CREATE TYPE "StripeSubscriptionStatus" AS ENUM ('ACTIVE', 'PAST_DUE', 'CANCELED', 'INCOMPLETE', 'INCOMPLETE_EXPIRED', 'TRIALING', 'UNPAID', 'PAUSED');

-- AlterTable: User — add Stripe customer id
ALTER TABLE "User" ADD COLUMN "stripeCustomerId" TEXT;

-- AlterTable: Door — add Stripe subscription fields
ALTER TABLE "Door" ADD COLUMN "stripeSubscriptionId" TEXT;
ALTER TABLE "Door" ADD COLUMN "stripeSubscriptionStatus" "StripeSubscriptionStatus";
ALTER TABLE "Door" ADD COLUMN "stripePriceId" TEXT;
ALTER TABLE "Door" ADD COLUMN "stripeCurrentPeriodEnd" TIMESTAMP(3);

-- CreateTable: Payment
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stripePaymentId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "status" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_stripeCustomerId_key" ON "User"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "Door_stripeSubscriptionId_key" ON "Door"("stripeSubscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_stripePaymentId_key" ON "Payment"("stripePaymentId");

-- CreateIndex
CREATE INDEX "Payment_userId_createdAt_idx" ON "Payment"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
