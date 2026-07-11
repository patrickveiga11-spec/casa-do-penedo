import { buildReservationComms, type CommStatus } from "../lib/reservation-comms";
import type { Reservation } from "../api";

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
      <path d="m22 6-10 7L2 6" />
    </svg>
  );
}

function statusLabel(status: CommStatus) {
  if (status === "sent") return "Enviado";
  if (status === "scheduled") return "Agendado";
  if (status === "unavailable") return "N/A";
  return "Pendente";
}

export function ReservationCommsTimeline({ reservation }: { reservation: Reservation }) {
  const steps = buildReservationComms(reservation);

  return (
    <section className="reservation-comms" aria-label="Comunicações com o hóspede">
      <h3>Comunicações</h3>
      <ol className="comms-timeline">
        {steps.map((step) => (
          <li key={step.key} className={`comms-step comms-step-${step.status}`}>
            <div className="comms-step-icon">
              <MailIcon />
            </div>
            <div className="comms-step-body">
              <div className="comms-step-header">
                <strong>{step.label}</strong>
                <span className={`comms-badge comms-badge-${step.status}`}>{statusLabel(step.status)}</span>
              </div>
              <p className="muted-text">{step.detail}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
