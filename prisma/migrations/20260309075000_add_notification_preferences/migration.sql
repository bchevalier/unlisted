-- AlterTable
ALTER TABLE "DoorSettings" ADD COLUMN "notifyNewRequest" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "DoorSettings" ADD COLUMN "notifyDigest" BOOLEAN NOT NULL DEFAULT false;
