import { loadEnv } from "../src/lib/load-env.js";
import { processScheduledWelcomeEmails } from "../src/services/welcome-email.js";

loadEnv();

const result = await processScheduledWelcomeEmails();

console.log(JSON.stringify(result, null, 2));
process.exit(0);
