import { randomBytes, timingSafeEqual } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const tokens = new Map<string, number>();

export function verifyAdminPassword(password: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;

  if (!expected || !password) {
    return false;
  }

  const provided = Buffer.from(password);
  const secret = Buffer.from(expected);

  if (provided.length !== secret.length) {
    return false;
  }

  return timingSafeEqual(provided, secret);
}

export function createAdminToken(): string {
  const token = randomBytes(32).toString("hex");
  tokens.set(token, Date.now() + TOKEN_TTL_MS);
  return token;
}

export function revokeAdminToken(token: string): void {
  tokens.delete(token);
}

export function verifyAdminToken(authHeader?: string): boolean {
  if (!authHeader?.startsWith("Bearer ")) {
    return false;
  }

  const token = authHeader.slice(7);
  const expiry = tokens.get(token);

  if (!expiry || Date.now() > expiry) {
    tokens.delete(token);
    return false;
  }

  return true;
}

export async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  if (!process.env.ADMIN_PASSWORD) {
    return reply.status(503).send({ error: "Gestão não configurada (ADMIN_PASSWORD em falta)" });
  }

  if (!verifyAdminToken(request.headers.authorization)) {
    return reply.status(401).send({ error: "Password incorrecta ou sessão expirada" });
  }
}
