import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAdmin } from "../lib/admin-auth.js";
import { backfillGuestRegistry } from "../services/guest-registry.js";

const updateGuestSchema = z.object({
  marketingOptIn: z.boolean().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

function escapeCsv(value: string) {
  if (value.includes('"') || value.includes(",") || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export async function guestRoutes(app: FastifyInstance) {
  app.post("/guests/sync", { preHandler: requireAdmin }, async () => {
    const result = await backfillGuestRegistry();
    const total = await prisma.guest.count();
    return { ...result, total };
  });

  app.get("/guests", { preHandler: requireAdmin }, async (request) => {
    const { search, marketingOnly, sync } = request.query as {
      search?: string;
      marketingOnly?: string;
      sync?: string;
    };

    const guestCount = await prisma.guest.count();
    if (guestCount === 0 || sync === "true") {
      await backfillGuestRegistry();
    }

    const term = search?.trim();

    return prisma.guest.findMany({
      where: {
        ...(marketingOnly === "true" ? { marketingOptIn: true } : {}),
        ...(term
          ? {
              OR: [
                { name: { contains: term, mode: "insensitive" } },
                { email: { contains: term, mode: "insensitive" } },
                { phone: { contains: term, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: [{ lastStayAt: "desc" }, { name: "asc" }],
    });
  });

  app.get("/guests/export.csv", { preHandler: requireAdmin }, async (request, reply) => {
    const { marketingOnly } = request.query as { marketingOnly?: string };

    const guests = await prisma.guest.findMany({
      where: marketingOnly === "true" ? { marketingOptIn: true } : undefined,
      orderBy: [{ lastStayAt: "desc" }, { name: "asc" }],
    });

    const header = ["nome", "email", "telefone", "estadias", "primeira_estadia", "ultima_estadia", "promocoes"];
    const rows = guests.map((guest) =>
      [
        guest.name,
        guest.email,
        guest.phone ?? "",
        String(guest.stayCount),
        guest.firstStayAt ? guest.firstStayAt.toISOString().slice(0, 10) : "",
        guest.lastStayAt ? guest.lastStayAt.toISOString().slice(0, 10) : "",
        guest.marketingOptIn ? "sim" : "nao",
      ]
        .map(escapeCsv)
        .join(",")
    );

    const csv = [header.join(","), ...rows].join("\n");

    reply
      .header("Content-Type", "text/csv; charset=utf-8")
      .header("Content-Disposition", 'attachment; filename="hospedes-casa-do-penedo.csv"')
      .send(`\uFEFF${csv}`);
  });

  app.patch("/guests/:id", { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateGuestSchema.parse(request.body);

    const existing = await prisma.guest.findUnique({ where: { id } });

    if (!existing) {
      return reply.status(404).send({ error: "Hóspede não encontrado" });
    }

    return prisma.guest.update({
      where: { id },
      data: {
        ...(body.marketingOptIn !== undefined ? { marketingOptIn: body.marketingOptIn } : {}),
        ...(body.notes !== undefined ? { notes: body.notes } : {}),
      },
    });
  });
}
