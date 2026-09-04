import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { verifyCronRequest } from "../lib/cron-auth.js";
import {
  acknowledgeOwnerEmailSent,
  listPendingOwnerEmailJobs,
} from "../services/email.js";
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

  /**
   * Pedidos de gestão pendentes — o envio SMTP para @casadopenedo.pt
   * corre fora do Render free (GitHub Action / Mac), porque o Render free
   * bloqueia as portas 25/465/587.
   */
  app.get("/cron/pending-owner-emails", async (request, reply) => {
    if (!verifyCronSecret(request, reply)) {
      return;
    }

    const jobs = await listPendingOwnerEmailJobs(30);
    return reply.send({ count: jobs.length, jobs });
  });

  app.post("/cron/pending-owner-emails/:id/ack", async (request, reply) => {
    if (!verifyCronSecret(request, reply)) {
      return;
    }

    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as { error?: string | null };
    await acknowledgeOwnerEmailSent(id, body.error ?? null);
    return reply.send({ success: true, reservationId: id });
  });
}
