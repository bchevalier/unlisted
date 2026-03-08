-- CreateEnum
CREATE TYPE "public"."AuthTokenType" AS ENUM ('EMAIL_VERIFICATION', 'PASSWORD_RESET', 'TWO_FACTOR_CHALLENGE');

-- CreateEnum
CREATE TYPE "public"."AuthActionType" AS ENUM ('SIGNUP', 'LOGIN', 'PASSWORD_RESET_REQUEST', 'EMAIL_VERIFICATION');

-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "emailVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "twoFactorSecret" TEXT;

-- CreateTable
CREATE TABLE "public"."AuthToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "public"."AuthTokenType" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TwoFactorRecoveryCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TwoFactorRecoveryCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AuthAttempt" (
    "id" TEXT NOT NULL,
    "action" "public"."AuthActionType" NOT NULL,
    "ipHash" TEXT,
    "email" TEXT,
    "success" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuthToken_userId_type_expiresAt_idx" ON "public"."AuthToken"("userId", "type", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "AuthToken_type_tokenHash_key" ON "public"."AuthToken"("type", "tokenHash");

-- CreateIndex
CREATE INDEX "TwoFactorRecoveryCode_userId_usedAt_idx" ON "public"."TwoFactorRecoveryCode"("userId", "usedAt");

-- CreateIndex
CREATE UNIQUE INDEX "TwoFactorRecoveryCode_userId_codeHash_key" ON "public"."TwoFactorRecoveryCode"("userId", "codeHash");

-- CreateIndex
CREATE INDEX "AuthAttempt_action_createdAt_idx" ON "public"."AuthAttempt"("action", "createdAt");

-- CreateIndex
CREATE INDEX "AuthAttempt_email_action_createdAt_idx" ON "public"."AuthAttempt"("email", "action", "createdAt");

-- CreateIndex
CREATE INDEX "AuthAttempt_ipHash_action_createdAt_idx" ON "public"."AuthAttempt"("ipHash", "action", "createdAt");

-- AddForeignKey
ALTER TABLE "public"."AuthToken" ADD CONSTRAINT "AuthToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TwoFactorRecoveryCode" ADD CONSTRAINT "TwoFactorRecoveryCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
