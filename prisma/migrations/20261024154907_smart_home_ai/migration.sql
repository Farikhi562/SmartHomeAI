/*
  Warnings:

  - You are about to drop the column `search_tsv` on the `items` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "idx_items_search_tsv";

-- AlterTable
ALTER TABLE "items" DROP COLUMN "search_tsv";
