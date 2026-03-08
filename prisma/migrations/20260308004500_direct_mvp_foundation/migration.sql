-- CreateEnum
CREATE TYPE "public"."ContactRevealMethod" AS ENUM ('NONE', 'EMAIL', 'URL');

-- CreateEnum
CREATE TYPE "public"."CategoryFieldType" AS ENUM ('TEXT', 'TEXTAREA', 'NUMBER', 'URL', 'EMAIL');

-- CreateEnum
CREATE TYPE "public"."RequestSource" AS ENUM ('FORM', 'EMAIL');

-- CreateEnum
CREATE TYPE "public"."RequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "public"."RequestEventType" AS ENUM ('CREATED', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'AUTO_REPLIED');

-- CreateEnum
CREATE TYPE "public"."RequestEventActor" AS ENUM ('SYSTEM', 'KEEPER');

-- CreateTable
CREATE TABLE "public"."Door" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "headline" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Door_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DoorSettings" (
    "id" TEXT NOT NULL,
    "doorId" TEXT NOT NULL,
    "autoReplyEnabled" BOOLEAN NOT NULL DEFAULT false,
    "autoReplyMessage" TEXT,
    "weeklyRequestCap" INTEGER,
    "revealMethod" "public"."ContactRevealMethod" NOT NULL DEFAULT 'NONE',
    "revealValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DoorSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Category" (
    "id" TEXT NOT NULL,
    "doorId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "weeklyCap" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CategoryField" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" "public"."CategoryFieldType" NOT NULL DEFAULT 'TEXT',
    "required" BOOLEAN NOT NULL DEFAULT false,
    "placeholder" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CategoryField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."EmailAlias" (
    "id" TEXT NOT NULL,
    "doorId" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Request" (
    "id" TEXT NOT NULL,
    "doorId" TEXT NOT NULL,
    "categoryId" TEXT,
    "source" "public"."RequestSource" NOT NULL,
    "status" "public"."RequestStatus" NOT NULL DEFAULT 'PENDING',
    "senderName" TEXT,
    "senderEmail" TEXT,
    "title" TEXT,
    "message" TEXT NOT NULL,
    "structuredData" JSONB,
    "requestToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RequestEvent" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "type" "public"."RequestEventType" NOT NULL,
    "actor" "public"."RequestEventActor" NOT NULL DEFAULT 'SYSTEM',
    "note" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RequestEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Door_userId_key" ON "public"."Door"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Door_slug_key" ON "public"."Door"("slug");

-- CreateIndex
CREATE INDEX "Door_slug_isEnabled_idx" ON "public"."Door"("slug", "isEnabled");

-- CreateIndex
CREATE UNIQUE INDEX "DoorSettings_doorId_key" ON "public"."DoorSettings"("doorId");

-- CreateIndex
CREATE INDEX "Category_doorId_isEnabled_idx" ON "public"."Category"("doorId", "isEnabled");

-- CreateIndex
CREATE UNIQUE INDEX "Category_doorId_key_key" ON "public"."Category"("doorId", "key");

-- CreateIndex
CREATE INDEX "CategoryField_categoryId_sortOrder_idx" ON "public"."CategoryField"("categoryId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "CategoryField_categoryId_key_key" ON "public"."CategoryField"("categoryId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "EmailAlias_alias_key" ON "public"."EmailAlias"("alias");

-- CreateIndex
CREATE INDEX "EmailAlias_doorId_isEnabled_idx" ON "public"."EmailAlias"("doorId", "isEnabled");

-- CreateIndex
CREATE UNIQUE INDEX "Request_requestToken_key" ON "public"."Request"("requestToken");

-- CreateIndex
CREATE INDEX "Request_doorId_status_createdAt_idx" ON "public"."Request"("doorId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "RequestEvent_requestId_createdAt_idx" ON "public"."RequestEvent"("requestId", "createdAt");

-- AddForeignKey
ALTER TABLE "public"."Door" ADD CONSTRAINT "Door_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DoorSettings" ADD CONSTRAINT "DoorSettings_doorId_fkey" FOREIGN KEY ("doorId") REFERENCES "public"."Door"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Category" ADD CONSTRAINT "Category_doorId_fkey" FOREIGN KEY ("doorId") REFERENCES "public"."Door"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CategoryField" ADD CONSTRAINT "CategoryField_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EmailAlias" ADD CONSTRAINT "EmailAlias_doorId_fkey" FOREIGN KEY ("doorId") REFERENCES "public"."Door"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Request" ADD CONSTRAINT "Request_doorId_fkey" FOREIGN KEY ("doorId") REFERENCES "public"."Door"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Request" ADD CONSTRAINT "Request_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RequestEvent" ADD CONSTRAINT "RequestEvent_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "public"."Request"("id") ON DELETE CASCADE ON UPDATE CASCADE;
