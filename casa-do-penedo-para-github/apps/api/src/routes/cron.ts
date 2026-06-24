import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { processScheduledWelcomeEmails } from "../services/welcome-email.js";

function verifyCronSecret(request: FastifyRequest, reply: FastifyReply): boolean {
  const secret = process.env.CRON_SECRET?.trim();

  if (!secret) {
    reply.status(503).send({ error: "CRON_SECRET não configurado no servidor" });
    return false;
  }

  const authHeader = request.headers.authorization;
  if (authHeader !== `Bearer ${secret}`) {
    reply.status(401).send({ error: "Não autorizado" });
    return false;
  }

  return true;
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
