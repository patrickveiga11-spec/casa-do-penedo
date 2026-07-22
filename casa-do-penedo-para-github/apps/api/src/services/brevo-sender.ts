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

const TRUSTED_SENDER_EMAIL = "casa_do_penedo@casadopenedo.pt";
const TRUSTED_SENDER_NAME = "Casa do Penedo";
const TRUSTED_SENDER_DOMAIN = "casadopenedo.pt";

interface BrevoDomainStatus {
  authenticated: boolean;
  verified: boolean;
  dnsReady: boolean;
}

let cachedDomainStatus: BrevoDomainStatus | null = null;
let cachedDomainStatusAt = 0;

export async function getBrevoDomainStatus(apiKey: string): Promise<BrevoDomainStatus> {
  const now = Date.now();
  if (cachedDomainStatus && now - cachedDomainStatusAt < 10 * 60 * 1000) {
    return cachedDomainStatus;
  }

  const fallback: BrevoDomainStatus = {
    authenticated: false,
    verified: false,
    dnsReady: false,
  };

  try {
    const response = await fetch(`https://api.brevo.com/v3/senders/domains/${TRUSTED_SENDER_DOMAIN}`, {
      headers: {
        "api-key": apiKey,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      return cachedDomainStatus ?? fallback;
    }

    const data = (await response.json()) as {
      authenticated?: boolean;
      verified?: boolean;
      dns_records?: Record<string, { status?: boolean } | null>;
    };

    const records = Object.values(data.dns_records ?? {}).filter(
      (record): record is { status?: boolean } => Boolean(record)
    );
    const dnsReady = records.length > 0 && records.every((record) => record.status === true);

    cachedDomainStatus = {
      authenticated: Boolean(data.authenticated),
      verified: Boolean(data.verified),
      dnsReady,
    };
    cachedDomainStatusAt = now;
    return cachedDomainStatus;
  } catch {
    return cachedDomainStatus ?? fallback;
  }
}

/** Garante DKIM activo na Brevo (sem isto Outlook/Microsoft rejeita com "DKIM Bad request"). */
export async function ensureBrevoDomainAuthenticated(apiKey: string): Promise<BrevoDomainStatus> {
  const status = await getBrevoDomainStatus(apiKey);
  if (status.authenticated && status.verified) {
    return status;
  }

  if (!status.dnsReady) {
    console.warn(
      "[email:deliverability] DNS da Brevo incompleto para casadopenedo.pt — confirma SPF/DKIM/DMARC no cPanel"
    );
    return status;
  }

  try {
    const response = await fetch(
      `https://api.brevo.com/v3/senders/domains/${TRUSTED_SENDER_DOMAIN}/authenticate`,
      {
        method: "PUT",
        headers: {
          "api-key": apiKey,
          Accept: "application/json",
        },
      }
    );

    if (!response.ok) {
      console.warn("[email:deliverability] Não foi possível autenticar o domínio na Brevo:", response.status);
      return status;
    }

    cachedDomainStatus = null;
    return getBrevoDomainStatus(apiKey);
  } catch (error) {
    console.warn(
      "[email:deliverability] Erro ao autenticar domínio na Brevo:",
      error instanceof Error ? error.message : error
    );
    return status;
  }
}

export async function resolveBrevoSender(apiKey: string): Promise<{ id?: number; name: string; email: string }> {
  const configured = parseConfiguredSender();
  const senders = await fetchBrevoSenders(apiKey);
  const preferredEmail = (configured?.email || TRUSTED_SENDER_EMAIL).toLowerCase();

  const exact = senders.find((sender) => sender.email.toLowerCase() === preferredEmail);
  if (exact) {
    return {
      id: exact.id,
      name: exact.name || configured?.name || TRUSTED_SENDER_NAME,
      email: exact.email,
    };
  }

  const domainSender = senders.find((sender) => getEmailDomain(sender.email) === TRUSTED_SENDER_DOMAIN);
  if (domainSender) {
    console.warn(
      `[email:deliverability] Remetente configurado (${preferredEmail}) não está activo na Brevo; a usar ${domainSender.email}`
    );
    return {
      id: domainSender.id,
      name: domainSender.name || TRUSTED_SENDER_NAME,
      email: domainSender.email,
    };
  }

  if (configured && !isFreeEmailAddress(configured.email)) {
    console.warn(
      `[email:deliverability] Remetente ${configured.email} não encontrado na lista activa da Brevo — confirma Senders/Domains`
    );
    return configured;
  }

  if (configured && isFreeEmailAddress(configured.email)) {
    console.warn(
      "[email:deliverability] Remetente gratuito detectado — risco alto de spam. Usa casa_do_penedo@casadopenedo.pt"
    );
  }

  return {
    name: TRUSTED_SENDER_NAME,
    email: TRUSTED_SENDER_EMAIL,
  };
}

export function shouldUseTextOnlyOwnerEmail(ownerEmail: string, senderEmail: string): boolean {
  return isMicrosoftMailbox(ownerEmail) && isFreeEmailAddress(senderEmail);
}
