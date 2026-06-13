import { useEffect, useState } from "react";
import { api, type Property, type Reservation } from "../api";
import { CalendarView } from "../components/CalendarView";
import { DateField } from "../components/DateField";
import { LogoHeader } from "../components/LogoHeader";
import { PricingInfo } from "../components/PricingInfo";
import { formatDate, formatMoney, monthRange, dateKeyFromIso, parseDateKey } from "../lib/format";

interface Confirmation {
  guestName: string;
  guestEmail: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  totalPrice: string;
  currency: string;
  emailSent: boolean;
}

export default function BookingPage() {
  const [property, setProperty] = useState<Property | null>(null);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [blocks, setBlocks] = useState<{ startDate: string; endDate: string; reason: string | null }[]>([]);
  const [pricingRules, setPricingRules] = useState<Awaited<ReturnType<typeof api.getPricingRules>>>([]);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    guestName: "",
    guestEmail: "",
    guestPhone: "",
    checkIn: "",
    checkOut: "",
    guests: 2,
  });
  const [quoteTotal, setQuoteTotal] = useState<number | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);

  const range = monthRange(calendarMonth);

  async function loadCalendar(selectedProperty: Property) {
    const [calendar, ruleData] = await Promise.all([
      api.getCalendar(selectedProperty.id, range.from, range.to),
      api.getPricingRules(selectedProperty.id),
    ]);

    setReservations(calendar.reservations);
    setBlocks(calendar.blocks);
    setPricingRules(ruleData);
  }

  useEffect(() => {
    async function bootstrap() {
      try {
        const properties = await api.getProperties();
        const selected = properties[0] ?? null;
        setProperty(selected);
        if (selected) {
          await loadCalendar(selected);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Não foi possível carregar a página");
      } finally {
        setLoading(false);
      }
    }

    bootstrap();
  }, []);

  useEffect(() => {
    if (property) {
      loadCalendar(property).catch(() => undefined);
    }
  }, [calendarMonth, property?.id]);

  useEffect(() => {
    if (!property || !form.checkIn || !form.checkOut) {
      setQuoteTotal(null);
      return;
    }

    api
      .getQuote({
        propertyId: property.id,
        checkIn: form.checkIn,
        checkOut: form.checkOut,
        guests: form.guests,
      })
      .then((quote) => {
        setQuoteTotal(quote.subtotal);
        setFormError(null);
      })
      .catch(() => setQuoteTotal(null));
  }, [form.checkIn, form.checkOut, form.guests, property?.id]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!property) return;

    setSubmitting(true);
    setFormError(null);

    const phone = form.guestPhone.trim();
    if (phone.length < 4) {
      setFormError("Indica um número de telemóvel (pode ser de qualquer país).");
      setSubmitting(false);
      return;
    }

    try {
      const availability = await api.checkAvailability({
        propertyId: property.id,
        checkIn: form.checkIn,
        checkOut: form.checkOut,
        guests: form.guests,
      });

      if (!availability.available) {
        setFormError("Essas datas já não estão disponíveis. Escolhe outras no calendário.");
        return;
      }

      const reservation = await api.createReservation({
        propertyId: property.id,
        guestName: form.guestName,
        guestEmail: form.guestEmail,
        guestPhone: phone,
        checkIn: form.checkIn,
        checkOut: form.checkOut,
        guests: form.guests,
      });

      setConfirmation({
        guestName: reservation.guestName,
        guestEmail: form.guestEmail,
        checkIn: reservation.checkIn,
        checkOut: reservation.checkOut,
        guests: reservation.guests,
        totalPrice: reservation.totalPrice,
        currency: reservation.currency,
        emailSent: reservation.emailSent ?? false,
      });
      setCalendarMonth(parseDateKey(dateKeyFromIso(reservation.checkIn)));

      setForm({
        guestName: "",
        guestEmail: "",
        guestPhone: "",
        checkIn: "",
        checkOut: "",
        guests: 2,
      });
      await loadCalendar(property);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Não foi possível concluir a reserva");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div className="app-shell">A carregar…</div>;
  }

  if (error || !property) {
    return (
      <div className="app-shell">
        <div className="alert">{error ?? "Reservas indisponíveis de momento."}</div>
      </div>
    );
  }

  if (confirmation) {
    return (
      <div className="app-shell">
        <LogoHeader subtitle="Reserva recebida com sucesso" />
        <section className="panel success-panel">
          <h2>Obrigado, {confirmation.guestName}!</h2>
          <p>A tua reserva na Casa do Penedo foi registada.</p>
          <div className="confirmation-grid">
            <div>
              <span className="muted-text">Check-in</span>
              <strong>{formatDate(confirmation.checkIn)}</strong>
            </div>
            <div>
              <span className="muted-text">Check-out</span>
              <strong>{formatDate(confirmation.checkOut)}</strong>
            </div>
            <div>
              <span className="muted-text">Hóspedes</span>
              <strong>{confirmation.guests}</strong>
            </div>
            <div>
              <span className="muted-text">Total estimado</span>
              <strong>{formatMoney(confirmation.totalPrice, confirmation.currency)}</strong>
            </div>
          </div>
          <p className="muted-text">
            {confirmation.emailSent
              ? `Enviámos a confirmação para ${confirmation.guestEmail}.`
              : "A reserva foi registada. Receberás confirmação por email em breve."}
          </p>
          <p className="muted-text">
            Entraremos em contacto para confirmar pagamento e detalhes da estadia.
          </p>
          <button type="button" className="btn" onClick={() => setConfirmation(null)}>
            Fazer nova reserva
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <LogoHeader subtitle="Reserva directa — escolhe as datas e confirma a tua estadia" />

      <div className="layout">
        <section className="panel">
          <h2>Disponibilidade</h2>
          <CalendarView
            reservations={reservations}
            blocks={blocks}
            from={range.from}
            hideGuestNames
            monthLabel={range.label}
            selectedRange={
              form.checkIn && form.checkOut
                ? { checkIn: form.checkIn, checkOut: form.checkOut }
                : undefined
            }
            onPrevMonth={() =>
              setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))
            }
            onNextMonth={() =>
              setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))
            }
          />
        </section>

        <section className="stack">
          <div className="panel">
            <h2>Reservar</h2>
            <form className="stack" onSubmit={handleSubmit}>
              <div className="field">
                <label htmlFor="guestName">Nome completo</label>
                <input
                  id="guestName"
                  value={form.guestName}
                  onChange={(event) => setForm({ ...form, guestName: event.target.value })}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="guestEmail">Email</label>
                <input
                  id="guestEmail"
                  type="email"
                  value={form.guestEmail}
                  onChange={(event) => setForm({ ...form, guestEmail: event.target.value })}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="guestPhone">Telemóvel</label>
                <input
                  id="guestPhone"
                  type="tel"
                  value={form.guestPhone}
                  onChange={(event) => setForm({ ...form, guestPhone: event.target.value })}
                  placeholder="+351 912 345 678 ou outro país"
                  required
                  minLength={4}
                />
              </div>
              <div className="field-row">
                <DateField
                  id="checkIn"
                  label="Check-in"
                  value={form.checkIn}
                  onChange={(checkIn) => setForm({ ...form, checkIn })}
                  required
                />
                <DateField
                  id="checkOut"
                  label="Check-out"
                  value={form.checkOut}
                  onChange={(checkOut) => setForm({ ...form, checkOut })}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="guests">Hóspedes</label>
                <input
                  id="guests"
                  type="number"
                  min={1}
                  max={property.maxGuests}
                  value={form.guests}
                  onChange={(event) => setForm({ ...form, guests: Number(event.target.value) })}
                />
              </div>

              {quoteTotal !== null && (
                <div className="quote-box">
                  Total estimado da estadia
                  <strong>{formatMoney(quoteTotal, property.currency)}</strong>
                </div>
              )}

              {formError && <div className="alert">{formError}</div>}

              <button className="btn btn-large" type="submit" disabled={submitting}>
                {submitting ? "A enviar…" : "Confirmar reserva"}
              </button>
            </form>
          </div>

          <PricingInfo rules={pricingRules} />
        </section>
      </div>
    </div>
  );
}
