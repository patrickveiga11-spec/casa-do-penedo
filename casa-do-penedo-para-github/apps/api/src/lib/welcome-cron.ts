import cron from "node-cron";
import { processScheduledWelcomeEmails } from "../services/welcome-email.js";

let started = false;

export function startWelcomeEmailCron() {
  if (started || process.env.DISABLE_WELCOME_CRON === "true") {
    return;
  }

  started = true;

  cron.schedule(
    "0 9 * * *",
    () => {
      void processScheduledWelcomeEmails()
        .then((result) => {
          console.log("[cron:welcome-emails]", JSON.stringify(result));
        })
        .catch((error) => {
          console.error("[cron:welcome-emails]", error);
        });
    },
    { timezone: "Europe/Lisbon" }
  );

  console.log("[cron:welcome-emails] Agendado para 9h (Europe/Lisbon)");
}
