import { dateKeyFromIso, formatDate, parseDateKey } from "./format";

export type CommStatus = "sent" | "scheduled" | "pending" | "unavailable";

export type CommStep = {
  key: "provisional" | "confirmation" | "welcome" | "thankYou";
  label: string;
  status: CommStatus;
  detail: string;
};

const WELCOME_DAYS_BEFORE = 2;
const THANK_YOU_DAYS_AFTER = 1;

function formatDateTime(iso: string) {
  const date = new Date(iso);
  return date.toLocaleString("pt-PT", {
    timeZone: "Europe/Lisbon",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function welcomeScheduleDateKey(checkIn: string) {
  const checkInDate = parseDateKey(dateKeyFromIso(checkIn));
  return addDays(checkInDate, -WELCOME_DAYS_BEFORE);
}

function daysUntilCheckIn(checkIn: string, from = new Date()) {
  const target = parseDateKey(dateKeyFromIso(checkIn));
  const today = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const checkInDay = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  return Math.round((checkInDay.getTime() - today.getTime()) / 86_400_000);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function buildReservationComms(reservation: {
  guestEmail: string | null;
  createdAt?: string | null;
  validatedAt?: string | null;
  welcomeEmailSentAt?: string | null;
  thankYouEmailSentAt?: string | null;
  checkIn: string;
  checkOut: string;
}): CommStep[] {
  const hasEmail = Boolean(reservation.guestEmail?.trim());

  const provisional: CommStep = {
    key: "provisional",
    label: "Reserva provisória",
    status: !hasEmail ? "unavailable" : "sent",
    detail: !hasEmail
      ? "Sem email do hóspede"
      : reservation.createdAt
        ? `Enviada em ${formatDateTime(reservation.createdAt)}`
        : "Enviada na criação da reserva",
  };

  const confirmation: CommStep = {
    key: "confirmation",
    label: "Confirmação final",
    status: !hasEmail ? "unavailable" : reservation.validatedAt ? "sent" : "pending",
    detail: !hasEmail
      ? "Sem email do hóspede"
      : reservation.validatedAt
        ? `Enviada em ${formatDateTime(reservation.validatedAt)}`
        : "Pendente — enviada ao validar a reserva",
  };

  let welcomeStatus: CommStatus = "pending";
  let welcomeDetail = "Pendente";

  if (!hasEmail) {
    welcomeStatus = "unavailable";
    welcomeDetail = "Sem email do hóspede";
  } else if (reservation.welcomeEmailSentAt) {
    welcomeStatus = "sent";
    welcomeDetail = `Enviado em ${formatDateTime(reservation.welcomeEmailSentAt)}`;
  } else if (!reservation.validatedAt) {
    welcomeStatus = "pending";
    welcomeDetail = "Após confirmação da reserva";
  } else {
    const scheduleDay = welcomeScheduleDateKey(reservation.checkIn);
    const scheduleLabel = `${formatDate(toDateKey(scheduleDay))} às 9h`;
    const daysLeft = daysUntilCheckIn(reservation.checkIn);

    if (daysLeft <= WELCOME_DAYS_BEFORE) {
      welcomeStatus = "scheduled";
      welcomeDetail = "Envio automático em breve (check-in a menos de 2 dias)";
    } else {
      welcomeStatus = "scheduled";
      welcomeDetail = `Agendado para ${scheduleLabel}`;
    }
  }

  const welcome: CommStep = {
    key: "welcome",
    label: "Guia de boas-vindas",
    status: welcomeStatus,
    detail: welcomeDetail,
  };

  let thankYouStatus: CommStatus = "pending";
  let thankYouDetail = "Pendente";

  if (!hasEmail) {
    thankYouStatus = "unavailable";
    thankYouDetail = "Sem email do hóspede";
  } else if (reservation.thankYouEmailSentAt) {
    thankYouStatus = "sent";
    thankYouDetail = `Enviado em ${formatDateTime(reservation.thankYouEmailSentAt)}`;
  } else if (!reservation.validatedAt) {
    thankYouStatus = "pending";
    thankYouDetail = "Após confirmação da reserva";
  } else {
    const scheduleDay = thankYouScheduleDateKey(reservation.checkOut);
    const scheduleLabel = `${formatDate(toDateKey(scheduleDay))} às 9h`;
    const daysSinceCheckout = -daysUntilCheckIn(reservation.checkOut);

    if (daysSinceCheckout >= THANK_YOU_DAYS_AFTER) {
      thankYouStatus = "scheduled";
      thankYouDetail =
        daysSinceCheckout > THANK_YOU_DAYS_AFTER
          ? "Atrasado — será enviado automaticamente no próximo ciclo (9h)"
          : "Envio automático em breve (1 dia após o check-out)";
    } else {
      thankYouStatus = "scheduled";
      thankYouDetail = `Agendado para ${scheduleLabel}`;
    }
  }

  const thankYou: CommStep = {
    key: "thankYou",
    label: "Agradecimento pós-estadia",
    status: thankYouStatus,
    detail: thankYouDetail,
  };

  return [provisional, confirmation, welcome, thankYou];
}

function thankYouScheduleDateKey(checkOut: string) {
  const checkOutDate = parseDateKey(dateKeyFromIso(checkOut));
  return addDays(checkOutDate, THANK_YOU_DAYS_AFTER);
}

export function getWelcomeGuidesDue(reservations: Array<{
  id: string;
  guestName: string;
  guestEmail: string | null;
  checkIn: string;
  validatedAt?: string | null;
  welcomeEmailSentAt?: string | null;
  status: string;
}>) {
  const active = new Set(["CONFIRMED", "CHECKED_IN", "PENDING"]);

  return reservations.filter((reservation) => {
    if (!active.has(reservation.status)) return false;
    if (!reservation.guestEmail?.trim()) return false;
    if (!reservation.validatedAt) return false;
    if (reservation.welcomeEmailSentAt) return false;

    const daysLeft = daysUntilCheckIn(reservation.checkIn);
    const daysUntilSend = daysLeft - WELCOME_DAYS_BEFORE;

    return daysUntilSend <= 2;
  });
}

export interface CommsAlertSummary {
  welcomeDue: Array<{ id: string; guestName: string; checkIn: string; overdue: boolean }>;
  pendingValidation: number;
}

export function buildCommsAlertSummary(
  reservations: Array<{
    id: string;
    guestName: string;
    guestEmail: string | null;
    checkIn: string;
    validatedAt?: string | null;
    welcomeEmailSentAt?: string | null;
    status: string;
  }>
): CommsAlertSummary {
  const welcomeDue = getWelcomeGuidesDue(reservations).map((reservation) => ({
    id: reservation.id,
    guestName: reservation.guestName,
    checkIn: reservation.checkIn,
    overdue: daysUntilCheckIn(reservation.checkIn) <= WELCOME_DAYS_BEFORE,
  }));

  const pendingValidation = reservations.filter(
    (reservation) => reservation.status === "PENDING" && !reservation.validatedAt
  ).length;

  return { welcomeDue, pendingValidation };
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
