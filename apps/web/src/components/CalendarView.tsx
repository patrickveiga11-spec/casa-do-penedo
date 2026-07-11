import { useMemo } from "react";
import type { Reservation } from "../api";
import { dateKeyFromIso, isSelectedStayDay, parseDateKey, toDateKey } from "../lib/format";

interface CalendarLabels {
  weekdays: readonly string[];
  today: string;
  occupied: string;
  yourDates: string;
  occupiedLegend: string;
  available: string;
  ariaOccupied: string;
}

const defaultLabels: CalendarLabels = {
  weekdays: ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"],
  today: "Hoje",
  occupied: "Ocupado",
  yourDates: "As tuas datas",
  occupiedLegend: "Ocupado (reserva ou indisponível)",
  available: "Disponível",
  ariaOccupied: "Ocupado",
};

interface CalendarViewProps {
  reservations: Reservation[];
  blocks: { startDate: string; endDate: string; reason: string | null }[];
  from: string;
  hideGuestNames?: boolean;
  monthLabel?: string;
  onPrevMonth?: () => void;
  onNextMonth?: () => void;
  onToday?: () => void;
  todayLabel?: string;
  labels?: CalendarLabels;
  /** Quando definido, o × só aparece nestas datas (página pública). */
  selectedRange?: { checkIn: string; checkOut: string };
  /** Destaca um intervalo no calendário (gestão). */
  focusRange?: { checkIn: string; checkOut: string };
}

export function CalendarView({
  reservations,
  blocks,
  from,
  hideGuestNames = false,
  monthLabel,
  onPrevMonth,
  onNextMonth,
  onToday,
  todayLabel,
  labels: labelsProp,
  selectedRange,
  focusRange,
}: CalendarViewProps) {
  const labels = labelsProp ?? defaultLabels;
  const today = todayLabel ?? labels.today;
  const start = parseDateKey(from);
  const month = start.getMonth();
  const year = start.getFullYear();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const leadingEmpty = (firstDay.getDay() + 6) % 7;

  const days = useMemo(() => {
    const cells: { date: Date; key: string }[] = [];

    for (let i = 0; i < leadingEmpty; i += 1) {
      const date = new Date(year, month, 1 - (leadingEmpty - i));
      cells.push({ date, key: `prev-${i}` });
    }

    for (let day = 1; day <= lastDay.getDate(); day += 1) {
      cells.push({ date: new Date(year, month, day), key: `day-${day}` });
    }

    return cells;
  }, [leadingEmpty, lastDay.getDate(), month, year]);

  function reservationForDay(date: Date) {
    const dayKey = toDateKey(date);

    return reservations.find((reservation) =>
      isSelectedStayDay(dayKey, reservation.checkIn, reservation.checkOut)
    );
  }

  function blockForDay(date: Date) {
    const dayKey = toDateKey(date);

    return blocks.find((block) => {
      const startDate = dateKeyFromIso(block.startDate);
      const endDate = dateKeyFromIso(block.endDate);
      return dayKey >= startDate && dayKey <= endDate;
    });
  }

  function dayInSelectedRange(dayKey: string) {
    if (!selectedRange) {
      return false;
    }

    return isSelectedStayDay(dayKey, selectedRange.checkIn, selectedRange.checkOut);
  }

  function dayInFocusRange(dayKey: string) {
    if (!focusRange) {
      return false;
    }

    return isSelectedStayDay(dayKey, focusRange.checkIn, focusRange.checkOut);
  }

  return (
    <div>
      {(monthLabel || onPrevMonth || onNextMonth || onToday) && (
        <div className="calendar-nav">
          {onPrevMonth ? (
            <button type="button" className="btn secondary btn-small" onClick={onPrevMonth}>
              ←
            </button>
          ) : (
            <span />
          )}
          {monthLabel && <strong className="calendar-month">{monthLabel}</strong>}
          <div className="calendar-nav-actions">
            {onToday && (
              <button type="button" className="btn secondary btn-small" onClick={onToday}>
                {today}
              </button>
            )}
            {onNextMonth ? (
              <button type="button" className="btn secondary btn-small" onClick={onNextMonth}>
                →
              </button>
            ) : (
              <span />
            )}
          </div>
        </div>
      )}
      <div className="calendar-grid">
        {labels.weekdays.map((label) => (
          <div key={label} className="calendar-weekday">
            {label}
          </div>
        ))}
        {days.map(({ date, key }) => {
          const inMonth = date.getMonth() === month;
          const dayKey = toDateKey(date);
          const reservation = reservationForDay(date);
          const block = blockForDay(date);
          const selected = dayInSelectedRange(dayKey);
          const focused = dayInFocusRange(dayKey);
          const showMark = hideGuestNames
            ? Boolean(reservation || block)
            : selectedRange
              ? selected
              : Boolean(reservation);
          const occupiedLabel = reservation
            ? hideGuestNames
              ? labels.occupied
              : reservation.guestName
            : block
              ? hideGuestNames
                ? labels.occupied
                : (block.reason ?? "Bloqueio manual")
              : null;

          return (
            <div
              key={key}
              className={[
                "calendar-day",
                !inMonth ? "muted" : "",
                reservation ? "booked" : "",
                selected ? "selected" : "",
                focused ? "focused" : "",
                block ? "blocked" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              title={occupiedLabel ?? undefined}
            >
              <div className="date-wrap">
                <div className="date">{date.getDate()}</div>
                {showMark && (
                  <span className="date-mark" aria-label={hideGuestNames ? labels.ariaOccupied : "Selecionado"}>
                    ×
                  </span>
                )}
              </div>
              {occupiedLabel && <div className="label">{occupiedLabel}</div>}
            </div>
          );
        })}
      </div>
      <div className="calendar-legend">
        {selectedRange ? (
          <>
            <span><i className="legend selected" /> {labels.yourDates}</span>
            <span><i className="legend booked" /> {labels.occupied}</span>
          </>
        ) : hideGuestNames ? (
          <span><i className="legend booked" /> {labels.occupiedLegend}</span>
        ) : (
          <>
            <span><i className="legend booked" /> Reserva</span>
            <span><i className="legend blocked" /> Bloqueio manual</span>
          </>
        )}
        <span><i className="legend free" /> {labels.available}</span>
      </div>
    </div>
  );
}
