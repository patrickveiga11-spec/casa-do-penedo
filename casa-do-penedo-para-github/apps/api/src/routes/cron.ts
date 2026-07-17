import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { verifyCronRequest } from "../lib/cron-auth.js";
import { processScheduledWelcomeEmails } from "../services/welcome-email.js";
import { processScheduledThankYouEmails } from "../services/thank-you-email.js";

function verifyCronSecret(request: FastifyRequest, reply: FastifyReply): boolean {
  return verifyCronRequest(request, reply);
}

export async function cronRoutes(app: FastifyInstance) {
  app.post("/cron/welcome-emails", async (request, reply) => {
    if (!verifyCronSecret(request, reply)) {
      return;
    }

    const result = await processScheduledWelcomeEmails();
    return reply.send(result);
  });

  app.post("/cron/thank-you-emails", async (request, reply) => {
    if (!verifyCronSecret(request, reply)) {
      return;
    }

    const result = await processScheduledThankYouEmails();
    return reply.send(result);
  });

  app.post("/cron/daily-guest-emails", async (request, reply) => {
    if (!verifyCronSecret(request, reply)) {
      return;
    }

    const [welcome, thankYou] = await Promise.all([
      processScheduledWelcomeEmails(),
      processScheduledThankYouEmails(),
    ]);

    return reply.send({ welcome, thankYou });
  });
}
