-- CreateTable
CREATE TABLE "Guest" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "stayCount" INTEGER NOT NULL DEFAULT 0,
    "firstStayAt" DATE,
    "lastStayAt" DATE,
    "lastCheckOut" DATE,
    "marketingOptIn" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Guest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Guest_email_key" ON "Guest"("email");

-- CreateIndex
CREATE INDEX "Guest_lastStayAt_idx" ON "Guest"("lastStayAt");

-- CreateIndex
CREATE INDEX "Guest_marketingOptIn_idx" ON "Guest"("marketingOptIn");
