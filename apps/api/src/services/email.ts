import nodemailer from "nodemailer";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Property, Reservation } from "@prisma/client";
import {
  isFreeEmailAddress,
  isMicrosoftMailbox,
  resolveBrevoSender,
  shouldUseTextOnlyOwnerEmail,
} from "./brevo-sender.js";

interface ReservationEmailInput {
  reservation: Reservation;
  property: Property;
}

export interface EmailSendResult {
  sent: boolean;
  reason?: string;
  welcomeGuideAttached?: boolean;
}

interface EmailPayload {
  to: string;
  toName?: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: EmailAttachment[];
  tags?: string[];
  includeOwnerBcc?: boolean;
  textOnly?: boolean;
  replyTo?: { name: string; email: string };
  headers?: Record<string, string>;
}

interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
}

function resolveRegulamentoPdfPath(): string | null {
  const customPath = process.env.REGULAMENTO_PDF_PATH?.trim();
  if (customPath && existsSync(customPath)) {
    return customPath;
  }

  const moduleDir = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    join(moduleDir, "../assets/regulamento-interno.pdf"),
    join(process.cwd(), "dist/assets/regulamento-interno.pdf"),
    join(process.cwd(), "assets/regulamento-interno.pdf"),
    join(process.cwd(), "apps/api/assets/regulamento-interno.pdf"),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

function loadRegulamentoAttachment(): EmailAttachment | null {
  const path = resolveRegulamentoPdfPath();
  if (!path) {
    return null;
  }

  return {
    filename: "Regulamento-Interno-Casa-do-Penedo.pdf",
    content: readFileSync(path),
    contentType: "application/pdf",
  };
}

function resolveWelcomeGuidePdfPath(): string | null {
  const customPath = process.env.GUIA_BOAS_VINDAS_PDF_PATH?.trim();
  if (customPath && existsSync(customPath)) {
    return customPath;
  }

  const moduleDir = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    join(moduleDir, "../assets/guia-boas-vindas.pdf"),
    join(process.cwd(), "dist/assets/guia-boas-vindas.pdf"),
    join(process.cwd(), "assets/guia-boas-vindas.pdf"),
    join(process.cwd(), "apps/api/assets/guia-boas-vindas.pdf"),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

function loadWelcomeGuideAttachment(): EmailAttachment | null {
  const path = resolveWelcomeGuidePdfPath();
  if (!path) {
    return null;
  }

  return {
    filename: "Guia-de-Boas-Vindas-Casa-do-Penedo.pdf",
    content: readFileSync(path),
    contentType: "application/pdf",
  };
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

function parseEmailList(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  const recipients: string[] = [];
  const seen = new Set<string>();

  for (const part of value.split(/[;,]/)) {
    const email = part.trim();
    const key = email.toLowerCase();
    if (!email || seen.has(key)) {
      continue;
    }

    seen.add(key);
    recipients.push(email);
  }

  return recipients;
}

const DEFAULT_OWNER_EMAIL = "casa_do_penedo@casadopenedo.pt";

function getOwnerNotificationRecipients(): string[] {
  const explicit = parseEmailList(process.env.OWNER_NOTIFICATION_EMAILS?.trim());
  if (explicit.length > 0) {
    return explicit;
  }

  const fromEnv = parseEmailList(process.env.OWNER_EMAIL?.trim());
  if (fromEnv.length > 0) {
    return fromEnv;
  }

  // Fallback seguro: caixa oficial da Casa do Penedo
  return [DEFAULT_OWNER_EMAIL];
}

function getPrimaryOwnerEmail(): string | undefined {
  return getOwnerNotificationRecipients()[0];
}

function buildEmailContent({ reservation, property }: ReservationEmailInput) {
  const checkIn = formatDate(reservation.checkIn);
  const checkOut = formatDate(reservation.checkOut);
  const total = formatMoney(Number(reservation.totalPrice), reservation.currency);
  const discountPercent = reservation.discountPercent ? Number(reservation.discountPercent) : 0;
  const discountLine =
    discountPercent > 0 ? `Desconto aplicado: ${discountPercent}%` : "";

  const subject = `Reserva provisória — ${property.name}`;

  const text = [
    `Olá ${reservation.guestName},`,
    "",
    "Recebemos o teu pedido de reserva na Casa do Penedo.",
    "Esta é uma reserva provisória — ainda não está confirmada.",
    "",
    `Check-in: ${checkIn}`,
    `Check-out: ${checkOut}`,
    `Hóspedes: ${reservation.guests}`,
    discountLine,
    `Total estimado: ${total}`,
    "",
    reservation.guestPhone ? `Telemóvel: ${reservation.guestPhone}` : "",
    "",
    "Enviaremos um email de confirmação final com o valor a pagar assim que validarmos a reserva.",
    "",
    "Obrigado,",
    "Casa do Penedo",
  ]
    .filter(Boolean)
    .join("\n");

  const discountRow =
    discountPercent > 0
      ? `<tr><td style="padding: 8px 0; color: #6b7280;">Desconto</td><td style="padding: 8px 0;"><strong>${discountPercent}%</strong></td></tr>`
      : "";

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2933; max-width: 560px;">
      <h2 style="color: #b45309;">Reserva provisória</h2>
      <p>Olá <strong>${reservation.guestName}</strong>,</p>
      <p>Recebemos o teu pedido de reserva na <strong>${property.name}</strong>.</p>
      <p style="background: #fffbeb; border-left: 4px solid #f59e0b; padding: 12px 16px; margin: 16px 0;">
        <strong>Esta é uma reserva provisória</strong> — ainda não está confirmada. Enviaremos a confirmação final com o valor a pagar assim que validarmos o pedido.
      </p>
      <table style="width: 100%; border-collapse: collapse; margin: 24px 0;">
        <tr><td style="padding: 8px 0; color: #6b7280;">Check-in</td><td style="padding: 8px 0;"><strong>${checkIn}</strong></td></tr>
        <tr><td style="padding: 8px 0; color: #6b7280;">Check-out</td><td style="padding: 8px 0;"><strong>${checkOut}</strong></td></tr>
        <tr><td style="padding: 8px 0; color: #6b7280;">Hóspedes</td><td style="padding: 8px 0;"><strong>${reservation.guests}</strong></td></tr>
        ${discountRow}
        <tr><td style="padding: 8px 0; color: #6b7280;">Total estimado</td><td style="padding: 8px 0;"><strong>${total}</strong></td></tr>
      </table>
      <p style="color: #6b7280; margin-top: 32px;">Casa do Penedo</p>
    </div>
  `;

  return { subject, text, html };
}

function buildAccessCodeEmailContent(accessCode: string | null | undefined) {
  if (!accessCode) {
    return { textBlock: "", htmlBlock: "" };
  }

  const textBlock = [
    "",
    `Código de acesso: ${accessCode}`,
    "Usa este código de 4 dígitos no controlo de acessos à entrada da casa.",
  ].join("\n");

  const htmlBlock = `
    <div style="margin: 24px 0; padding: 16px 20px; background: #f0fdf4; border: 2px solid #2d6a4f; border-radius: 8px; text-align: center;">
      <p style="margin: 0 0 8px; color: #6b7280; font-size: 0.9em;">Código de acesso</p>
      <p style="margin: 0; font-size: 2em; font-weight: bold; letter-spacing: 0.25em; color: #2d6a4f;">${accessCode}</p>
      <p style="margin: 8px 0 0; color: #6b7280; font-size: 0.85em;">Programa este PIN no controlo de acessos à entrada.</p>
    </div>
  `;

  return { textBlock, htmlBlock };
}

function buildFinalConfirmationEmailContent(
  { reservation, property }: ReservationEmailInput,
  includeRegulamentoNote = false,
  includeGuideNote = false
) {
  const checkIn = formatDate(reservation.checkIn);
  const checkOut = formatDate(reservation.checkOut);
  const total = formatMoney(Number(reservation.totalPrice), reservation.currency);
  const discountPercent = reservation.discountPercent ? Number(reservation.discountPercent) : 0;
  const discountLine =
    discountPercent > 0 ? `Desconto aplicado: ${discountPercent}%` : "";

  const subject = `Confirmação final — ${property.name}`;
  const { textBlock: accessCodeText, htmlBlock: accessCodeHtml } = buildAccessCodeEmailContent(
    includeGuideNote ? reservation.accessCode : null
  );

  const text = [
    `Olá ${reservation.guestName},`,
    "",
    "A tua reserva na Casa do Penedo está confirmada.",
    "",
    `Check-in: ${checkIn}`,
    `Check-out: ${checkOut}`,
    `Hóspedes: ${reservation.guests}`,
    discountLine,
    `Valor a pagar: ${total}`,
    "",
    reservation.guestPhone ? `Telemóvel: ${reservation.guestPhone}` : "",
    "",
    includeRegulamentoNote ? "Em anexo enviamos o regulamento interno da Casa do Penedo." : "",
    includeGuideNote
      ? "Em anexo enviamos também o guia de boas-vindas com informações úteis para a tua chegada."
      : "",
    accessCodeText,
    "",
    "Entraremos em contacto em breve para acertar o pagamento e os detalhes da estadia.",
    "",
    "Obrigado,",
    "Casa do Penedo",
  ]
    .filter(Boolean)
    .join("\n");

  const discountRow =
    discountPercent > 0
      ? `<tr><td style="padding: 8px 0; color: #6b7280;">Desconto</td><td style="padding: 8px 0;"><strong>${discountPercent}%</strong></td></tr>`
      : "";

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2933; max-width: 560px;">
      <h2 style="color: #2d6a4f;">Confirmação final da reserva</h2>
      <p>Olá <strong>${reservation.guestName}</strong>,</p>
      <p>A tua reserva na <strong>${property.name}</strong> está confirmada.</p>
      <table style="width: 100%; border-collapse: collapse; margin: 24px 0;">
        <tr><td style="padding: 8px 0; color: #6b7280;">Check-in</td><td style="padding: 8px 0;"><strong>${checkIn}</strong></td></tr>
        <tr><td style="padding: 8px 0; color: #6b7280;">Check-out</td><td style="padding: 8px 0;"><strong>${checkOut}</strong></td></tr>
        <tr><td style="padding: 8px 0; color: #6b7280;">Hóspedes</td><td style="padding: 8px 0;"><strong>${reservation.guests}</strong></td></tr>
        ${discountRow}
        <tr><td style="padding: 8px 0; color: #6b7280;">Valor a pagar</td><td style="padding: 8px 0;"><strong style="font-size: 1.1em;">${total}</strong></td></tr>
      </table>
      ${includeRegulamentoNote ? "<p>Em anexo enviamos o <strong>regulamento interno</strong> da Casa do Penedo.</p>" : ""}
      ${includeGuideNote ? "<p>Em anexo enviamos também o <strong>guia de boas-vindas</strong> com informações úteis para a tua chegada.</p>" : ""}
      ${accessCodeHtml}
      <p>Entraremos em contacto em breve para acertar o pagamento e os detalhes da estadia.</p>
      <p style="color: #6b7280; margin-top: 32px;">Casa do Penedo</p>
    </div>
  `;

  return { subject, text, html };
}

function buildWelcomeGuideEmailContent(
  { reservation, property }: ReservationEmailInput,
  includeGuideNote = false
) {
  const checkIn = formatDate(reservation.checkIn);
  const checkOut = formatDate(reservation.checkOut);

  const subject = `Bem-vindo à ${property.name}`;
  const { textBlock: accessCodeText, htmlBlock: accessCodeHtml } = buildAccessCodeEmailContent(
    reservation.accessCode
  );

  const text = [
    `Olá ${reservation.guestName},`,
    "",
    "A tua estadia na Casa do Penedo está quase a chegar.",
    "",
    `Check-in: ${checkIn}`,
    `Check-out: ${checkOut}`,
    accessCodeText,
    "",
    includeGuideNote
      ? "Em anexo enviamos o guia de boas-vindas e o regulamento interno da Casa do Penedo."
      : "",
    "",
    "Estamos à disposição para qualquer dúvida. Boa viagem!",
    "",
    "Casa do Penedo",
  ]
    .filter(Boolean)
    .join("\n");

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2933; max-width: 560px;">
      <h2 style="color: #2d6a4f;">Bem-vindo à ${property.name}</h2>
      <p>Olá <strong>${reservation.guestName}</strong>,</p>
      <p>A tua estadia na Casa do Penedo está quase a chegar.</p>
      <table style="width: 100%; border-collapse: collapse; margin: 24px 0;">
        <tr><td style="padding: 8px 0; color: #6b7280;">Check-in</td><td style="padding: 8px 0;"><strong>${checkIn}</strong></td></tr>
        <tr><td style="padding: 8px 0; color: #6b7280;">Check-out</td><td style="padding: 8px 0;"><strong>${checkOut}</strong></td></tr>
      </table>
      ${accessCodeHtml}
      ${includeGuideNote ? "<p>Em anexo enviamos o <strong>guia de boas-vindas</strong> e o <strong>regulamento interno</strong>.</p>" : ""}
      <p>Estamos à disposição para qualquer dúvida. Boa viagem!</p>
      <p style="color: #6b7280; margin-top: 32px;">Casa do Penedo</p>
    </div>
  `;

  return { subject, text, html };
}

function buildThankYouEmailContent({ reservation, property }: ReservationEmailInput) {
  const checkIn = formatDate(reservation.checkIn);
  const checkOut = formatDate(reservation.checkOut);

  const subject = `Obrigado pela visita — ${property.name}`;

  const text = [
    `Olá ${reservation.guestName},`,
    "",
    "Esperamos que tudo tenha corrido bem durante a vossa estadia e que tenham desfrutado da nossa casa.",
    "",
    `A vossa visita: ${checkIn} → ${checkOut}`,
    "",
    "Foi um prazer receber-vos. Esperamos voltar a ver-vos em breve na Casa do Penedo.",
    "",
    "Até já,",
    "Casa do Penedo",
  ].join("\n");

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2933; max-width: 560px;">
      <h2 style="color: #2d6a4f;">Obrigado pela visita</h2>
      <p>Olá <strong>${reservation.guestName}</strong>,</p>
      <p>Esperamos que tudo tenha corrido bem durante a vossa estadia e que tenham desfrutado da nossa casa.</p>
      <table style="width: 100%; border-collapse: collapse; margin: 24px 0;">
        <tr><td style="padding: 8px 0; color: #6b7280;">Check-in</td><td style="padding: 8px 0;"><strong>${checkIn}</strong></td></tr>
        <tr><td style="padding: 8px 0; color: #6b7280;">Check-out</td><td style="padding: 8px 0;"><strong>${checkOut}</strong></td></tr>
      </table>
      <p>Foi um prazer receber-vos. Esperamos voltar a ver-vos em breve na <strong>${property.name}</strong>.</p>
      <p style="margin-top: 24px;">Até já,</p>
      <p style="color: #6b7280;">Casa do Penedo</p>
    </div>
  `;

  return { subject, text, html };
}

function buildCancellationEmailContent({ reservation, property }: ReservationEmailInput) {
  const checkIn = formatDate(reservation.checkIn);
  const checkOut = formatDate(reservation.checkOut);

  const subject = `Reserva anulada — ${property.name}`;

  const text = [
    `Olá ${reservation.guestName},`,
    "",
    "Informamos que a tua reserva na Casa do Penedo foi anulada.",
    "",
    `Check-in: ${checkIn}`,
    `Check-out: ${checkOut}`,
    `Hóspedes: ${reservation.guests}`,
    "",
    "Se tiveres dúvidas ou quiseres fazer uma nova reserva, responde a este email.",
    "",
    "Casa do Penedo",
  ].join("\n");

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2933; max-width: 560px;">
      <h2 style="color: #b42318;">Reserva anulada</h2>
      <p>Olá <strong>${reservation.guestName}</strong>,</p>
      <p>Informamos que a tua reserva na <strong>${property.name}</strong> foi anulada.</p>
      <table style="width: 100%; border-collapse: collapse; margin: 24px 0;">
        <tr><td style="padding: 8px 0; color: #6b7280;">Check-in</td><td style="padding: 8px 0;"><strong>${checkIn}</strong></td></tr>
        <tr><td style="padding: 8px 0; color: #6b7280;">Check-out</td><td style="padding: 8px 0;"><strong>${checkOut}</strong></td></tr>
        <tr><td style="padding: 8px 0; color: #6b7280;">Hóspedes</td><td style="padding: 8px 0;"><strong>${reservation.guests}</strong></td></tr>
      </table>
      <p>Se tiveres dúvidas ou quiseres fazer uma nova reserva, responde a este email.</p>
      <p style="color: #6b7280; margin-top: 32px;">Casa do Penedo</p>
    </div>
  `;

  return { subject, text, html };
}

function getReplyToAddress() {
  const ownerEmail = getPrimaryOwnerEmail();
  if (!ownerEmail) {
    return undefined;
  }

  return { name: "Casa do Penedo", email: ownerEmail };
}

function buildOwnerNewReservationEmailContent({ reservation, property }: ReservationEmailInput) {
  const checkIn = formatDate(reservation.checkIn);
  const checkOut = formatDate(reservation.checkOut);
  const total = formatMoney(Number(reservation.totalPrice), reservation.currency);

  const subject = `NOVO PEDIDO DE RESERVA — ${reservation.guestName} (${checkIn})`;

  const text = [
    "Recebeste um novo pedido de reserva na Casa do Penedo.",
    "",
    `Hóspede: ${reservation.guestName}`,
    reservation.guestEmail ? `Email: ${reservation.guestEmail}` : "Email: —",
    reservation.guestPhone ? `Telemóvel: ${reservation.guestPhone}` : "Telemóvel: —",
    "",
    `Check-in: ${checkIn}`,
    `Check-out: ${checkOut}`,
    `Hóspedes: ${reservation.guests}`,
    `Total estimado: ${total}`,
    "",
    "Estado: pendente de validação",
    "Abrir gestão: https://casa-do-penedo.vercel.app/gestao",
    "",
    "Casa do Penedo",
  ]
    .filter(Boolean)
    .join("\n");

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2933; max-width: 560px;">
      <h2 style="color: #b45309; margin-top: 0;">Novo pedido de reserva</h2>
      <p>Recebeste um novo pedido de reserva na <strong>${property.name}</strong>.</p>
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr><td style="padding: 8px 0; color: #6b7280;">Hóspede</td><td style="padding: 8px 0;"><strong>${reservation.guestName}</strong></td></tr>
        <tr><td style="padding: 8px 0; color: #6b7280;">Email</td><td style="padding: 8px 0;"><strong>${reservation.guestEmail ?? "—"}</strong></td></tr>
        <tr><td style="padding: 8px 0; color: #6b7280;">Telemóvel</td><td style="padding: 8px 0;"><strong>${reservation.guestPhone ?? "—"}</strong></td></tr>
        <tr><td style="padding: 8px 0; color: #6b7280;">Check-in</td><td style="padding: 8px 0;"><strong>${checkIn}</strong></td></tr>
        <tr><td style="padding: 8px 0; color: #6b7280;">Check-out</td><td style="padding: 8px 0;"><strong>${checkOut}</strong></td></tr>
        <tr><td style="padding: 8px 0; color: #6b7280;">Hóspedes</td><td style="padding: 8px 0;"><strong>${reservation.guests}</strong></td></tr>
        <tr><td style="padding: 8px 0; color: #6b7280;">Total estimado</td><td style="padding: 8px 0;"><strong>${total}</strong></td></tr>
      </table>
      <p style="background: #fffbeb; border-left: 4px solid #f59e0b; padding: 12px 16px;">
        Estado: <strong>pendente de validação</strong>
      </p>
      <p><a href="https://casa-do-penedo.vercel.app/gestao" style="display:inline-block;background:#2d6a4f;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:700;">Abrir gestão</a></p>
    </div>
  `;

  return { subject, text, html };
}

function getFromAddress() {
  return process.env.SMTP_FROM ?? "Casa do Penedo <casa_do_penedo@casadopenedo.pt>";
}

function shouldIncludeOwnerBcc(payload: EmailPayload) {
  if (payload.includeOwnerBcc === false) {
    return false;
  }

  return process.env.OWNER_BCC !== "false";
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

  try {
    const sender = await resolveBrevoSender(apiKey);
    const ownerEmail = getPrimaryOwnerEmail();
    const replyTo = payload.replyTo ?? getReplyToAddress();
    const bcc =
      shouldIncludeOwnerBcc(payload) && ownerEmail && ownerEmail !== payload.to
        ? [{ email: ownerEmail }]
        : undefined;
    const attachment =
      payload.attachments?.map((file) => ({
        name: file.filename,
        content: file.content.toString("base64"),
      })) ?? undefined;

    if (isFreeEmailAddress(sender.email)) {
      console.warn(
        "[email:deliverability] Remetente gratuito via Brevo pode ir para spam. Configure um domínio autenticado no Brevo."
      );
    }

    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        sender: sender.id ? { id: sender.id, name: sender.name } : { email: sender.email, name: sender.name },
        to: [{ email: payload.to, name: payload.toName }],
        replyTo,
        bcc,
        subject: payload.subject,
        htmlContent: payload.textOnly ? undefined : payload.html,
        textContent: payload.text,
        tags: payload.tags,
        ...(payload.headers ? { headers: payload.headers } : {}),
        ...(attachment?.length ? { attachment } : {}),
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      const message = typeof error.message === "string" ? error.message : "Erro ao enviar via Brevo API";
      return { sent: false, reason: message };
    }

    return { sent: true };
  } catch (error) {
    return {
      sent: false,
      reason: error instanceof Error ? error.message : "Erro de rede ao enviar via Brevo",
    };
  }
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
  const ownerEmail = getPrimaryOwnerEmail();
  const replyTo = getReplyToAddress();
  const transport = createSmtpTransport();

  try {
    await transport.verify();
    await transport.sendMail({
      from,
      to: payload.to,
      replyTo: (payload.replyTo ?? replyTo) ?
        {
          name: (payload.replyTo ?? replyTo)!.name,
          address: (payload.replyTo ?? replyTo)!.email,
        }
      : undefined,
      bcc:
        shouldIncludeOwnerBcc(payload) && ownerEmail && ownerEmail !== payload.to
          ? ownerEmail
          : undefined,
      subject: payload.subject,
      text: payload.text,
      html: payload.textOnly ? undefined : payload.html,
      headers: payload.headers,
      attachments: payload.attachments?.map((file) => ({
        filename: file.filename,
        content: file.content,
        contentType: file.contentType,
      })),
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
    tags: ["reserva", "cliente"],
    includeOwnerBcc: false,
  });
}

export async function sendOwnerNewReservationNotification(
  input: ReservationEmailInput
): Promise<EmailSendResult> {
  const ownerRecipients = getOwnerNotificationRecipients();

  if (ownerRecipients.length === 0) {
    return { sent: false, reason: "Nenhum email de proprietário configurado" };
  }

  const configError = getEmailConfigError();
  const { subject, text, html } = buildOwnerNewReservationEmailContent(input);

  if (configError) {
    console.log("[email:preview]", configError);
    console.log(`Para: ${ownerRecipients.join(", ")}`);
    console.log(`Assunto: ${subject}`);
    console.log(text);
    return { sent: false, reason: configError };
  }

  const apiKey = process.env.BREVO_API_KEY?.trim();
  const fallbackSender = parseFromAddress(getFromAddress());
  const sender = apiKey ?
    await resolveBrevoSender(apiKey)
  : { email: fallbackSender.email, name: fallbackSender.name };
  const guestReply =
    input.reservation.guestEmail?.trim() ?
      { name: input.reservation.guestName, email: input.reservation.guestEmail.trim() }
    : undefined;

  const results = await Promise.all(
    ownerRecipients.map(async (ownerEmail) => {
      const textOnly = shouldUseTextOnlyOwnerEmail(ownerEmail, sender.email);
      const result = await sendEmail({
        to: ownerEmail,
        toName: "Casa do Penedo",
        subject,
        text,
        html: textOnly ? undefined : html,
        textOnly,
        tags: ["reserva", "gestao", "novo-pedido"],
        includeOwnerBcc: false,
        replyTo: guestReply,
      });

      if (result.sent) {
        console.log(`[email:owner-notification] sent → ${ownerEmail}`);
      } else {
        console.warn(
          `[email:owner-notification] failed → ${ownerEmail}: ${result.reason ?? "erro desconhecido"}`
        );
      }

      return { ownerEmail, result };
    })
  );

  const sentCount = results.filter((item) => item.result.sent).length;
  if (sentCount === results.length) {
    return { sent: true };
  }

  const failures = results
    .filter((item) => !item.result.sent)
    .map((item) => `${item.ownerEmail}: ${item.result.reason ?? "erro desconhecido"}`);

  return {
    sent: sentCount > 0,
    reason: failures.join(" | "),
  };
}

export async function sendReservationFinalConfirmation(
  input: ReservationEmailInput,
  options: { includeWelcomeGuide?: boolean } = {}
): Promise<EmailSendResult> {
  const email = input.reservation.guestEmail;

  if (!email) {
    return { sent: false, reason: "Reserva sem email do hóspede" };
  }

  const configError = getEmailConfigError();
  const regulamento = loadRegulamentoAttachment();
  const includeWelcomeGuide = options.includeWelcomeGuide ?? false;
  const guide = includeWelcomeGuide ? loadWelcomeGuideAttachment() : null;

  if (configError) {
    const { subject, text } = buildFinalConfirmationEmailContent(
      input,
      Boolean(regulamento),
      Boolean(guide)
    );
    console.log("[email:preview]", configError);
    console.log(`Para: ${email}`);
    console.log(`Assunto: ${subject}`);
    console.log(text);
    return { sent: false, reason: configError };
  }

  const { subject, text, html } = buildFinalConfirmationEmailContent(
    input,
    Boolean(regulamento),
    Boolean(guide)
  );

  if (!regulamento) {
    console.warn("[email:attachment] Regulamento interno não encontrado — email enviado sem anexo");
  }

  if (includeWelcomeGuide && !guide) {
    console.warn("[email:attachment] Guia de boas-vindas não encontrado — email enviado sem guia");
  }

  const attachments = [regulamento, guide].filter(
    (attachment): attachment is EmailAttachment => attachment !== null
  );

  const sendResult = await sendEmail({
    to: email,
    toName: input.reservation.guestName,
    subject,
    text,
    html,
    attachments: attachments.length > 0 ? attachments : undefined,
    tags: ["reserva", "cliente"],
    includeOwnerBcc: false,
  });

  return {
    ...sendResult,
    welcomeGuideAttached: sendResult.sent && Boolean(guide),
  };
}

export async function sendWelcomeGuideEmail(input: ReservationEmailInput): Promise<EmailSendResult> {
  const email = input.reservation.guestEmail;

  if (!email) {
    return { sent: false, reason: "Reserva sem email do hóspede" };
  }

  const configError = getEmailConfigError();
  const guide = loadWelcomeGuideAttachment();
  const regulamento = loadRegulamentoAttachment();
  const hasAttachments = Boolean(guide || regulamento);

  if (configError) {
    const { subject, text } = buildWelcomeGuideEmailContent(input, hasAttachments);
    console.log("[email:preview]", configError);
    console.log(`Para: ${email}`);
    console.log(`Assunto: ${subject}`);
    console.log(text);
    return { sent: false, reason: configError };
  }

  const { subject, text, html } = buildWelcomeGuideEmailContent(input, hasAttachments);

  if (!guide) {
    console.warn("[email:attachment] Guia de boas-vindas não encontrado — email enviado sem guia");
  }

  if (!regulamento) {
    console.warn("[email:attachment] Regulamento interno não encontrado — email enviado sem regulamento");
  }

  const attachments = [guide, regulamento].filter(
    (attachment): attachment is EmailAttachment => attachment !== null
  );

  return sendEmail({
    to: email,
    toName: input.reservation.guestName,
    subject,
    text,
    html,
    attachments: attachments.length > 0 ? attachments : undefined,
    tags: ["reserva", "cliente", "boas-vindas"],
    includeOwnerBcc: false,
  });
}

export async function sendThankYouEmail(input: ReservationEmailInput): Promise<EmailSendResult> {
  const email = input.reservation.guestEmail;

  if (!email) {
    return { sent: false, reason: "Reserva sem email do hóspede" };
  }

  const configError = getEmailConfigError();
  const { subject, text, html } = buildThankYouEmailContent(input);

  if (configError) {
    console.log("[email:preview]", configError);
    console.log(`Para: ${email}`);
    console.log(`Assunto: ${subject}`);
    console.log(text);
    return { sent: false, reason: configError };
  }

  return sendEmail({
    to: email,
    toName: input.reservation.guestName,
    subject,
    text,
    html,
    tags: ["reserva", "cliente", "agradecimento"],
    includeOwnerBcc: false,
  });
}

export async function sendReservationCancellation(input: ReservationEmailInput): Promise<EmailSendResult> {
  const email = input.reservation.guestEmail;

  if (!email) {
    return { sent: false, reason: "Reserva sem email do hóspede" };
  }

  const configError = getEmailConfigError();
  if (configError) {
    const { subject, text } = buildCancellationEmailContent(input);
    console.log("[email:preview]", configError);
    console.log(`Para: ${email}`);
    console.log(`Assunto: ${subject}`);
    console.log(text);
    return { sent: false, reason: configError };
  }

  const { subject, text, html } = buildCancellationEmailContent(input);
  const textOnly = isMicrosoftMailbox(email);

  return sendEmail({
    to: email,
    toName: input.reservation.guestName,
    subject,
    text,
    html: textOnly ? undefined : html,
    textOnly,
    tags: ["reserva", "cliente", "anulacao"],
    includeOwnerBcc: false,
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
