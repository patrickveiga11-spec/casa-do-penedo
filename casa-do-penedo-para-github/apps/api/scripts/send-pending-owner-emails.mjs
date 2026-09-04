#!/usr/bin/env node
/**
 * Envia emails de gestão pendentes para casa_do_penedo@casadopenedo.pt
 * via SMTP do alojamento (fora do Render free, que bloqueia portas SMTP).
 *
 * Uso:
 *   CASA_API_URL=... CASA_ADMIN_PASSWORD=... DOMAIN_SMTP_PASS=... node send-pending-owner-emails.mjs
 */
import { createTransport } from "nodemailer";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const i = trimmed.indexOf("=");
    const key = trimmed.slice(0, i).trim();
    let value = trimmed.slice(i + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile(resolve(__dirname, "../.env"));

const apiUrl = (process.env.CASA_API_URL || process.env.VITE_API_URL || "https://casa-do-penedo.onrender.com").replace(
  /\/$/,
  ""
);
const auth = process.env.CASA_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || process.env.CRON_SECRET;
const host = process.env.DOMAIN_SMTP_HOST || "webdomain03.dnscpanel.com";
const port = Number(process.env.DOMAIN_SMTP_PORT || 587);
const user = process.env.DOMAIN_SMTP_USER || "casa_do_penedo@casadopenedo.pt";
const pass = process.env.DOMAIN_SMTP_PASS || process.env.SMTP_PASS;
const from = process.env.SMTP_FROM || `Casa do Penedo <${user}>`;

if (!auth) {
  console.error("Falta CASA_ADMIN_PASSWORD / ADMIN_PASSWORD");
  process.exit(1);
}
if (!pass) {
  console.error("Falta DOMAIN_SMTP_PASS");
  process.exit(1);
}

const transport = createTransport({
  host,
  port,
  secure: port === 465,
  requireTLS: port === 587,
  auth: { user, pass },
  connectionTimeout: 15_000,
  greetingTimeout: 15_000,
  socketTimeout: 30_000,
  tls: { minVersion: "TLSv1.2" },
});

async function api(method, path, body) {
  const response = await fetch(`${apiUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${auth}`,
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!response.ok) {
    throw new Error(`${method} ${path} → ${response.status} ${JSON.stringify(data)}`);
  }
  return data;
}

const pending = await api("GET", "/cron/pending-owner-emails");
const jobs = pending.jobs || [];
console.log(`Pendentes: ${jobs.length}`);

let sent = 0;
let failed = 0;

for (const job of jobs) {
  try {
    await transport.sendMail({
      from,
      to: job.to,
      subject: job.subject,
      text: job.text,
      replyTo: job.replyToEmail
        ? { name: job.replyToName || undefined, address: job.replyToEmail }
        : undefined,
    });
    await api("POST", `/cron/pending-owner-emails/${job.reservationId}/ack`, {
      kind: job.kind || "owner",
    });
    console.log(`OK  [${job.kind || "owner"}] ${job.reservationId} → ${job.to}`);
    sent += 1;
  } catch (error) {
    failed += 1;
    const message = error instanceof Error ? error.message : String(error);
    console.error(`ERR ${job.reservationId}: ${message}`);
  }
}

console.log(JSON.stringify({ sent, failed, total: jobs.length }));
if (failed > 0) process.exit(1);
