import type { Reservation } from "../api";
import { dateKeyFromIso, parseDateKey, toDateKey } from "./format";

export type ReservationListTab = "upcoming" | "past";

export function todayKeyInLisbon(from = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Lisbon" }).format(from);
}

export function addDaysToKey(key: string, days: number) {
  const date = parseDateKey(key);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

export function isPastReservation(reservation: Reservation, todayKey = todayKeyInLisbon()) {
  if (reservation.status === "CANCELLED") {
    return true;
  }

  return dateKeyFromIso(reservation.checkOut) < todayKey;
}

export function isUpcomingReservation(reservation: Reservation, todayKey = todayKeyInLisbon()) {
  return !isPastReservation(reservation, todayKey);
}

export function filterReservationsByTab(
  reservations: Reservation[],
  tab: ReservationListTab,
  todayKey = todayKeyInLisbon()
) {
  return reservations.filter((reservation) =>
    tab === "upcoming" ? isUpcomingReservation(reservation, todayKey) : isPastReservation(reservation, todayKey)
  );
}

export function searchReservations(reservations: Reservation[], query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return reservations;
  }

  return reservations.filter((reservation) => {
    const haystack = [
      reservation.guestName,
      reservation.guestEmail ?? "",
      reservation.guestPhone ?? "",
      reservation.notes ?? "",
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(normalized);
  });
}

export interface WeekOverview {
  todayKey: string;
  tomorrowKey: string;
  checkInsToday: Reservation[];
  checkInsTomorrow: Reservation[];
  checkOutsToday: Reservation[];
  checkOutsTomorrow: Reservation[];
  pendingValidations: Reservation[];
}

export function buildWeekOverview(reservations: Reservation[], todayKey = todayKeyInLisbon()): WeekOverview {
  const tomorrowKey = addDaysToKey(todayKey, 1);
  const active = reservations.filter((reservation) => reservation.status !== "CANCELLED");

  return {
    todayKey,
    tomorrowKey,
    checkInsToday: active.filter((reservation) => dateKeyFromIso(reservation.checkIn) === todayKey),
    checkInsTomorrow: active.filter((reservation) => dateKeyFromIso(reservation.checkIn) === tomorrowKey),
    checkOutsToday: active.filter((reservation) => dateKeyFromIso(reservation.checkOut) === todayKey),
    checkOutsTomorrow: active.filter((reservation) => dateKeyFromIso(reservation.checkOut) === tomorrowKey),
    pendingValidations: active.filter((reservation) => !reservation.validatedAt && isUpcomingReservation(reservation, todayKey)),
  };
}

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendente",
  PARTIAL: "Sinal / parcial",
  PAID: "Pago",
};

export function paymentBadgeClass(status: string) {
  if (status === "PAID") return "badge-payment-paid";
  if (status === "PARTIAL") return "badge-payment-partial";
  return "badge-payment-pending";
}
