/*
  Warnings:

  - Added the required column `heroId` to the `EventSchedule` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "EventSchedule" ADD COLUMN     "heroId" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "EventSchedule" ADD CONSTRAINT "EventSchedule_heroId_fkey" FOREIGN KEY ("heroId") REFERENCES "EventHero"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
