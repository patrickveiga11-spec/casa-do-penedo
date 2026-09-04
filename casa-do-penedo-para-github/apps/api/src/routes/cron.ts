import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { verifyCronRequest } from "../lib/cron-auth.js";
import {
  acknowledgeGuestEmailSent,
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
   * Pedidos pendentes via SMTP do domínio (gestão + iCloud).
   * O Render free bloqueia portas 25/465/587 — o relay Mac/GitHub envia.
   */
  app.get("/cron/pending-owner-emails", async (request, reply) => {
    if (!verifyCronSecret(request, reply)) {
      return;
    }

    const jobs = await listPendingOwnerEmailJobs(40);
    return reply.send({ count: jobs.length, jobs });
  });

  app.post("/cron/pending-owner-emails/:id/ack", async (request, reply) => {
    if (!verifyCronSecret(request, reply)) {
      return;
    }

    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as { error?: string | null; kind?: "owner" | "guest" };
    if (body.kind === "guest") {
      await acknowledgeGuestEmailSent(id, body.error ?? null);
    } else {
      await acknowledgeOwnerEmailSent(id, body.error ?? null);
    }
    return reply.send({ success: true, reservationId: id, kind: body.kind ?? "owner" });
  });
}
