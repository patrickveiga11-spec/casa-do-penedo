import cron from "node-cron";
import { processScheduledWelcomeEmails } from "../services/welcome-email.js";
import { processScheduledThankYouEmails } from "../services/thank-you-email.js";

let started = false;

async function runDailyGuestEmails() {
  const welcome = await processScheduledWelcomeEmails();
  const thankYou = await processScheduledThankYouEmails();
  return { welcome, thankYou };
}

export function startWelcomeEmailCron() {
  if (started || process.env.DISABLE_WELCOME_CRON === "true") {
    return;
  }

  started = true;

  cron.schedule(
    "0 9 * * *",
    () => {
      void runDailyGuestEmails()
        .then((result) => {
          console.log("[cron:daily-guest-emails]", JSON.stringify(result));
        })
        .catch((error) => {
          console.error("[cron:daily-guest-emails]", error);
        });
    },
    { timezone: "Europe/Lisbon" }
  );

  console.log("[cron:daily-guest-emails] Agendado para 9h (Europe/Lisbon) — boas-vindas + agradecimento");
}
