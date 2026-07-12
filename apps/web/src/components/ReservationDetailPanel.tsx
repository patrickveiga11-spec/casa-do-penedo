import { useEffect, useState } from "react";
import { api, type Property, type Reservation } from "../api";
import { DateField } from "./DateField";
import { ReservationCommsTimeline } from "./ReservationCommsTimeline";
import { dateKeyFromIso, formatDate, formatMoney } from "../lib/format";
import { PAYMENT_STATUS_LABELS, paymentBadgeClass } from "../lib/reservation-filters";

interface ReservationDetailPanelProps {
  reservation: Reservation;
  property: Property;
  editDiscount: number;
  editFinalPrice: number | null;
  detailSubtotal: number | null;
  detailLoading: boolean;
  detailNotice: string | null;
  detailError: string | null;
  savingDiscountId: string | null;
  validatingId: string | null;
  onEditDiscountChange: (value: number) => void;
  onEditFinalPriceChange: (value: number | null) => void;
  onSavePrice: () => void;
  onValidate: () => void;
  onUpdated: () => void;
  onNotice: (message: string) => void;
  onError: (message: string | null) => void;
}

export function ReservationDetailPanel({
  reservation,
  property,
  editDiscount,
  editFinalPrice,
  detailSubtotal,
  detailLoading,
  detailNotice,
  detailError,
  savingDiscountId,
  validatingId,
  onEditDiscountChange,
  onEditFinalPriceChange,
  onSavePrice,
  onValidate,
  onUpdated,
  onNotice,
  onError,
}: ReservationDetailPanelProps) {
  const [editingDetails, setEditingDetails] = useState(false);
  const [editGuestName, setEditGuestName] = useState(reservation.guestName);
  const [editGuestEmail, setEditGuestEmail] = useState(reservation.guestEmail ?? "");
  const [editGuestPhone, setEditGuestPhone] = useState(reservation.guestPhone ?? "");
  const [editCheckIn, setEditCheckIn] = useState(dateKeyFromIso(reservation.checkIn));
  const [editCheckOut, setEditCheckOut] = useState(dateKeyFromIso(reservation.checkOut));
  const [editGuests, setEditGuests] = useState(reservation.guests);
  const [editNotes, setEditNotes] = useState(reservation.notes ?? "");
  const [savingDetails, setSavingDetails] = useState(false);

  const [paymentStatus, setPaymentStatus] = useState(reservation.paymentStatus ?? "PENDING");
  const [amountPaid, setAmountPaid] = useState<string>(
    reservation.amountPaid != null ? String(reservation.amountPaid) : ""
  );
  const [savingPayment, setSavingPayment] = useState(false);

  const [resendingConfirmation, setResendingConfirmation] = useState(false);
  const [resendingWelcome, setResendingWelcome] = useState(false);

  useEffect(() => {
    setEditGuestName(reservation.guestName);
    setEditGuestEmail(reservation.guestEmail ?? "");
    setEditGuestPhone(reservation.guestPhone ?? "");
    setEditCheckIn(dateKeyFromIso(reservation.checkIn));
    setEditCheckOut(dateKeyFromIso(reservation.checkOut));
    setEditGuests(reservation.guests);
    setEditNotes(reservation.notes ?? "");
    setPaymentStatus(reservation.paymentStatus ?? "PENDING");
    setAmountPaid(reservation.amountPaid != null ? String(reservation.amountPaid) : "");
    setEditingDetails(false);
  }, [reservation.id, reservation.guestName, reservation.guestEmail, reservation.guestPhone, reservation.checkIn, reservation.checkOut, reservation.guests, reservation.notes, reservation.paymentStatus, reservation.amountPaid]);

  const detailFinalTotal =
    detailSubtotal !== null ? Math.round(detailSubtotal * (1 - editDiscount / 100) * 100) / 100 : null;

  async function handleSaveDetails() {
    setSavingDetails(true);
    onError(null);

    try {
      await api.updateReservationDetails(reservation.id, {
        guestName: editGuestName.trim(),
        guestEmail: editGuestEmail.trim() || null,
        guestPhone: editGuestPhone.trim(),
        checkIn: editCheckIn,
        checkOut: editCheckOut,
        guests: editGuests,
        notes: editNotes.trim() || null,
      });
      onNotice("Dados da reserva guardados.");
      setEditingDetails(false);
      onUpdated();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Erro ao guardar dados");
    } finally {
      setSavingDetails(false);
    }
  }

  async function handleSavePayment() {
    setSavingPayment(true);
    onError(null);

    try {
      await api.updateReservationPayment(reservation.id, {
        paymentStatus: paymentStatus as "PENDING" | "PARTIAL" | "PAID",
        amountPaid: amountPaid.trim() === "" ? null : Number(amountPaid),
      });
      onNotice("Pagamento actualizado.");
      onUpdated();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Erro ao guardar pagamento");
    } finally {
      setSavingPayment(false);
    }
  }

  async function handleResendConfirmation() {
    setResendingConfirmation(true);
    onError(null);

    try {
      const result = await api.resendConfirmationEmail(reservation.id);
      onNotice(
        result.type === "final"
          ? "Email de confirmação final reenviado."
          : "Email de confirmação provisória reenviado."
      );
    } catch (err) {
      onError(err instanceof Error ? err.message : "Erro ao reenviar confirmação");
    } finally {
      setResendingConfirmation(false);
    }
  }

  async function handleResendWelcome() {
    setResendingWelcome(true);
    onError(null);

    try {
      await api.resendWelcomeEmail(reservation.id);
      onNotice("Guia de boas-vindas reenviado.");
      onUpdated();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Erro ao reenviar guia");
    } finally {
      setResendingWelcome(false);
    }
  }

  return (
    <div className="reservation-detail">
      {detailNotice && <div className="alert success">{detailNotice}</div>}
      {detailError && <div className="alert">{detailError}</div>}

      <div className="detail-section-header">
        <h3>Dados da reserva</h3>
        {!editingDetails ? (
          <button type="button" className="btn secondary btn-small" onClick={() => setEditingDetails(true)}>
            Editar
          </button>
        ) : (
          <div className="detail-inline-actions">
            <button
              type="button"
              className="btn secondary btn-small"
              disabled={savingDetails}
              onClick={() => {
                setEditingDetails(false);
                setEditGuestName(reservation.guestName);
                setEditGuestEmail(reservation.guestEmail ?? "");
                setEditGuestPhone(reservation.guestPhone ?? "");
                setEditCheckIn(dateKeyFromIso(reservation.checkIn));
                setEditCheckOut(dateKeyFromIso(reservation.checkOut));
                setEditGuests(reservation.guests);
                setEditNotes(reservation.notes ?? "");
              }}
            >
              Cancelar
            </button>
            <button type="button" className="btn btn-small" disabled={savingDetails} onClick={handleSaveDetails}>
              {savingDetails ? "A guardar…" : "Guardar"}
            </button>
          </div>
        )}
      </div>

      {editingDetails ? (
        <div className="stack detail-edit-form">
          <div className="field">
            <label htmlFor={`edit-name-${reservation.id}`}>Hóspede</label>
            <input
              id={`edit-name-${reservation.id}`}
              value={editGuestName}
              onChange={(event) => setEditGuestName(event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor={`edit-email-${reservation.id}`}>Email</label>
            <input
              id={`edit-email-${reservation.id}`}
              type="email"
              value={editGuestEmail}
              onChange={(event) => setEditGuestEmail(event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor={`edit-phone-${reservation.id}`}>Telemóvel</label>
            <input
              id={`edit-phone-${reservation.id}`}
              type="tel"
              value={editGuestPhone}
              onChange={(event) => setEditGuestPhone(event.target.value)}
            />
          </div>
          <div className="field-row">
            <DateField
              id={`edit-checkin-${reservation.id}`}
              label="Check-in"
              value={editCheckIn}
              onChange={setEditCheckIn}
              required
            />
            <DateField
              id={`edit-checkout-${reservation.id}`}
              label="Check-out"
              value={editCheckOut}
              onChange={setEditCheckOut}
              required
            />
          </div>
          <div className="field">
            <label htmlFor={`edit-guests-${reservation.id}`}>Hóspedes</label>
            <input
              id={`edit-guests-${reservation.id}`}
              type="number"
              min={1}
              max={property.maxGuests}
              value={editGuests}
              onChange={(event) => setEditGuests(Number(event.target.value))}
            />
          </div>
          <div className="field">
            <label htmlFor={`edit-notes-${reservation.id}`}>Notas internas</label>
            <textarea
              id={`edit-notes-${reservation.id}`}
              rows={3}
              value={editNotes}
              placeholder="Preferências, acordos, observações…"
              onChange={(event) => setEditNotes(event.target.value)}
            />
          </div>
        </div>
      ) : (
        <>
          <div className="detail-grid">
            <div>
              <span className="muted-text">Email</span>
              <strong>{reservation.guestEmail ?? "—"}</strong>
            </div>
            <div>
              <span className="muted-text">Telemóvel</span>
              <strong>{reservation.guestPhone ?? "—"}</strong>
            </div>
            <div>
              <span className="muted-text">Check-in</span>
              <strong>{formatDate(reservation.checkIn)}</strong>
            </div>
            <div>
              <span className="muted-text">Check-out</span>
              <strong>{formatDate(reservation.checkOut)}</strong>
            </div>
            <div>
              <span className="muted-text">Hóspedes</span>
              <strong>{reservation.guests}</strong>
            </div>
            <div>
              <span className="muted-text">Valor final</span>
              <strong>{formatMoney(reservation.totalPrice, reservation.currency)}</strong>
            </div>
            <div>
              <span className="muted-text">Estado</span>
              <strong>{reservation.validatedAt ? "Validada" : "Pendente de validação"}</strong>
            </div>
            {reservation.accessCode && (
              <div className="detail-access-code">
                <span className="muted-text">Código de acesso</span>
                <strong className="access-code">{reservation.accessCode}</strong>
              </div>
            )}
          </div>

          {reservation.notes && (
            <div className="detail-notes">
              <span className="muted-text">Notas internas</span>
              <p>{reservation.notes}</p>
            </div>
          )}
        </>
      )}

      <ReservationCommsTimeline reservation={reservation} />

      <div className="detail-comms-actions">
        <button
          type="button"
          className="btn secondary btn-small"
          disabled={resendingConfirmation || !reservation.guestEmail}
          onClick={handleResendConfirmation}
        >
          {resendingConfirmation ? "A enviar…" : "Reenviar confirmação"}
        </button>
        {reservation.validatedAt && (
          <button
            type="button"
            className="btn secondary btn-small"
            disabled={resendingWelcome || !reservation.guestEmail}
            onClick={handleResendWelcome}
          >
            {resendingWelcome ? "A enviar…" : "Reenviar guia de boas-vindas"}
          </button>
        )}
      </div>

      <div className="detail-section-header">
        <h3>Pagamento</h3>
        <span className={`badge ${paymentBadgeClass(paymentStatus)}`}>
          {PAYMENT_STATUS_LABELS[paymentStatus] ?? paymentStatus}
        </span>
      </div>
      <div className="payment-form">
        <div className="field">
          <label htmlFor={`payment-status-${reservation.id}`}>Estado</label>
          <select
            id={`payment-status-${reservation.id}`}
            value={paymentStatus}
            onChange={(event) => setPaymentStatus(event.target.value)}
          >
            <option value="PENDING">Pendente</option>
            <option value="PARTIAL">Sinal / parcial</option>
            <option value="PAID">Pago</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor={`amount-paid-${reservation.id}`}>Valor recebido (€)</label>
          <input
            id={`amount-paid-${reservation.id}`}
            type="number"
            min={0}
            step={0.01}
            value={amountPaid}
            placeholder="Opcional"
            onChange={(event) => setAmountPaid(event.target.value)}
          />
        </div>
        <button type="button" className="btn secondary btn-small" disabled={savingPayment} onClick={handleSavePayment}>
          {savingPayment ? "A guardar…" : "Guardar pagamento"}
        </button>
      </div>

      <div className="detail-section-header">
        <h3>Preço acordado</h3>
      </div>

      <div className="field">
        <label htmlFor={`discount-${reservation.id}`}>Desconto (%)</label>
        <input
          id={`discount-${reservation.id}`}
          type="number"
          min={0}
          max={100}
          step={1}
          value={editDiscount}
          onChange={(event) => {
            const discount = Number(event.target.value) || 0;
            onEditDiscountChange(discount);
            if (detailSubtotal !== null) {
              onEditFinalPriceChange(Math.round(detailSubtotal * (1 - discount / 100) * 100) / 100);
            }
          }}
        />
      </div>

      <div className="field">
        <label htmlFor={`final-price-${reservation.id}`}>Valor final acordado (€)</label>
        <input
          id={`final-price-${reservation.id}`}
          type="number"
          min={0}
          step={0.01}
          value={editFinalPrice ?? ""}
          onChange={(event) =>
            onEditFinalPriceChange(event.target.value === "" ? null : Number(event.target.value))
          }
        />
        <p className="muted-text">
          Podes usar o desconto acima ou indicar directamente o valor acordado com o cliente.
        </p>
      </div>

      {detailLoading ? (
        <p className="muted-text">A calcular preço…</p>
      ) : detailSubtotal !== null ? (
        <div className="quote-box">
          Valor calculado pela plataforma
          <strong>{formatMoney(detailSubtotal, reservation.currency)}</strong>
          {editDiscount > 0 && (
            <>
              Total com {editDiscount}% de desconto
              <strong>{formatMoney(detailFinalTotal ?? detailSubtotal, reservation.currency)}</strong>
            </>
          )}
        </div>
      ) : null}

      <div className="detail-actions">
        <button
          type="button"
          className="btn secondary"
          disabled={savingDiscountId === reservation.id || detailLoading || editFinalPrice === null}
          onClick={onSavePrice}
        >
          {savingDiscountId === reservation.id ? "A guardar…" : "Guardar preço"}
        </button>
        {!reservation.validatedAt && (
          <button
            type="button"
            className="btn"
            disabled={
              validatingId === reservation.id || !reservation.guestEmail || savingDiscountId === reservation.id
            }
            onClick={onValidate}
          >
            {validatingId === reservation.id ? "A validar…" : "Validar reserva"}
          </button>
        )}
      </div>
      {!reservation.guestEmail && !reservation.validatedAt && (
        <p className="muted-text">Sem email — não é possível validar.</p>
      )}
    </div>
  );
}
