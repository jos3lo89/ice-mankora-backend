-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "saleId" TEXT;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE SET NULL ON UPDATE CASCADE;
