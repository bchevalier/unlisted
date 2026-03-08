-- CreateEnum
CREATE TYPE "public"."DoorPlan" AS ENUM ('FREE', 'PAID');

-- AlterTable
ALTER TABLE "public"."Door" ADD COLUMN     "plan" "public"."DoorPlan" NOT NULL DEFAULT 'FREE';
