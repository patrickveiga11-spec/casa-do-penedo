import type { Reservation } from "../api";
import { formatDate } from "../lib/format";
import type { WeekOverview } from "../lib/reservation-filters";

interface WeekOverviewPanelProps {
  overview: WeekOverview;
  onSelectReservation: (id: string) => void;
}

function OverviewGroup({
  title,
  items,
  onSelect,
}: {
  title: string;
  items: Reservation[];
  onSelect: (id: string) => void;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="week-group">
      <h4>{title}</h4>
      <ul className="week-list">
        {items.map((reservation) => (
          <li key={reservation.id}>
            <button type="button" className="week-item-btn" onClick={() => onSelect(reservation.id)}>
              <strong>{reservation.guestName}</strong>
              <span className="muted-text">
                {formatDate(reservation.checkIn)} → {formatDate(reservation.checkOut)} · {reservation.guests}{" "}
                hósp.
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function WeekOverviewPanel({ overview, onSelectReservation }: WeekOverviewPanelProps) {
  const hasActivity =
    overview.checkInsToday.length > 0 ||
    overview.checkInsTomorrow.length > 0 ||
    overview.checkOutsToday.length > 0 ||
    overview.checkOutsTomorrow.length > 0 ||
    overview.pendingValidations.length > 0;

  return (
    <section className="panel week-overview" id="admin-week">
      <h2>Esta semana</h2>
      {!hasActivity ? (
        <p className="empty muted-text">Sem chegadas, saídas ou validações pendentes para hoje e amanhã.</p>
      ) : (
        <div className="week-grid">
          <OverviewGroup title="Chegadas hoje" items={overview.checkInsToday} onSelect={onSelectReservation} />
          <OverviewGroup title="Chegadas amanhã" items={overview.checkInsTomorrow} onSelect={onSelectReservation} />
          <OverviewGroup title="Saídas hoje" items={overview.checkOutsToday} onSelect={onSelectReservation} />
          <OverviewGroup title="Saídas amanhã" items={overview.checkOutsTomorrow} onSelect={onSelectReservation} />
          {overview.pendingValidations.length > 0 && (
            <div className="week-group week-group-alert">
              <h4>Validações pendentes</h4>
              <ul className="week-list">
                {overview.pendingValidations.map((reservation) => (
                  <li key={reservation.id}>
                    <button
                      type="button"
                      className="week-item-btn"
                      onClick={() => onSelectReservation(reservation.id)}
                    >
                      <strong>{reservation.guestName}</strong>
                      <span className="muted-text">Check-in {formatDate(reservation.checkIn)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
