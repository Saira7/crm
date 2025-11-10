/*
  Warnings:

  - You are about to drop the column `ipAddress` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Role" ADD COLUMN     "allowedIPs" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "ipRestricted" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "ipAddress",
ADD COLUMN     "allowedIPs" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "ipRestricted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastLoginAt" TIMESTAMP(3),
ADD COLUMN     "lastLoginIP" TEXT;

-- CreateTable
CREATE TABLE "IPRestriction" (
    "id" SERIAL NOT NULL,
    "roleId" INTEGER,
    "ipAddress" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IPRestriction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IPRestriction_roleId_idx" ON "IPRestriction"("roleId");

-- AddForeignKey
ALTER TABLE "IPRestriction" ADD CONSTRAINT "IPRestriction_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;
