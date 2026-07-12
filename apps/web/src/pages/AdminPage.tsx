import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  api,
  type AvailabilityBlock,
  type Kpis,
  type MonthlyRevenue,
  type PricingRule,
  type Property,
  type Reservation,
} from "../api";
import { CalendarView } from "../components/CalendarView";
import { DateField } from "../components/DateField";
import { GuestsRegistryPanel } from "../components/GuestsRegistryPanel";
import { MonthlyRevenueChart } from "../components/MonthlyRevenueChart";
import { LogoHeader } from "../components/LogoHeader";
import { PricingInfo } from "../components/PricingInfo";
import { CommsAlertBanner } from "../components/CommsAlertBanner";
import { ReservationCommsIcons } from "../components/ReservationCommsIcons";
import { ReservationDetailPanel } from "../components/ReservationDetailPanel";
import { WeekOverviewPanel } from "../components/WeekOverviewPanel";
import { ReservationDatesLink } from "../components/ReservationDatesLink";
import { formatDate, formatMoney, monthRange, dateKeyFromIso, parseDateKey, startOfMonth } from "../lib/format";
import {
  buildWeekOverview,
  filterReservationsByTab,
  PAYMENT_STATUS_LABELS,
  paymentBadgeClass,
  searchReservations,
  type ReservationListTab,
} from "../lib/reservation-filters";

function currentYear() {
  return new Date().getFullYear();
}

function isInCurrentYear(date: Date) {
  return date.getFullYear() === currentYear();
}

