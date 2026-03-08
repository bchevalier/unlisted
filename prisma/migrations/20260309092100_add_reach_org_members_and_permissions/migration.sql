-- CreateEnum
CREATE TYPE "ReachOrgRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "ReachPermission" AS ENUM ('ACTOR_READ', 'ACTOR_UPDATE', 'ACTOR_DEACTIVATE', 'KEY_ROTATE', 'POLICY_READ', 'POLICY_WRITE', 'CONTRACT_PROPOSE', 'CONTRACT_READ', 'CONTRACT_ACT', 'ORG_MEMBERS_READ', 'ORG_MEMBERS_WRITE');

-- CreateTable
CREATE TABLE "ReachOrgMember" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "role" "ReachOrgRole" NOT NULL DEFAULT 'MEMBER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReachOrgMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReachOrgMember_orgId_memberId_key" ON "ReachOrgMember"("orgId", "memberId");

-- CreateIndex
CREATE INDEX "ReachOrgMember_orgId_isActive_role_idx" ON "ReachOrgMember"("orgId", "isActive", "role");

-- CreateIndex
CREATE INDEX "ReachOrgMember_memberId_isActive_idx" ON "ReachOrgMember"("memberId", "isActive");

-- AddForeignKey
ALTER TABLE "ReachOrgMember" ADD CONSTRAINT "ReachOrgMember_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "ReachActor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReachOrgMember" ADD CONSTRAINT "ReachOrgMember_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "ReachActor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
