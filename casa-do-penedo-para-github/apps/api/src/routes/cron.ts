import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { verifyCronRequest } from "../lib/cron-auth.js";
import { processScheduledWelcomeEmails } from "../services/welcome-email.js";

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
}