export default function AdminPage() {
  const [property, setProperty] = useState<Property | null>(null);
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [monthlyRevenue, setMonthlyRevenue] = useState<MonthlyRevenue | null>(null);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [pricingRules, setPricingRules] = useState<PricingRule[]>([]);
  const [blocks, setBlocks] = useState<AvailabilityBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    guestName: "",
    guestEmail: "",
    guestPhone: "",
    checkIn: "",
    checkOut: "",
    guests: 2,
    discountPercent: 0,
  });
  const [deleteNotice, setDeleteNotice] = useState<string | null>(null);
  const [selectedReservationId, setSelectedReservationId] = useState<string | null>(null);
  const [editDiscount, setEditDiscount] = useState(0);
  const [editFinalPrice, setEditFinalPrice] = useState<number | null>(null);
  const [detailSubtotal, setDetailSubtotal] = useState<number | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailNotice, setDetailNotice] = useState<string | null>(null);
  const [savingDiscountId, setSavingDiscountId] = useState<string | null>(null);
  const [validatingId, setValidatingId] = useState<string | null>(null);
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
  const [pendingAlert, setPendingAlert] = useState<string | null>(null);
  const knownPendingIdsRef = useRef<Set<string> | null>(null);
  const [blockForm, setBlockForm] = useState({ startDate: "", endDate: "", reason: "" });
  const [blockError, setBlockError] = useState<string | null>(null);
  const [blockNotice, setBlockNotice] = useState<string | null>(null);
  const [submittingBlock, setSubmittingBlock] = useState(false);
  const [deletingBlockId, setDeletingBlockId] = useState<string | null>(null);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [editBlockForm, setEditBlockForm] = useState({ startDate: "", endDate: "", reason: "" });
  const [savingBlockId, setSavingBlockId] = useState<string | null>(null);
  const [reservationTab, setReservationTab] = useState<ReservationListTab>("upcoming");
  const [reservationSearch, setReservationSearch] = useState("");
  const sortedBlocks = [...blocks].sort((a, b) =>
    dateKeyFromIso(a.startDate).localeCompare(dateKeyFromIso(b.startDate))
  );

  const range = monthRange(calendarMonth);
  const kpiMonth = `${calendarMonth.getFullYear()}-${String(calendarMonth.getMonth() + 1).padStart(2, "0")}`;
  const kpiMonthLabel = calendarMonth.toLocaleDateString("pt-PT", { month: "long", year: "numeric" });
  const sortedReservations = [...reservations].sort((a, b) =>
    dateKeyFromIso(b.checkIn).localeCompare(dateKeyFromIso(a.checkIn))
  );
  const weekOverview = buildWeekOverview(sortedReservations);
  const tabReservations = filterReservationsByTab(sortedReservations, reservationTab);
  const visibleReservations = searchReservations(tabReservations, reservationSearch);
  const pendingReservations = sortedReservations.filter((reservation) => reservation.status === "PENDING");
  const finalQuoteTotal =
    quoteTotal !== null ? Math.round(quoteTotal * (1 - form.discountPercent / 100) * 100) / 100 : null;

  async function loadAll(selectedProperty: Property) {
    const [kpiData, revenueData, reservationData, ruleData, blockData] = await Promise.all([
      api.getKpis(selectedProperty.id, kpiMonth),
      api.getMonthlyRevenue(selectedProperty.id, currentYear()),
      api.getReservations(selectedProperty.id),
      api.getPricingRules(selectedProperty.id),
      api.getBlocks(selectedProperty.id),
    ]);

    setKpis(kpiData);
    setMonthlyRevenue(revenueData);
    setReservations(reservationData);
    setPricingRules(ruleData);
    setBlocks(blockData);

    const pendingIds = new Set(
      reservationData.filter((reservation) => reservation.status === "PENDING").map((reservation) => reservation.id)
    );
    knownPendingIdsRef.current = pendingIds;
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

    const interval = window.setInterval(() => {
      api
        .getReservations(property.id)
        .then((reservationData) => {
          const pending = reservationData.filter((reservation) => reservation.status === "PENDING");
          const knownIds = knownPendingIdsRef.current ?? new Set<string>();
          const freshPending = pending.filter((reservation) => !knownIds.has(reservation.id));

          if (knownPendingIdsRef.current && freshPending.length > 0) {
            setPendingAlert(`Nova reserva: ${freshPending[0].guestName}`);
          }

          knownPendingIdsRef.current = new Set(pending.map((reservation) => reservation.id));
          setReservations(reservationData);
        })
        .catch(() => undefined);
    }, 20000);

    return () => window.clearInterval(interval);
  }, [property?.id]);

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

  function focusReservationById(id: string) {
    const reservation = reservations.find((item) => item.id === id);
    if (!reservation) return;

    if (selectedReservationId !== id) {
      void openReservationDetails(reservation);
    }

    window.setTimeout(() => {
      document.getElementById(`reservation-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
  }

  async function refreshDetailQuote(reservation: Reservation) {
    if (!property) return;

    setDetailLoading(true);
    try {
      const quote = await api.getQuote({
        propertyId: property.id,
        checkIn: dateKeyFromIso(reservation.checkIn),
        checkOut: dateKeyFromIso(reservation.checkOut),
        guests: reservation.guests,
      });
      setDetailSubtotal(quote.subtotal);
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : "Erro ao calcular preço");
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleReservationUpdated() {
    if (!property) return;

    const previousId = selectedReservationId;
    await loadAll(property);

    if (previousId) {
      const updated = (await api.getReservations(property.id)).find((item) => item.id === previousId);
      if (updated) {
        await refreshDetailQuote(updated);
      }
    }
  }

  async function openReservationDetails(reservation: Reservation) {
    if (selectedReservationId === reservation.id) {
      setSelectedReservationId(null);
      setDetailError(null);
      setDetailNotice(null);
      return;
    }

    if (!property) return;

    setSelectedReservationId(reservation.id);
    setDetailError(null);
    setDetailNotice(null);
    setEditDiscount(Number(reservation.discountPercent ?? 0));
    setEditFinalPrice(Number(reservation.totalPrice));
    setDetailSubtotal(null);
    await refreshDetailQuote(reservation);
  }

  async function handleSavePrice(reservation: Reservation) {
    if (!property || editFinalPrice === null) return;

    setSavingDiscountId(reservation.id);
    setDetailError(null);
    setDetailNotice(null);

    try {
      await api.updateReservationPricing(reservation.id, {
        totalPrice: editFinalPrice,
        ...(editDiscount > 0 ? { discountPercent: editDiscount } : {}),
      });
      setDetailNotice("Preço guardado.");
      await loadAll(property);
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : "Erro ao guardar preço");
    } finally {
      setSavingDiscountId(null);
    }
  }

  async function handleValidateReservation(reservation: Reservation) {
    if (!property) return;

    setValidatingId(reservation.id);
    setDetailError(null);
    setDetailNotice(null);

    try {
      const result = await api.validateReservation(reservation.id);
      const codeNote = result.accessCode ? ` Código de acesso: ${result.accessCode}.` : "";
      const welcomeNote =
        result.welcomeEmailSent === false && result.welcomeEmailNote
          ? ` (${result.welcomeEmailNote})`
          : result.welcomeEmailSent
            ? " Guia de boas-vindas enviado."
            : "";
      setDetailNotice(`Reserva validada. Enviámos email de confirmação ao hóspede.${codeNote}${welcomeNote}`);
      await loadAll(property);
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : "Erro ao validar reserva");
    } finally {
      setValidatingId(null);
    }
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

      await api.createReservation(
        {
          propertyId: property.id,
          guestName: form.guestName,
          guestEmail: form.guestEmail || undefined,
          guestPhone: form.guestPhone.trim(),
          checkIn: form.checkIn,
          checkOut: form.checkOut,
          guests: form.guests,
          discountPercent: form.discountPercent > 0 ? form.discountPercent : undefined,
        },
        true
      );

      setForm({
        guestName: "",
        guestEmail: "",
        guestPhone: "",
        checkIn: "",
        checkOut: "",
        guests: 2,
        discountPercent: 0,
      });
      await loadAll(property);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Erro ao criar reserva");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreateBlock(event: React.FormEvent) {
    event.preventDefault();
    if (!property) return;

    setSubmittingBlock(true);
    setBlockError(null);
    setBlockNotice(null);

    try {
      await api.createBlock({
        propertyId: property.id,
        startDate: blockForm.startDate,
        endDate: blockForm.endDate,
        reason: blockForm.reason.trim() || undefined,
      });
      setBlockForm({ startDate: "", endDate: "", reason: "" });
      setBlockNotice("Datas bloqueadas. Já não aparecem disponíveis na página pública.");
      await loadAll(property);
    } catch (err) {
      setBlockError(err instanceof Error ? err.message : "Erro ao bloquear datas");
    } finally {
      setSubmittingBlock(false);
    }
  }

  async function handleDeleteBlock(blockId: string) {
    if (!property) return;

    setDeletingBlockId(blockId);
    setBlockError(null);
    setBlockNotice(null);

    try {
      await api.deleteBlock(blockId);
      if (editingBlockId === blockId) {
        setEditingBlockId(null);
      }
      setBlockNotice("Bloqueio removido. As datas voltam a ficar disponíveis.");
      await loadAll(property);
    } catch (err) {
      setBlockError(err instanceof Error ? err.message : "Erro ao remover bloqueio");
    } finally {
      setDeletingBlockId(null);
    }
  }

  function startEditingBlock(block: AvailabilityBlock) {
    setEditingBlockId(block.id);
    setEditBlockForm({
      startDate: dateKeyFromIso(block.startDate),
      endDate: dateKeyFromIso(block.endDate),
      reason: block.reason ?? "",
    });
    setBlockError(null);
    setBlockNotice(null);
  }

  async function handleSaveBlock(blockId: string) {
    if (!property) return;

    setSavingBlockId(blockId);
    setBlockError(null);
    setBlockNotice(null);

    try {
      await api.updateBlock(blockId, {
        startDate: editBlockForm.startDate,
        endDate: editBlockForm.endDate,
        reason: editBlockForm.reason.trim() || undefined,
      });
      setEditingBlockId(null);
      setBlockNotice("Bloqueio actualizado.");
      await loadAll(property);
    } catch (err) {
      setBlockError(err instanceof Error ? err.message : "Erro ao actualizar bloqueio");
    } finally {
      setSavingBlockId(null);
    }
  }

  async function handleDeleteReservation(reservation: Reservation) {
    if (!property) return;

    setDeletingId(reservation.id);
    setDeleteError(null);

    try {
      const result = await api.deleteReservation(reservation.id);
      setConfirmDeleteId(null);
      if (reservation.guestEmail) {
        setDeleteNotice(
          result.emailSent
            ? "Reserva anulada. Enviámos email de anulação ao hóspede."
            : `Reserva anulada, mas não foi possível enviar email de anulação${result.emailError ? `: ${result.emailError}` : "."}`
        );
      } else {
        setDeleteNotice("Reserva anulada (sem email do cliente).");
      }
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
          className="admin-link"
          onClick={() => document.getElementById("admin-guests")?.scrollIntoView({ behavior: "smooth" })}
        >
          Base de hóspedes
        </button>
        <button
          type="button"
          className="admin-link admin-logout"
          onClick={() => api.logoutAdmin().then(() => window.location.reload())}
        >
          Sair da gestão
        </button>
      </div>

      <LogoHeader subtitle="Painel de gestão — reservas, calendário, tarifas e base de hóspedes" />

      {pendingReservations.length > 0 && (
        <section className="admin-alert admin-alert-pending">
          <div>
            <strong>
              {pendingReservations.length === 1
                ? "1 reserva pendente de validação"
                : `${pendingReservations.length} reservas pendentes de validação`}
            </strong>
            {pendingAlert && <p>{pendingAlert}</p>}
          </div>
          <button
            type="button"
            className="button-secondary"
            onClick={() => {
              document.getElementById("admin-reservations")?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            Ver pendentes
          </button>
        </section>
      )}

      <CommsAlertBanner reservations={sortedReservations} onSelectReservation={focusReservationById} />

      <WeekOverviewPanel overview={weekOverview} onSelectReservation={focusReservationById} />

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

          <div className="block-panel">
            <h3>Bloquear datas</h3>
            <p className="muted-text panel-hint">
              Marca dias como indisponíveis sem criar reserva. Aparecem a vermelho no calendário e como «Ocupado» na
              página pública. Usa «Editar» para alterar datas ou motivo sem desbloquear.
            </p>
            {blockNotice && <div className="alert success">{blockNotice}</div>}
            {blockError && <div className="alert">{blockError}</div>}
            <form className="stack block-form" onSubmit={handleCreateBlock}>
              <div className="field-row">
                <DateField
                  id="blockStart"
                  label="Desde"
                  value={blockForm.startDate}
                  onChange={(startDate) =>
                    setBlockForm((current) => ({
                      ...current,
                      startDate,
                      endDate: current.endDate || startDate,
                    }))
                  }
                  required
                />
                <DateField
                  id="blockEnd"
                  label="Até"
                  value={blockForm.endDate}
                  onChange={(endDate) => setBlockForm((current) => ({ ...current, endDate }))}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="blockReason">Motivo (opcional)</label>
                <input
                  id="blockReason"
                  value={blockForm.reason}
                  placeholder="Ex: Uso pessoal, manutenção"
                  onChange={(event) => setBlockForm((current) => ({ ...current, reason: event.target.value }))}
                />
              </div>
              <button className="btn secondary" type="submit" disabled={submittingBlock}>
                {submittingBlock ? "A bloquear…" : "Bloquear datas"}
              </button>
            </form>

            {sortedBlocks.length > 0 && (
              <div className="block-list">
                <h4>Bloqueios activos</h4>
                {sortedBlocks.map((block) => (
                  <div className="block-row" key={block.id}>
                    <div className="list-item block-item">
                      <div>
                        <strong>
                          {formatDate(block.startDate)}
                          {dateKeyFromIso(block.startDate) !== dateKeyFromIso(block.endDate)
                            ? ` → ${formatDate(block.endDate)}`
                            : ""}
                        </strong>
                        <div className="muted-text">{block.reason ?? "Bloqueio manual"}</div>
                      </div>
                      <div className="block-actions">
                        <button
                          type="button"
                          className="btn secondary btn-small"
                          disabled={savingBlockId === block.id || deletingBlockId === block.id}
                          onClick={() =>
                            editingBlockId === block.id ? setEditingBlockId(null) : startEditingBlock(block)
                          }
                        >
                          {editingBlockId === block.id ? "Fechar" : "Editar"}
                        </button>
                        <button
                          type="button"
                          className="btn secondary btn-small"
                          disabled={deletingBlockId === block.id || savingBlockId === block.id}
                          onClick={() => handleDeleteBlock(block.id)}
                        >
                          {deletingBlockId === block.id ? "A remover…" : "Desbloquear"}
                        </button>
                      </div>
                    </div>

                    {editingBlockId === block.id && (
                      <form
                        className="stack block-edit-form"
                        onSubmit={(event) => {
                          event.preventDefault();
                          void handleSaveBlock(block.id);
                        }}
                      >
                        <div className="field-row">
                          <DateField
                            id={`blockEditStart-${block.id}`}
                            label="Desde"
                            value={editBlockForm.startDate}
                            onChange={(startDate) =>
                              setEditBlockForm((current) => ({
                                ...current,
                                startDate,
                                endDate: current.endDate || startDate,
                              }))
                            }
                            required
                          />
                          <DateField
                            id={`blockEditEnd-${block.id}`}
                            label="Até"
                            value={editBlockForm.endDate}
                            onChange={(endDate) => setEditBlockForm((current) => ({ ...current, endDate }))}
                            required
                          />
                        </div>
                        <div className="field">
                          <label htmlFor={`blockEditReason-${block.id}`}>Motivo</label>
                          <input
                            id={`blockEditReason-${block.id}`}
                            value={editBlockForm.reason}
                            placeholder="Ex: Uso pessoal, manutenção"
                            onChange={(event) =>
                              setEditBlockForm((current) => ({ ...current, reason: event.target.value }))
                            }
                          />
                        </div>
                        <div className="detail-inline-actions">
                          <button
                            type="button"
                            className="btn secondary btn-small"
                            disabled={savingBlockId === block.id}
                            onClick={() => setEditingBlockId(null)}
                          >
                            Cancelar
                          </button>
                          <button type="submit" className="btn btn-small" disabled={savingBlockId === block.id}>
                            {savingBlockId === block.id ? "A guardar…" : "Guardar alterações"}
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="stack">
          <div className="panel" id="admin-reservations">
            <h2>Reservas</h2>
            <p className="muted-text panel-hint">
              «Detalhes» → editar dados, notas, pagamento e reenviar emails. «Validar» envia email final ao cliente.
            </p>
            <div className="reservation-toolbar">
              <div className="reservation-tabs">
                <button
                  type="button"
                  className={reservationTab === "upcoming" ? "tab-btn active" : "tab-btn"}
                  onClick={() => setReservationTab("upcoming")}
                >
                  Próximas
                </button>
                <button
                  type="button"
                  className={reservationTab === "past" ? "tab-btn active" : "tab-btn"}
                  onClick={() => setReservationTab("past")}
                >
                  Anteriores
                </button>
              </div>
              <input
                className="reservation-search"
                type="search"
                placeholder="Pesquisar hóspede, email ou telemóvel…"
                value={reservationSearch}
                onChange={(event) => setReservationSearch(event.target.value)}
              />
            </div>
            {deleteNotice && <div className="alert success">{deleteNotice}</div>}
            {deleteError && <div className="alert">{deleteError}</div>}
            {visibleReservations.length === 0 ? (
              <p className="empty">
                {reservationSearch.trim()
                  ? "Nenhuma reserva encontrada para esta pesquisa."
                  : reservationTab === "upcoming"
                    ? "Sem reservas futuras."
                    : "Sem reservas anteriores."}
              </p>
            ) : (
              visibleReservations.map((reservation) => (
                <div className="reservation-row" id={`reservation-${reservation.id}`} key={reservation.id}>
                  <div className="list-item reservation-item">
                    <div>
                      <strong>{reservation.guestName}</strong>
                      <ReservationDatesLink
                        checkIn={reservation.checkIn}
                        checkOut={reservation.checkOut}
                        guests={reservation.guests}
                        onOpenCalendar={() => openReservationOnCalendar(reservation)}
                      />
                      <ReservationCommsIcons reservation={reservation} />
                    </div>
                    <div className="reservation-actions">
                      <div className="reservation-price">
                        <div>{formatMoney(reservation.totalPrice, reservation.currency)}</div>
                        {reservation.discountPercent && Number(reservation.discountPercent) > 0 && (
                          <span className="muted-text">Desconto {reservation.discountPercent}%</span>
                        )}
                        <span className={`badge ${reservation.validatedAt ? "badge-ok" : "badge-pending"}`}>
                          {reservation.validatedAt ? "Validada" : "Pendente"}
                        </span>
                        <span
                          className={`badge ${paymentBadgeClass(reservation.paymentStatus ?? "PENDING")}`}
                          title="Estado de pagamento"
                        >
                          {PAYMENT_STATUS_LABELS[reservation.paymentStatus ?? "PENDING"] ?? "Pendente"}
                        </span>
                        {reservation.accessCode && (
                          <span className="badge badge-access" title="Código de acesso">
                            PIN {reservation.accessCode}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        className="btn secondary btn-small"
                        onClick={() => openReservationDetails(reservation)}
                      >
                        {selectedReservationId === reservation.id ? "Fechar" : "Detalhes"}
                      </button>
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

                  {selectedReservationId === reservation.id && property && (
                    <ReservationDetailPanel
                      reservation={reservation}
                      property={property}
                      editDiscount={editDiscount}
                      editFinalPrice={editFinalPrice}
                      detailSubtotal={detailSubtotal}
                      detailLoading={detailLoading}
                      detailNotice={detailNotice}
                      detailError={detailError}
                      savingDiscountId={savingDiscountId}
                      validatingId={validatingId}
                      onEditDiscountChange={setEditDiscount}
                      onEditFinalPriceChange={setEditFinalPrice}
                      onSavePrice={() => handleSavePrice(reservation)}
                      onValidate={() => handleValidateReservation(reservation)}
                      onUpdated={handleReservationUpdated}
                      onNotice={setDetailNotice}
                      onError={setDetailError}
                    />
                  )}
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
              <div className="field">
                <label htmlFor="discountPercent">Desconto (%)</label>
                <input
                  id="discountPercent"
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={form.discountPercent}
                  onChange={(event) =>
                    setForm({ ...form, discountPercent: Number(event.target.value) || 0 })
                  }
                />
              </div>

              {quoteTotal !== null && (
                <div className="quote-box">
                  {form.discountPercent > 0 ? (
                    <>
                      Preço antes do desconto
                      <strong>{formatMoney(quoteTotal, property.currency)}</strong>
                      Total com {form.discountPercent}% de desconto
                      <strong>{formatMoney(finalQuoteTotal ?? quoteTotal, property.currency)}</strong>
                    </>
                  ) : (
                    <>
                      Preço estimado
                      <strong>{formatMoney(quoteTotal, property.currency)}</strong>
                    </>
                  )}
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

      <GuestsRegistryPanel />

      <div style={{ marginTop: 24 }}>
        <PricingInfo rules={pricingRules} />
      </div>

      {monthlyRevenue && <MonthlyRevenueChart data={monthlyRevenue} />}
    </div>
  );
}
