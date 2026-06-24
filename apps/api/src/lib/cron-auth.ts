import type { FastifyReply, FastifyRequest } from "fastify";

function getBearerToken(request: FastifyRequest): string | undefined {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return undefined;
  }

  return authHeader.slice("Bearer ".length).trim();
}

export function verifyCronRequest(request: FastifyRequest, reply: FastifyReply): boolean {
  const token = getBearerToken(request);

  if (!token) {
    reply.status(401).send({ error: "Não autorizado" });
    return false;
  }

  const cronSecret = process.env.CRON_SECRET?.trim();
  if (cronSecret && token === cronSecret) {
    return true;
  }

  const adminPassword = process.env.ADMIN_PASSWORD?.trim();
  if (adminPassword && token === adminPassword) {
    return true;
  }

  reply.status(401).send({ error: "Não autorizado" });
  return false;
}
