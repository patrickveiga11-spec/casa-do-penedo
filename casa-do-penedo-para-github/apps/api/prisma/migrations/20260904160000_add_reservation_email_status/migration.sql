-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "guestEmailSentAt" TIMESTAMP(3);
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "ownerEmailSentAt" TIMESTAMP(3);
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "lastEmailError" TEXT;
