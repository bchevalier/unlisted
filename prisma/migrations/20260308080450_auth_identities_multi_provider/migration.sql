-- CreateEnum
CREATE TYPE "public"."AuthProvider" AS ENUM ('PASSWORD', 'GOOGLE', 'APPLE', 'LINKEDIN', 'PRIVY');

-- CreateTable
CREATE TABLE "public"."AuthIdentity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "public"."AuthProvider" NOT NULL,
    "providerSubject" TEXT NOT NULL,
    "providerEmail" TEXT,
    "walletAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuthIdentity_userId_provider_idx" ON "public"."AuthIdentity"("userId", "provider");

-- CreateIndex
CREATE INDEX "AuthIdentity_walletAddress_idx" ON "public"."AuthIdentity"("walletAddress");

-- CreateIndex
CREATE UNIQUE INDEX "AuthIdentity_provider_providerSubject_key" ON "public"."AuthIdentity"("provider", "providerSubject");

-- AddForeignKey
ALTER TABLE "public"."AuthIdentity" ADD CONSTRAINT "AuthIdentity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
