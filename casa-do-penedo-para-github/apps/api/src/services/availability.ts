import type { AvailabilityBlock, Reservation, ReservationStatus } from "@prisma/client";
import { datesOverlap, formatDate, toDateOnly } from "../lib/dates.js";

export type ConflictType = "reservation" | "block";

export interface AvailabilityConflict {
  type: ConflictType;
  id: string;
  startDate: string;
  endDate: string;
  label: string;
}

export interface AvailabilityCheckInput {
  propertyId: string;
  checkIn: Date;
  checkOut: Date;
  excludeReservationId?: string;
  excludeBlockId?: string;
  reservations: Pick<Reservation, "id" | "checkIn" | "checkOut" | "status" | "guestName">[];
  blocks: Pick<AvailabilityBlock, "id" | "startDate" | "endDate" | "reason">[];
}

const activeStatuses: ReservationStatus[] = ["PENDING", "CONFIRMED", "CHECKED_IN"];

export function findAvailabilityConflicts(input: AvailabilityCheckInput): AvailabilityConflict[] {
  const checkIn = toDateOnly(input.checkIn);
  const checkOut = toDateOnly(input.checkOut);
  const conflicts: AvailabilityConflict[] = [];

  for (const reservation of input.reservations) {
    if (input.excludeReservationId && reservation.id === input.excludeReservationId) {
      continue;
    }

    if (!activeStatuses.includes(reservation.status)) {
      continue;
    }

    const resCheckIn = toDateOnly(reservation.checkIn);
    const resCheckOut = toDateOnly(reservation.checkOut);

    if (datesOverlap(checkIn, checkOut, resCheckIn, resCheckOut)) {
      conflicts.push({
        type: "reservation",
        id: reservation.id,
        startDate: formatDate(resCheckIn),
        endDate: formatDate(resCheckOut),
        label: reservation.guestName,
      });
    }
  }

  for (const block of input.blocks) {
    if (input.excludeBlockId && block.id === input.excludeBlockId) {
      continue;
    }

    const blockStart = toDateOnly(block.startDate);
    const blockEnd = toDateOnly(block.endDate);

    if (datesOverlap(checkIn, checkOut, blockStart, blockEnd)) {
      conflicts.push({
        type: "block",
        id: block.id,
        startDate: formatDate(blockStart),
        endDate: formatDate(blockEnd),
        label: block.reason ?? "Bloqueio manual",
      });
    }
  }

  return conflicts;
}

export function assertAvailable(input: AvailabilityCheckInput): void {
  const conflicts = findAvailabilityConflicts(input);

  if (conflicts.length > 0) {
    const first = conflicts[0];
    throw new Error(
      `Overbooking detetado: conflito com ${first.type === "reservation" ? "reserva" : "bloqueio"} (${first.label}) entre ${first.startDate} e ${first.endDate}`
    );
  }
}
