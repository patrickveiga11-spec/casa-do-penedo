import { buildReservationComms, type CommStatus } from "../lib/reservation-comms";
import type { Reservation } from "../api";

const STEP_TITLES: Record<string, string> = {
  provisional: "Reserva provisória",
  confirmation: "Confirmação final",
  welcome: "Guia de boas-vindas",
};

function statusTitle(status: CommStatus) {
  if (status === "sent") return "Enviado";
  if (status === "scheduled") return "Agendado";
  if (status === "unavailable") return "Sem email";
  return "Pendente";
}

function MailGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
      <path d="m22 6-10 7L2 6" />
    </svg>
  );
}

export function ReservationCommsIcons({ reservation }: { reservation: Reservation }) {
  const steps = buildReservationComms(reservation);

  return (
    <div className="comms-icons" aria-label="Estado das comunicações">
      {steps.map((step) => (
        <span
          key={step.key}
          className={`comms-icon comms-icon-${step.status}`}
          title={`${STEP_TITLES[step.key]}: ${statusTitle(step.status)}`}
        >
          <MailGlyph />
        </span>
      ))}
    </div>
  );
}
