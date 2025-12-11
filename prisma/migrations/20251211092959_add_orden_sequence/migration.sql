-- CreateEnum
CREATE TYPE "AreaOrder" AS ENUM ('COCINA', 'BEBIDAS');

-- CreateTable
CREATE TABLE "OrderPrintSequence" (
    "id" TEXT NOT NULL,
    "area" "AreaOrder" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "OrderPrintSequence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrderPrintSequence_area_date_key" ON "OrderPrintSequence"("area", "date");
