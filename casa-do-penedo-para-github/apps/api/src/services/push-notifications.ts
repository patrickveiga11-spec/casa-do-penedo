import { createHash } from "node:crypto";

function formatDate(date: Date): string {
  return date.toLocaleDateString("pt-PT", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatMoney(value: number | string, currency: string): string {
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency }).format(Number(value));
}

export function getNtfyTopic(): string | undefined {
  const explicit = process.env.NTFY_TOPIC?.trim();
  if (explicit) {
    return explicit;
  }

  const adminPassword = process.env.ADMIN_PASSWORD?.trim();
  if (!adminPassword) {
    return undefined;
  }

  const digest = createHash("sha256").update(adminPassword).digest("hex").slice(0, 16);
  return `cdp-${digest}`;
}

export function getNtfySubscribeUrl(topic: string): string {
  return `https://ntfy.sh/${topic}`;
}

export interface OwnerPushNotificationInput {
  guestName: string;
  guestEmail?: string | null;
  guestPhone?: string | null;
  checkIn: Date;
  checkOut: Date;
  guests: number;
  totalPrice: number | string;
  currency: string;
  propertyName: string;
}

export async function sendOwnerPushNotification(
  input: OwnerPushNotificationInput
): Promise<{ sent: boolean; reason?: string }> {
  const topic = getNtfyTopic();
  if (!topic) {
    return { sent: false, reason: "Alertas móveis não configurados" };
  }

  const baseUrl = (process.env.NTFY_URL?.trim() || "https://ntfy.sh").replace(/\/$/, "");
  const checkIn = formatDate(input.checkIn);
  const checkOut = formatDate(input.checkOut);
  const total = formatMoney(input.totalPrice, input.currency);

  const body = [
    `Hóspede: ${input.guestName}`,
    input.guestEmail ? `Email: ${input.guestEmail}` : null,
    input.guestPhone ? `Telemóvel: ${input.guestPhone}` : null,
    "",
    `Check-in: ${checkIn}`,
    `Check-out: ${checkOut}`,
    `Hóspedes: ${input.guests}`,
    `Total estimado: ${total}`,
    "",
    "Abrir gestão: https://casa-do-penedo.vercel.app/gestao",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const response = await fetch(`${baseUrl}/${topic}`, {
      method: "POST",
      headers: {
        Title: `Reserva Casa do Penedo — ${input.guestName}`,
        Priority: "high",
        Tags: "house,bell",
      },
      body,
    });

    if (!response.ok) {
      return { sent: false, reason: `Alerta móvel falhou (${response.status})` };
    }

    return { sent: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro no alerta móvel";
    return { sent: false, reason: message };
  }
}
