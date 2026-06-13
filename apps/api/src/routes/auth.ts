import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  createAdminToken,
  revokeAdminToken,
  verifyAdminPassword,
  verifyAdminToken,
} from "../lib/admin-auth.js";

const loginSchema = z.object({
  password: z.string().min(1),
});

export async function authRoutes(app: FastifyInstance) {
  app.post("/auth/admin/login", async (request, reply) => {
    if (!process.env.ADMIN_PASSWORD) {
      return reply.status(503).send({ error: "Password de gestão não configurada no servidor" });
    }

    const { password } = loginSchema.parse(request.body);

    if (!verifyAdminPassword(password)) {
      return reply.status(401).send({ error: "Password incorrecta" });
    }

    return { token: createAdminToken() };
  });

  app.post("/auth/admin/logout", async (request, reply) => {
    const authHeader = request.headers.authorization;

    if (authHeader?.startsWith("Bearer ")) {
      revokeAdminToken(authHeader.slice(7));
    }

    return reply.send({ success: true });
  });

  app.get("/auth/admin/session", async (request, reply) => {
    if (!verifyAdminToken(request.headers.authorization)) {
      return reply.status(401).send({ error: "Sessão inválida" });
    }

    return { ok: true };
  });
}
