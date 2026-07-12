-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PARTIAL', 'PAID');

-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "Reservation" ADD COLUMN "amountPaid" DECIMAL(10,2);
