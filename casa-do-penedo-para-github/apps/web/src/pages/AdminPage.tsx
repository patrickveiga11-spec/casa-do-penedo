import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  api,
  type Kpis,
  type PricingRule,
  type Property,
  type Reservation,
} from "../api";
import { CalendarView } from "../components/CalendarView";
import { DateField } from "../components/DateField";
import { LogoHeader } from "../components/LogoHeader";
import { PricingInfo } from "../components/PricingInfo";
import { ReservationDatesLink } from "../components/ReservationDatesLink";
import { formatDate, formatMoney, monthRange, dateKeyFromIso, parseDateKey, startOfMonth } from "../lib/format";

function currentYear() {
  return new Date().getFullYear();
}

function isInCurrentYear(date: Date) {
  return date.getFullYear() === currentYear();
}

export default function AdminPage() {
  const [property, setProperty] = useState<Property | null>(null);
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [pricingRules, setPricingRules] = useState<PricingRule[]>([]);
  const [blocks, setBlocks] = useState<{ startDate: string; endDate: string; reason: string | null }[]>([]);
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
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => startOfMonth(new Date()));
  const [calendarFocusRange, setCalendarFocusRange] = useState<
    { checkIn: string; checkOut: string } | undefined
  >();

  const range = monthRange(calendarMonth);
  const kpiMonth = `${calendarMonth.getFullYear()}-${String(calendarMonth.getMonth() + 1).padStart(2, "0")}`;
  const kpiMonthLabel = calendarMonth.toLocaleDateString("pt-PT", { month: "long", year: "numeric" });
  const sortedReservations = [...reservations].sort((a, b) =>
    dateKeyFromIso(b.checkIn).localeCompare(dateKeyFromIso(a.checkIn))
  );

  async function loadAll(selectedProperty: Property) {
    const [kpiData, calendar, reservationData, ruleData] = await Promise.all([
      api.getKpis(selectedProperty.id, kpiMonth),
      api.getCalendar(selectedProperty.id, range.from, range.to, true),
      api.getReservations(selectedProperty.id),
      api.getPricingRules(selectedProperty.id),
    ]);

    setKpis(kpiData);
    setReservations(reservationData);
    setPricingRules(ruleData);
    setBlocks(calendar.blocks);
  }

  useEffect(() => {
    async function bootstrap() {
      try {
        const properties = await api.getProperties();
        const selected = properties[0] ?? null;
        setProperty(selected);
        if (selected) {
          await loadAll(selected);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Falha ao carregar dados");
      } finally {
        setLoading(false);
      }
    }

    bootstrap();
  }, []);

  useEffect(() => {
    if (!property) return;

    loadAll(property).catch(() => undefined);
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
      .catch((err) => {
        setQuoteTotal(null);
        setFormError(err instanceof Error ? err.message : "Erro ao calcular preço");
      });
  }, [form.checkIn, form.checkOut, form.guests, property?.id]);

  function openReservationOnCalendar(reservation: Reservation) {
    setCalendarMonth(parseDateKey(dateKeyFromIso(reservation.checkIn)));
    setCalendarFocusRange({
      checkIn: dateKeyFromIso(reservation.checkIn),
      checkOut: dateKeyFromIso(reservation.checkOut),
    });
    document.getElementById("admin-calendar")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function handleCreateReservation(event: React.FormEvent) {
    event.preventDefault();
    if (!property) return;

    setSubmitting(true);
    setFormError(null);

    try {
      const availability = await api.checkAvailability({
        propertyId: property.id,
        checkIn: form.checkIn,
        checkOut: form.checkOut,
        guests: form.guests,
      });

      if (!availability.available) {
        const conflict = availability.conflicts[0];
        setFormError(
          `Conflito com ${conflict.label} (${formatDate(conflict.startDate)} → ${formatDate(conflict.endDate)})`
        );
        return;
      }

      await api.createReservation({
        propertyId: property.id,
        guestName: form.guestName,
        guestEmail: form.guestEmail || undefined,
        guestPhone: form.guestPhone.trim(),
        checkIn: form.checkIn,
        checkOut: form.checkOut,
        guests: form.guests,
      });

      setForm({ guestName: "", guestEmail: "", guestPhone: "", checkIn: "", checkOut: "", guests: 2 });
      await loadAll(property);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Erro ao criar reserva");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteReservation(reservation: Reservation) {
    if (!property) return;

    setDeletingId(reservation.id);
    setDeleteError(null);

    try {
      await api.deleteReservation(reservation.id);
      setConfirmDeleteId(null);
      await loadAll(property);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Não foi possível suprimir a reserva");
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return <div className="app-shell">A carregar gestão…</div>;
  }

  if (error || !property) {
    return (
      <div className="app-shell">
        <div className="alert">{error ?? "Nenhuma propriedade encontrada."}</div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <div className="admin-bar">
        <Link to="/" className="admin-link">
          ← Ver página pública
        </Link>
        <button
          type="button"
          className="admin-link admin-logout"
          onClick={() => api.logoutAdmin().then(() => window.location.reload())}
        >
          Sair da gestão
        </button>
      </div>

      <LogoHeader subtitle="Painel de gestão — reservas, calendário e tarifas" />

      {kpis && (
        <section className="kpi-grid">
          <p className="kpi-month-label muted-text">Indicadores de {kpiMonthLabel}</p>
          <div className="kpi-card">
            <span>Reservas (mês)</span>
            <strong>{kpis.reservations}</strong>
          </div>
          <div className="kpi-card">
            <span>Receita estimada</span>
            <strong>{formatMoney(kpis.revenue)}</strong>
          </div>
          <div className="kpi-card">
            <span>Ocupação</span>
            <strong>{kpis.occupancyRate}%</strong>
          </div>
          <div className="kpi-card">
            <span>Noites reservadas</span>
            <strong>{kpis.bookedNights}</strong>
          </div>
        </section>
      )}

      <div className="layout">
        <section className="panel" id="admin-calendar">
          <h2>Calendário {currentYear()}</h2>
          <CalendarView
            reservations={reservations}
            blocks={blocks}
            from={range.from}
            focusRange={calendarFocusRange}
            monthLabel={range.label}
            onToday={() => {
              setCalendarFocusRange(undefined);
              setCalendarMonth(startOfMonth(new Date()));
            }}
            onPrevMonth={
              isInCurrentYear(calendarMonth) && calendarMonth.getMonth() === 0
                ? undefined
                : () => {
                    setCalendarFocusRange(undefined);
                    const next = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1);
                    setCalendarMonth(
                      isInCurrentYear(next) ? next : startOfMonth(new Date(currentYear(), 11, 1))
                    );
                  }
            }
            onNextMonth={
              isInCurrentYear(calendarMonth) && calendarMonth.getMonth() === 11
                ? undefined
                : () => {
                    setCalendarFocusRange(undefined);
                    const next = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1);
                    setCalendarMonth(
                      isInCurrentYear(next) ? next : startOfMonth(new Date(currentYear(), 0, 1))
                    );
                  }
            }
          />
        </section>

        <section className="stack">
          <div className="panel">
            <h2>Reservas activas</h2>
            <p className="muted-text panel-hint">Clica em «Suprimir» para cancelar uma reserva.</p>
            {deleteError && <div className="alert">{deleteError}</div>}
            {sortedReservations.length === 0 ? (
              <p className="empty">Sem reservas.</p>
            ) : (
              sortedReservations.map((reservation) => (
                <div className="list-item reservation-item" key={reservation.id}>
                  <div>
                    <strong>{reservation.guestName}</strong>
                    <ReservationDatesLink
                      checkIn={reservation.checkIn}
                      checkOut={reservation.checkOut}
                      guests={reservation.guests}
                      onOpenCalendar={() => openReservationOnCalendar(reservation)}
                    />
                  </div>
                  <div className="reservation-actions">
                    <div className="reservation-price">
                      <div>{formatMoney(reservation.totalPrice, reservation.currency)}</div>
                      <span className="badge">{reservation.status}</span>
                    </div>
                    {confirmDeleteId === reservation.id ? (
                      <div className="confirm-delete">
                        <span className="muted-text">Suprimir?</span>
                        <button
                          type="button"
                          className="btn btn-danger btn-small"
                          disabled={deletingId === reservation.id}
                          onClick={() => handleDeleteReservation(reservation)}
                        >
                          {deletingId === reservation.id ? "A suprimir…" : "Sim"}
                        </button>
                        <button
                          type="button"
                          className="btn secondary btn-small"
                          disabled={deletingId === reservation.id}
                          onClick={() => {
                            setConfirmDeleteId(null);
                            setDeleteError(null);
                          }}
                        >
                          Não
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-danger btn-small"
                        onClick={() => {
                          setConfirmDeleteId(reservation.id);
                          setDeleteError(null);
                        }}
                      >
                        Suprimir
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="panel">
            <h2>Nova reserva (manual)</h2>
            <form className="stack" onSubmit={handleCreateReservation}>
              <div className="field">
                <label htmlFor="guestName">Hóspede</label>
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
                />
              </div>
              <div className="field">
                <label htmlFor="adminGuestPhone">Telemóvel</label>
                <input
                  id="adminGuestPhone"
                  type="tel"
                  value={form.guestPhone}
                  onChange={(event) => setForm({ ...form, guestPhone: event.target.value })}
                  required
                />
              </div>
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
                  Preço estimado
                  <strong>{formatMoney(quoteTotal, property.currency)}</strong>
                </div>
              )}

              {formError && <div className="alert">{formError}</div>}

              <button className="btn" type="submit" disabled={submitting}>
                {submitting ? "A guardar…" : "Criar reserva"}
              </button>
            </form>
          </div>
        </section>
      </div>

      <div style={{ marginTop: 24 }}>
        <PricingInfo rules={pricingRules} />
      </div>
    </div>
  );
}
