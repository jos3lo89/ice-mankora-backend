/*
  Warnings:

  - The `variantsDetail` column on the `order_items` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "order_items" DROP COLUMN "variantsDetail",
ADD COLUMN     "variantsDetail" JSONB;
