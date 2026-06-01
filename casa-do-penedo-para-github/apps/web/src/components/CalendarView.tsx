import { useMemo } from "react";
import type { Reservation } from "../api";
import { dateKeyFromIso, isSelectedStayDay, parseDateKey, toDateKey } from "../lib/format";

interface CalendarViewProps {
  reservations: Reservation[];
  blocks: { startDate: string; endDate: string; reason: string | null }[];
  from: string;
  hideGuestNames?: boolean;
  monthLabel?: string;
  onPrevMonth?: () => void;
  onNextMonth?: () => void;
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
  selectedRange,
  focusRange,
}: CalendarViewProps) {
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
      {(monthLabel || onPrevMonth || onNextMonth) && (
        <div className="calendar-nav">
          {onPrevMonth ? (
            <button type="button" className="btn secondary btn-small" onClick={onPrevMonth}>
              ←
            </button>
          ) : (
            <span />
          )}
          {monthLabel && <strong className="calendar-month">{monthLabel}</strong>}
          {onNextMonth ? (
            <button type="button" className="btn secondary btn-small" onClick={onNextMonth}>
              →
            </button>
          ) : (
            <span />
          )}
        </div>
      )}
      <div className="calendar-grid">
        {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((label) => (
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
          const occupied = Boolean(reservation || block);
          const showMark = selectedRange ? selected : Boolean(reservation);

          return (
            <div
              key={key}
              className={[
                "calendar-day",
                !inMonth ? "muted" : "",
                occupied ? "booked" : "",
                selected ? "selected" : "",
                focused ? "focused" : "",
                block ? "blocked" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <div className="date-wrap">
                <div className="date">{date.getDate()}</div>
                {showMark && (
                  <span className="date-mark" aria-label="Selecionado">
                    ×
                  </span>
                )}
              </div>
              {reservation && !hideGuestNames && (
                <div className="label">{reservation.guestName}</div>
              )}
              {!reservation && block && <div className="label">{block.reason ?? "Indisponível"}</div>}
            </div>
          );
        })}
      </div>
      <div className="calendar-legend">
        {selectedRange ? (
          <>
            <span><i className="legend selected" /> As tuas datas</span>
            <span><i className="legend booked" /> Ocupado</span>
          </>
        ) : (
          <span><i className="legend booked" /> Ocupado</span>
        )}
        <span><i className="legend free" /> Disponível</span>
      </div>
    </div>
  );
}
