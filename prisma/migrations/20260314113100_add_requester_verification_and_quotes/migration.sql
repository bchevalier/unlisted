-- CreateEnum
CREATE TYPE "RequesterType" AS ENUM ('INDIVIDUAL', 'ORGANIZATION');

-- CreateEnum
CREATE TYPE "RequesterVerificationStatus" AS ENUM ('UNVERIFIED', 'BASIC_VERIFIED', 'ORG_VERIFIED');

-- AlterTable: Request — requester verification fields
ALTER TABLE "Request"
  ADD COLUMN "requesterType" "RequesterType" DEFAULT 'INDIVIDUAL',
  ADD COLUMN "requesterOrgName" TEXT,
  ADD COLUMN "requesterOrgWebsite" TEXT,
  ADD COLUMN "requesterRoleTitle" TEXT,
  ADD COLUMN "requesterVerificationStatus" "RequesterVerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
  ADD COLUMN "requesterVerificationReason" TEXT;

-- AlterTable: Request — quote snapshot fields
ALTER TABLE "Request"
  ADD COLUMN "keeperQuoteAmountCents" INTEGER,
  ADD COLUMN "keeperQuoteCurrency" TEXT,
  ADD COLUMN "keeperQuoteNote" TEXT;

-- AlterTable: DoorSettings — paid quote configuration
ALTER TABLE "DoorSettings"
  ADD COLUMN "paidQuoteAmountCents" INTEGER,
  ADD COLUMN "paidQuoteCurrency" TEXT,
  ADD COLUMN "paidQuoteNote" TEXT,
  ADD COLUMN "quoteVisibleToVerifiedOrgsOnly" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "openToNonTargetedPaidReach" BOOLEAN NOT NULL DEFAULT false;
