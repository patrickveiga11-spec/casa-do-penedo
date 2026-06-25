-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN "accessCode" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Reservation_accessCode_key" ON "Reservation"("accessCode");
