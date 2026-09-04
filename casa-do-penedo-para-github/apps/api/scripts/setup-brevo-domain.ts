import { loadEnv } from "../src/lib/load-env.js";

loadEnv();

const DOMAIN = "casadopenedo.pt";
const SENDER_EMAIL = "casa_do_penedo@casadopenedo.pt";
const SENDER_NAME = "Casa do Penedo";

const apiKey = process.env.BREVO_API_KEY?.trim();
if (!apiKey) {
  console.error("BREVO_API_KEY em falta em apps/api/.env");
  process.exit(1);
}

async function brevo(path: string, init: RequestInit = {}) {
  const response = await fetch(`https://api.brevo.com/v3${path}`, {
    ...init,
    headers: {
      "api-key": apiKey!,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  const text = await response.text();
  let body: unknown = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    // keep raw text
  }

  return { ok: response.ok, status: response.status, body };
}

async function ensureDomain() {
  const existing = await brevo("/domains");
  if (!existing.ok) {
    console.error("Erro ao listar domínios:", existing.status, existing.body);
    return;
  }

  const domains = (existing.body as { domains?: { domain_name: string; authenticated?: boolean }[] })
    .domains ?? [];
  const match = domains.find((item) => item.domain_name === DOMAIN);

  if (match) {
    console.log(`Domínio ${DOMAIN} já existe na Brevo (autenticado: ${match.authenticated ?? "?"})`);
    return;
  }

  const created = await brevo("/domains", {
    method: "POST",
    body: JSON.stringify({ name: DOMAIN }),
  });

  if (created.ok) {
    console.log(`Domínio ${DOMAIN} adicionado na Brevo.`);
  } else if (created.status === 400) {
    console.log(`Domínio ${DOMAIN} pode já existir ou requer configuração manual.`, created.body);
  } else {
    console.error("Erro ao adicionar domínio:", created.status, created.body);
  }
}

async function showDnsRecords() {
  const detail = await brevo(`/domains/${DOMAIN}`);
  if (!detail.ok) {
    console.log(`Não foi possível obter registos DNS automáticos (${detail.status}). Configura na Brevo → Domains.`);
    return;
  }

  console.log("\nEstado do domínio na Brevo:");
  console.log(JSON.stringify(detail.body, null, 2));
}

async function authenticateDomain() {
  const auth = await brevo(`/senders/domains/${DOMAIN}/authenticate`, { method: "PUT" });
  if (auth.ok) {
    console.log(`Domínio ${DOMAIN} autenticado na Brevo (DKIM activo).`);
    return;
  }

  console.warn(`Não foi possível autenticar ${DOMAIN} automaticamente:`, auth.status, auth.body);
}

async function ensureSender() {
  const existing = await brevo("/senders");
  if (!existing.ok) {
    console.error("Erro ao listar remetentes:", existing.status, existing.body);
    return;
  }

  const senders =
    (existing.body as { senders?: { email: string; active: boolean; name: string }[] }).senders ?? [];
  const match = senders.find((item) => item.email.toLowerCase() === SENDER_EMAIL);

  if (match) {
    console.log(`Remetente ${SENDER_EMAIL} já existe (activo: ${match.active}).`);
    return;
  }

  const created = await brevo("/senders", {
    method: "POST",
    body: JSON.stringify({ name: SENDER_NAME, email: SENDER_EMAIL }),
  });

  if (created.ok) {
    console.log(`Remetente ${SENDER_EMAIL} criado. Verifica o email de confirmação se pedido.`);
  } else {
    console.error("Erro ao criar remetente:", created.status, created.body);
  }
}

async function main() {
  console.log("A configurar Brevo para", SENDER_EMAIL);
  await ensureDomain();
  await showDnsRecords();
  await authenticateDomain();
  await ensureSender();

  const senders = await brevo("/senders");
  if (senders.ok) {
    const list = (senders.body as { senders?: { email: string; active: boolean }[] }).senders ?? [];
    console.log(
      "\nRemetentes activos:",
      list.filter((s) => s.active).map((s) => s.email).join(", ") || "(nenhum)"
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
