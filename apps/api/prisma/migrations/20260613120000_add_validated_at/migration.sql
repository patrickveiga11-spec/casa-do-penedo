-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN "validatedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Reservation" ALTER COLUMN "status" SET DEFAULT 'PENDING';
