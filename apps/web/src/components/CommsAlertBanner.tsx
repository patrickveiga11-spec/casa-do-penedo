import { buildCommsAlertSummary } from "../lib/reservation-comms";
import type { Reservation } from "../api";
import { formatDate } from "../lib/format";

export function CommsAlertBanner({
  reservations,
  onSelectReservation,
}: {
  reservations: Reservation[];
  onSelectReservation: (id: string) => void;
}) {
  const { welcomeDue, pendingValidation } = buildCommsAlertSummary(reservations);

  if (welcomeDue.length === 0 && pendingValidation === 0) {
    return null;
  }

  return (
    <section className="admin-alert admin-alert-comms">
      <div>
        <strong>Comunicações</strong>
        <ul className="comms-alert-list">
          {pendingValidation > 0 && (
            <li>
              {pendingValidation === 1
                ? "1 confirmação pendente de validação"
                : `${pendingValidation} confirmações pendentes de validação`}
            </li>
          )}
          {welcomeDue.length > 0 && (
            <li>
              {welcomeDue.length === 1
                ? "1 guia de boas-vindas por enviar em breve"
                : `${welcomeDue.length} guias de boas-vindas por enviar em breve`}
              <ul className="comms-alert-sublist">
                {welcomeDue.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      className="comms-alert-link"
                      onClick={() => onSelectReservation(item.id)}
                    >
                      {item.guestName}
                      {item.overdue ? " — envio em atraso" : ` — check-in ${formatDate(item.checkIn)}`}
                    </button>
                  </li>
                ))}
              </ul>
            </li>
          )}
        </ul>
      </div>
    </section>
  );
}
