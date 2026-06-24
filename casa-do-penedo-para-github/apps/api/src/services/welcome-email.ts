import type { Property, Reservation, ReservationStatus } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { daysUntilCheckIn, getDateKeyInTimeZone, addDaysToDateKey, toDateOnly } from "../lib/dates.js";
import { sendWelcomeGuideEmail } from "./email.js";

const WELCOME_DAYS_BEFORE = 2;
const ACTIVE_STATUSES: ReservationStatus[] = ["CONFIRMED", "CHECKED_IN"];

export function shouldSendWelcomeOnValidation(checkIn: Date, from = new Date()): boolean {
  return daysUntilCheckIn(checkIn, from) <= WELCOME_DAYS_BEFORE;
}

export function isWelcomeCronTarget(checkIn: Date, from = new Date()): boolean {
  return daysUntilCheckIn(checkIn, from) === WELCOME_DAYS_BEFORE;
}

function isEligible(reservation: Reservation): boolean {
  return (
    Boolean(reservation.validatedAt) &&
    !reservation.welcomeEmailSentAt &&
    Boolean(reservation.guestEmail?.trim()) &&
    ACTIVE_STATUSES.includes(reservation.status)
  );
}

export async function trySendWelcomeGuideEmail(
  reservation: Reservation & { property: Property }
): Promise<{ sent: boolean; reason?: string }> {
  if (!isEligible(reservation)) {
    return { sent: false, reason: "Reserva não elegível para guia de boas-vindas" };
  }

  const emailResult = await sendWelcomeGuideEmail({
    reservation,
    property: reservation.property,
  });

  if (!emailResult.sent) {
    return { sent: false, reason: emailResult.reason };
  }

  await prisma.reservation.update({
    where: { id: reservation.id },
    data: { welcomeEmailSentAt: new Date() },
  });

  return { sent: true };
}

export async function processScheduledWelcomeEmails(from = new Date()) {
  const todayKey = getDateKeyInTimeZone(from);
  const targetCheckInKey = addDaysToDateKey(todayKey, WELCOME_DAYS_BEFORE);

  const reservations = await prisma.reservation.findMany({
    where: {
      validatedAt: { not: null },
      welcomeEmailSentAt: null,
      guestEmail: { not: null },
      status: { in: ACTIVE_STATUSES },
      checkIn: toDateOnly(targetCheckInKey),
    },
    include: { property: true },
  });

  const results = [];

  for (const reservation of reservations) {
    if (!isWelcomeCronTarget(reservation.checkIn, from)) {
      results.push({ id: reservation.id, sent: false, reason: "Fora da janela de envio" });
      continue;
    }

    const result = await trySendWelcomeGuideEmail(reservation);
    results.push({ id: reservation.id, guestName: reservation.guestName, ...result });
  }

  const sent = results.filter((item) => item.sent).length;

  return {
    targetCheckIn: targetCheckInKey,
    processed: results.length,
    sent,
    results,
  };
}

export async function processWelcomeEmailAfterValidation(
  reservation: Reservation & { property: Property }
) {
  if (!shouldSendWelcomeOnValidation(reservation.checkIn)) {
    return { sent: false, reason: "Guia agendado para 2 dias antes do check-in" };
  }

  return trySendWelcomeGuideEmail(reservation);
}
