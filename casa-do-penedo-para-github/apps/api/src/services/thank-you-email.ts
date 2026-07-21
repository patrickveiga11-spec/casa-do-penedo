import type { Property, Reservation, ReservationStatus } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { addDaysToDateKey, formatDate, getDateKeyInTimeZone, toDateOnly } from "../lib/dates.js";
import { sendThankYouEmail } from "./email.js";

/** Envia 1 dia após o check-out; recupera atrasados até este número de dias. */
const THANK_YOU_DAYS_AFTER = 1;
const THANK_YOU_CATCHUP_DAYS = 14;
const ELIGIBLE_STATUSES: ReservationStatus[] = ["CONFIRMED", "CHECKED_IN", "CHECKED_OUT"];

function isEligible(reservation: Reservation): boolean {
  return (
    Boolean(reservation.validatedAt) &&
    !reservation.thankYouEmailSentAt &&
    Boolean(reservation.guestEmail?.trim()) &&
    ELIGIBLE_STATUSES.includes(reservation.status)
  );
}

export function isThankYouDue(checkOut: Date, from = new Date()): boolean {
  const todayKey = getDateKeyInTimeZone(from);
  const checkOutKey = formatDate(toDateOnly(checkOut));
  const earliestKey = addDaysToDateKey(todayKey, -THANK_YOU_CATCHUP_DAYS);
  const latestDueKey = addDaysToDateKey(todayKey, -THANK_YOU_DAYS_AFTER);

  return checkOutKey >= earliestKey && checkOutKey <= latestDueKey;
}

export async function trySendThankYouEmail(
  reservation: Reservation & { property: Property }
): Promise<{ sent: boolean; reason?: string }> {
  if (!isEligible(reservation)) {
    return { sent: false, reason: "Reserva não elegível para email de agradecimento" };
  }

  const emailResult = await sendThankYouEmail({
    reservation,
    property: reservation.property,
  });

  if (!emailResult.sent) {
    return { sent: false, reason: emailResult.reason };
  }

  await prisma.reservation.update({
    where: { id: reservation.id },
    data: { thankYouEmailSentAt: new Date() },
  });

  return { sent: true };
}

export async function processScheduledThankYouEmails(from = new Date()) {
  const todayKey = getDateKeyInTimeZone(from);
  const earliestCheckOutKey = addDaysToDateKey(todayKey, -THANK_YOU_CATCHUP_DAYS);
  const latestDueCheckOutKey = addDaysToDateKey(todayKey, -THANK_YOU_DAYS_AFTER);

  const reservations = await prisma.reservation.findMany({
    where: {
      validatedAt: { not: null },
      thankYouEmailSentAt: null,
      guestEmail: { not: null },
      status: { in: ELIGIBLE_STATUSES },
      checkOut: {
        gte: toDateOnly(earliestCheckOutKey),
        lte: toDateOnly(latestDueCheckOutKey),
      },
    },
    include: { property: true },
    orderBy: { checkOut: "asc" },
  });

  const results = [];

  for (const reservation of reservations) {
    if (!isThankYouDue(reservation.checkOut, from)) {
      results.push({ id: reservation.id, sent: false, reason: "Fora da janela de envio" });
      continue;
    }

    const result = await trySendThankYouEmail(reservation);
    results.push({
      id: reservation.id,
      guestName: reservation.guestName,
      checkOut: formatDate(reservation.checkOut),
      ...result,
    });
  }

  const sent = results.filter((item) => item.sent).length;

  return {
    fromCheckOut: earliestCheckOutKey,
    toCheckOut: latestDueCheckOutKey,
    processed: results.length,
    sent,
    results,
  };
}
