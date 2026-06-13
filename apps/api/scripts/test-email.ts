import "dotenv/config";
import { loadEnv } from "../src/lib/load-env.js";
import { sendTestEmail } from "../src/services/email.js";

loadEnv();

const to = process.argv[2] ?? process.env.OWNER_EMAIL ?? process.env.SMTP_USER;

if (!to) {
  console.error("Uso: npm run test:email -w @casa/api -- email@exemplo.com");
  process.exit(1);
}

const result = await sendTestEmail(to);

if (result.sent) {
  console.log(`Email de teste enviado para ${to}`);
  process.exit(0);
}

console.error("Falha:", result.reason);
process.exit(1);
