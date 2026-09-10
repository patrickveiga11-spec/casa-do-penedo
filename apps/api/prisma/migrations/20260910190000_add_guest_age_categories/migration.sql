-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "guestsChildren" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "guestsYouth" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "guestsAdults" INTEGER NOT NULL DEFAULT 1;

-- Backfill: treat existing total as adults
UPDATE "Reservation"
SET "guestsAdults" = "guests",
    "guestsChildren" = 0,
    "guestsYouth" = 0
WHERE "guestsAdults" = 1 AND "guests" <> 1;
