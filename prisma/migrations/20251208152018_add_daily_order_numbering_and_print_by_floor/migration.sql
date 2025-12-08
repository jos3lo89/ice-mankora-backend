/*
  Warnings:

  - A unique constraint covering the columns `[dailyNumber,orderDate,tableId]` on the table `orders` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `dailyNumber` to the `orders` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "PrintStatus" AS ENUM ('PENDING', 'PRINTED', 'FAILED', 'RETRYING');

-- AlterTable
ALTER TABLE "floors" ADD COLUMN     "printerIp" TEXT,
ADD COLUMN     "printerPort" INTEGER NOT NULL DEFAULT 9100;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "dailyNumber" INTEGER NOT NULL,
ADD COLUMN     "orderDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "print_logs" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "floorId" TEXT NOT NULL,
    "status" "PrintStatus" NOT NULL DEFAULT 'PENDING',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastAttempt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "printerIp" TEXT,
    "sentData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "print_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "print_logs_orderId_idx" ON "print_logs"("orderId");

-- CreateIndex
CREATE INDEX "print_logs_status_idx" ON "print_logs"("status");

-- CreateIndex
CREATE INDEX "print_logs_floorId_idx" ON "print_logs"("floorId");

-- CreateIndex
CREATE INDEX "orders_orderDate_dailyNumber_idx" ON "orders"("orderDate", "dailyNumber");

-- CreateIndex
CREATE UNIQUE INDEX "orders_dailyNumber_orderDate_tableId_key" ON "orders"("dailyNumber", "orderDate", "tableId");

-- AddForeignKey
ALTER TABLE "print_logs" ADD CONSTRAINT "print_logs_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_logs" ADD CONSTRAINT "print_logs_floorId_fkey" FOREIGN KEY ("floorId") REFERENCES "floors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
