const FREE_EMAIL_DOMAINS = new Set([
  "outlook.com",
  "outlook.pt",
  "hotmail.com",
  "hotmail.pt",
  "live.com",
  "live.pt",
  "msn.com",
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.pt",
  "icloud.com",
  "me.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
]);

const MICROSOFT_EMAIL_DOMAINS = new Set([
  "outlook.com",
  "outlook.pt",
  "hotmail.com",
  "hotmail.pt",
  "live.com",
  "live.pt",
  "msn.com",
]);

export function getEmailDomain(email: string): string | undefined {
  const parts = email.trim().toLowerCase().split("@");
  return parts.length === 2 ? parts[1] : undefined;
}

export function isFreeEmailAddress(email: string): boolean {
  const domain = getEmailDomain(email);
  return domain ? FREE_EMAIL_DOMAINS.has(domain) : false;
}

export function isMicrosoftMailbox(email: string): boolean {
  const domain = getEmailDomain(email);
  return domain ? MICROSOFT_EMAIL_DOMAINS.has(domain) : false;
}

interface BrevoSenderRecord {
  id: number;
  name: string;
  email: string;
  active: boolean;
}

let cachedSenders: BrevoSenderRecord[] | null = null;
let cachedAt = 0;

async function fetchBrevoSenders(apiKey: string): Promise<BrevoSenderRecord[]> {
  const now = Date.now();
  if (cachedSenders && now - cachedAt < 10 * 60 * 1000) {
    return cachedSenders;
  }

  const response = await fetch("https://api.brevo.com/v3/senders", {
    headers: {
      "api-key": apiKey,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    return cachedSenders ?? [];
  }

  const data = (await response.json()) as { senders?: BrevoSenderRecord[] };
  cachedSenders = data.senders?.filter((sender) => sender.active) ?? [];
  cachedAt = now;
  return cachedSenders;
}

function parseConfiguredSender(): { name: string; email: string } | null {
  const configured = process.env.BREVO_SENDER_EMAIL?.trim() || process.env.SMTP_FROM?.trim();
  if (!configured) {
    return null;
  }

  const match = configured.match(/^(.+?)\s*<([^>]+)>$/);
  if (match) {
    return {
      name: match[1].trim().replace(/^"|"$/g, ""),
      email: match[2].trim(),
    };
  }

  if (configured.includes("@")) {
    return { name: "Casa do Penedo", email: configured };
  }

  return null;
}

export async function resolveBrevoSender(apiKey: string): Promise<{ id?: number; name: string; email: string }> {
  const configured = parseConfiguredSender();
  const senders = await fetchBrevoSenders(apiKey);

  if (configured) {
    const active = senders.find((sender) => sender.email.toLowerCase() === configured.email.toLowerCase());
    if (active) {
      return {
        id: active.id,
        name: active.name || configured.name,
        email: active.email,
      };
    }

    return configured;
  }

  const preferred = senders[0];
  if (preferred) {
    return { id: preferred.id, name: preferred.name || "Casa do Penedo", email: preferred.email };
  }

  return { name: "Casa do Penedo", email: "casa_do_penedo@casadopenedo.pt" };
}

export function shouldUseTextOnlyOwnerEmail(ownerEmail: string, senderEmail: string): boolean {
  return isMicrosoftMailbox(ownerEmail) && isFreeEmailAddress(senderEmail);
}
