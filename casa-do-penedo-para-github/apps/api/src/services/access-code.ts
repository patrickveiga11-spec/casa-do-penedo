import { randomInt } from "node:crypto";
import type { Reservation, ReservationStatus } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { datesOverlap, toDateOnly } from "../lib/dates.js";

const ACTIVE_STATUSES: ReservationStatus[] = ["CONFIRMED", "CHECKED_IN", "CHECKED_OUT", "PENDING"];

function overlapsStay(
  checkIn: Date,
  checkOut: Date,
  otherCheckIn: Date,
  otherCheckOut: Date
): boolean {
  return datesOverlap(
    toDateOnly(checkIn),
    toDateOnly(checkOut),
    toDateOnly(otherCheckIn),
    toDateOnly(otherCheckOut)
  );
}

async function isAccessCodeAvailable(
  propertyId: string,
  checkIn: Date,
  checkOut: Date,
  code: string,
  excludeReservationId?: string
): Promise<boolean> {
  const conflicts = await prisma.reservation.findMany({
    where: {
      propertyId,
      accessCode: code,
      status: { not: "CANCELLED" },
      ...(excludeReservationId ? { id: { not: excludeReservationId } } : {}),
    },
    select: {
      id: true,
      checkIn: true,
      checkOut: true,
    },
  });

  return !conflicts.some((reservation) =>
    overlapsStay(checkIn, checkOut, reservation.checkIn, reservation.checkOut)
  );
}

export async function generateUniqueAccessCode(
  propertyId: string,
  checkIn: Date,
  checkOut: Date,
  excludeReservationId?: string
): Promise<string> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const code = String(randomInt(0, 10_000)).padStart(4, "0");
    if (await isAccessCodeAvailable(propertyId, checkIn, checkOut, code, excludeReservationId)) {
      return code;
    }
  }

  throw new Error("Não foi possível gerar um código de acesso único");
}

export async function ensureReservationAccessCode(reservation: Reservation): Promise<string> {
  if (reservation.accessCode) {
    return reservation.accessCode;
  }

  const code = await generateUniqueAccessCode(
    reservation.propertyId,
    reservation.checkIn,
    reservation.checkOut,
    reservation.id
  );

  const updated = await prisma.reservation.update({
    where: { id: reservation.id },
    data: { accessCode: code },
  });

  return updated.accessCode!;
}

export async function backfillMissingAccessCodes() {
  const reservations = await prisma.reservation.findMany({
    where: {
      validatedAt: { not: null },
      accessCode: null,
      status: { in: ACTIVE_STATUSES },
    },
    orderBy: { validatedAt: "asc" },
  });

  let updated = 0;

  for (const reservation of reservations) {
    await ensureReservationAccessCode(reservation);
    updated += 1;
  }

  return { updated };
}
