import type { Reservation } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

const ACTIVE_STATUSES = new Set(["PENDING", "CONFIRMED", "CHECKED_IN", "CHECKED_OUT"]);

export function normalizeGuestEmail(email: string | null | undefined): string | null {
  const normalized = email?.trim().toLowerCase();
  if (!normalized || !normalized.includes("@")) {
    return null;
  }
  return normalized;
}

async function findReservationsForEmail(email: string) {
  const candidates = await prisma.reservation.findMany({
    where: {
      guestEmail: { not: null },
      status: { in: [...ACTIVE_STATUSES] },
    },
    orderBy: { checkIn: "asc" },
  });

  return candidates.filter((reservation) => normalizeGuestEmail(reservation.guestEmail) === email);
}

export async function syncGuestByEmail(rawEmail: string | null | undefined) {
  const email = normalizeGuestEmail(rawEmail);
  if (!email) {
    return null;
  }

  const reservations = await findReservationsForEmail(email);

  if (reservations.length === 0) {
    await prisma.guest.deleteMany({ where: { email } });
    return null;
  }

  const first = reservations[0];
  const latest = reservations[reservations.length - 1];

  return prisma.guest.upsert({
    where: { email },
    create: {
      email,
      name: latest.guestName,
      phone: latest.guestPhone,
      stayCount: reservations.length,
      firstStayAt: first.checkIn,
      lastStayAt: latest.checkIn,
      lastCheckOut: latest.checkOut,
    },
    update: {
      name: latest.guestName,
      phone: latest.guestPhone,
      stayCount: reservations.length,
      firstStayAt: first.checkIn,
      lastStayAt: latest.checkIn,
      lastCheckOut: latest.checkOut,
    },
  });
}

export async function syncGuestFromReservation(reservation: Pick<Reservation, "guestEmail">) {
  return syncGuestByEmail(reservation.guestEmail);
}

export async function backfillGuestRegistry() {
  const reservations = await prisma.reservation.findMany({
    where: {
      guestEmail: { not: null },
      status: { in: [...ACTIVE_STATUSES] },
    },
    select: { guestEmail: true },
  });

  const emails = new Set<string>();

  for (const reservation of reservations) {
    const email = normalizeGuestEmail(reservation.guestEmail);
    if (email) {
      emails.add(email);
    }
  }

  let synced = 0;

  for (const email of emails) {
    await syncGuestByEmail(email);
    synced += 1;
  }

  return { synced, uniqueEmails: emails.size };
}
