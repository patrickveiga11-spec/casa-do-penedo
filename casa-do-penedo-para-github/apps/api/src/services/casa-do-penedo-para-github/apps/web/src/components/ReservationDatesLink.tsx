import { CalendarIcon } from "./CalendarIcon";
import { formatDate } from "../lib/format";

interface ReservationDatesLinkProps {
  checkIn: string;
  checkOut: string;
  guests: number;
  onOpenCalendar: () => void;
}

export function ReservationDatesLink({
  checkIn,
  checkOut,
  guests,
  onOpenCalendar,
}: ReservationDatesLinkProps) {
  return (
    <div className="reservation-dates">
      <span className="muted-text">
        {formatDate(checkIn)} → {formatDate(checkOut)} · {guests} hóspedes
      </span>
      <button
        type="button"
        className="calendar-link-btn"
        onClick={onOpenCalendar}
        aria-label="Ver datas no calendário"
        title="Ver no calendário"
      >
        <CalendarIcon size={16} />
      </button>
    </div>
  );
}
