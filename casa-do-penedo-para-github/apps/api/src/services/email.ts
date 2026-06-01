import nodemailer from "nodemailer";
import type { Property, Reservation } from "@prisma/client";

interface ReservationEmailInput {
  reservation: Reservation;
  property: Property;
}

export interface EmailSendResult {
  sent: boolean;
  reason?: string;
}

interface EmailPayload {
  to: string;
  toName?: string;
  subject: string;
  text: string;
  html: string;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("pt-PT", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatMoney(value: number | string, currency: string): string {
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency }).format(Number(value));
}

function parseFromAddress(from: string) {
  const match = from.match(/^(.+?)\s*<([^>]+)>$/);
  if (match) {
    return { name: match[1].trim().replace(/^"|"$/g, ""), email: match[2].trim() };
  }

  return { name: "Casa do Penedo", email: from.trim() };
}

function buildEmailContent({ reservation, property }: ReservationEmailInput) {
  const checkIn = formatDate(reservation.checkIn);
  const checkOut = formatDate(reservation.checkOut);
  const total = formatMoney(Number(reservation.totalPrice), reservation.currency);

  const subject = `Confirmação de reserva — ${property.name}`;

  const text = [
    `Olá ${reservation.guestName},`,
    "",
    "A tua reserva na Casa do Penedo foi registada com sucesso.",
    "",
    `Check-in: ${checkIn}`,
    `Check-out: ${checkOut}`,
    `Hóspedes: ${reservation.guests}`,
    `Total estimado: ${total}`,
    "",
    reservation.guestPhone ? `Telemóvel: ${reservation.guestPhone}` : "",
    "",
    "Entraremos em contacto em breve para confirmar pagamento e detalhes da estadia.",
    "",
    "Obrigado,",
    "Casa do Penedo",
    property.address ?? "Portugal",
  ]
    .filter(Boolean)
    .join("\n");

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2933; max-width: 560px;">
      <h2 style="color: #2d6a4f;">Confirmação de reserva</h2>
      <p>Olá <strong>${reservation.guestName}</strong>,</p>
      <p>A tua reserva na <strong>${property.name}</strong> foi registada com sucesso.</p>
      <table style="width: 100%; border-collapse: collapse; margin: 24px 0;">
        <tr><td style="padding: 8px 0; color: #6b7280;">Check-in</td><td style="padding: 8px 0;"><strong>${checkIn}</strong></td></tr>
        <tr><td style="padding: 8px 0; color: #6b7280;">Check-out</td><td style="padding: 8px 0;"><strong>${checkOut}</strong></td></tr>
        <tr><td style="padding: 8px 0; color: #6b7280;">Hóspedes</td><td style="padding: 8px 0;"><strong>${reservation.guests}</strong></td></tr>
        <tr><td style="padding: 8px 0; color: #6b7280;">Total estimado</td><td style="padding: 8px 0;"><strong>${total}</strong></td></tr>
      </table>
      <p>Entraremos em contacto em breve para confirmar pagamento e detalhes da estadia.</p>
      <p style="color: #6b7280; margin-top: 32px;">Casa do Penedo<br>${property.address ?? "Fafe, Braga, Portugal"}</p>
    </div>
  `;

  return { subject, text, html };
}

function getFromAddress() {
  return process.env.SMTP_FROM ?? "Casa do Penedo <casa_do_penedo@outlook.com>";
}

export function getEmailConfigError(): string | null {
  if (process.env.BREVO_API_KEY?.trim()) {
    return null;
  }

  if (!process.env.SMTP_HOST) return "Configura BREVO_API_KEY ou SMTP em apps/api/.env";
  if (!process.env.SMTP_USER) return "SMTP_USER em falta em apps/api/.env";
  if (!process.env.SMTP_PASS?.trim()) return "SMTP_PASS em falta em apps/api/.env";
  return null;
}

async function sendViaBrevoApi(payload: EmailPayload): Promise<EmailSendResult> {
  const apiKey = process.env.BREVO_API_KEY?.trim();
  if (!apiKey) {
    return { sent: false, reason: "BREVO_API_KEY em falta" };
  }

  const sender = parseFromAddress(getFromAddress());
  const ownerEmail = process.env.OWNER_EMAIL?.trim();
  const bcc = ownerEmail && ownerEmail !== payload.to ? [{ email: ownerEmail }] : undefined;

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      sender,
      to: [{ email: payload.to, name: payload.toName }],
      bcc,
      subject: payload.subject,
      htmlContent: payload.html,
      textContent: payload.text,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    const message = typeof error.message === "string" ? error.message : "Erro ao enviar via Brevo API";
    return { sent: false, reason: message };
  }

  return { sent: true };
}

function createSmtpTransport() {
  const port = Number(process.env.SMTP_PORT ?? 587);

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    requireTLS: port === 587,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS?.trim(),
    },
    tls: {
      minVersion: "TLSv1.2",
    },
  });
}

async function sendViaSmtp(payload: EmailPayload): Promise<EmailSendResult> {
  const configError = getEmailConfigError();
  if (configError) {
    return { sent: false, reason: configError };
  }

  const from = getFromAddress();
  const ownerEmail = process.env.OWNER_EMAIL?.trim();
  const transport = createSmtpTransport();

  try {
    await transport.verify();
    await transport.sendMail({
      from,
      to: payload.to,
      bcc: ownerEmail && ownerEmail !== payload.to ? ownerEmail : undefined,
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
    });
    return { sent: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao enviar email";
    return { sent: false, reason: message };
  }
}

async function sendEmail(payload: EmailPayload): Promise<EmailSendResult> {
  if (process.env.BREVO_API_KEY?.trim()) {
    const apiResult = await sendViaBrevoApi(payload);
    if (apiResult.sent) {
      console.log(`[email:sent] Brevo API → ${payload.to}`);
      return apiResult;
    }

    console.error("[email:error] Brevo API:", apiResult.reason);
    return apiResult;
  }

  const smtpResult = await sendViaSmtp(payload);
  if (smtpResult.sent) {
    console.log(`[email:sent] SMTP → ${payload.to}`);
    return smtpResult;
  }

  console.error("[email:error] SMTP:", smtpResult.reason);
  return smtpResult;
}

export async function sendReservationConfirmation(input: ReservationEmailInput): Promise<EmailSendResult> {
  const email = input.reservation.guestEmail;

  if (!email) {
    return { sent: false, reason: "Reserva sem email do hóspede" };
  }

  const configError = getEmailConfigError();
  if (configError) {
    const { subject, text } = buildEmailContent(input);
    console.log("[email:preview]", configError);
    console.log(`Para: ${email}`);
    console.log(`Assunto: ${subject}`);
    console.log(text);
    return { sent: false, reason: configError };
  }

  const { subject, text, html } = buildEmailContent(input);

  return sendEmail({
    to: email,
    toName: input.reservation.guestName,
    subject,
    text,
    html,
  });
}

export async function sendTestEmail(to: string): Promise<EmailSendResult> {
  const configError = getEmailConfigError();
  if (configError) {
    return { sent: false, reason: configError };
  }

  return sendEmail({
    to,
    subject: "Teste — Casa do Penedo",
    text: "Se recebeste este email, o envio via Brevo está configurado corretamente.",
    html: "<p>Se recebeste este email, o envio via Brevo está configurado corretamente.</p>",
  });
}
