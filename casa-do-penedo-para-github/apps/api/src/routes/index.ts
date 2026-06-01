import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { assertAvailable, findAvailabilityConflicts } from "../services/availability.js";
import { calculateDynamicPrice } from "../services/pricing.js";
import { sendReservationConfirmation } from "../services/email.js";
import { createBlockSchema, createPricingRuleSchema, createReservationSchema, quoteSchema } from "../schemas.js";
import { formatDate, monthBounds, nightsInRange, toDateOnly } from "../lib/dates.js";
import { requireAdmin, verifyAdminToken } from "../lib/admin-auth.js";

export async function propertyRoutes(app: FastifyInstance) {
  app.get("/properties", async () => {
    return prisma.property.findMany({
      include: {
        _count: { select: { reservations: true } },
      },
      orderBy: { name: "asc" },
    });
  });

  app.get("/properties/:id", async (request) => {
    const { id } = request.params as { id: string };

    return prisma.property.findUniqueOrThrow({
      where: { id },
      include: {
        pricingRules: { orderBy: { priority: "desc" } },
        blocks: { orderBy: { startDate: "asc" } },
      },
    });
  });
}

export async function reservationRoutes(app: FastifyInstance) {
  app.get("/reservations", { preHandler: requireAdmin }, async (request) => {
    const { propertyId, from, to } = request.query as {
      propertyId?: string;
      from?: string;
      to?: string;
    };

    return prisma.reservation.findMany({
      where: {
        propertyId,
        ...(from && to
          ? {
              checkIn: { lte: toDateOnly(to) },
              checkOut: { gte: toDateOnly(from) },
            }
          : {}),
      },
      include: { property: true },
      orderBy: { checkIn: "asc" },
    });
  });

  app.post("/reservations", async (request, reply) => {
    const body = createReservationSchema.parse(request.body);
    const checkIn = toDateOnly(body.checkIn);
    const checkOut = toDateOnly(body.checkOut);

    if (checkOut <= checkIn) {
      return reply.status(400).send({ error: "Check-out deve ser posterior ao check-in" });
    }

    const property = await prisma.property.findUniqueOrThrow({
      where: { id: body.propertyId },
    });

    if (body.guests > property.maxGuests) {
      return reply.status(400).send({ error: `Máximo de ${property.maxGuests} hóspedes` });
    }

    const [reservations, blocks, pricingRules] = await Promise.all([
      prisma.reservation.findMany({ where: { propertyId: body.propertyId } }),
      prisma.availabilityBlock.findMany({ where: { propertyId: body.propertyId } }),
      prisma.pricingRule.findMany({ where: { propertyId: body.propertyId, isActive: true } }),
    ]);

    try {
      assertAvailable({
        propertyId: body.propertyId,
        checkIn,
        checkOut,
        reservations,
        blocks,
      });
    } catch (error) {
      return reply.status(409).send({
        error: error instanceof Error ? error.message : "Conflito de disponibilidade",
        conflicts: findAvailabilityConflicts({
          propertyId: body.propertyId,
          checkIn,
          checkOut,
          reservations,
          blocks,
        }),
      });
    }

    const pricing = calculateDynamicPrice(
      Number(property.basePrice),
      property.currency,
      checkIn,
      checkOut,
      pricingRules,
      body.guests
    );

    const reservation = await prisma.reservation.create({
      data: {
        propertyId: body.propertyId,
        channelId: body.channelId,
        guestName: body.guestName,
        guestEmail: body.guestEmail,
        guestPhone: body.guestPhone,
        checkIn,
        checkOut,
        guests: body.guests,
        totalPrice: pricing.subtotal,
        currency: property.currency,
        notes: body.notes,
        status: "CONFIRMED",
      },
      include: { property: true },
    });

    let emailSent = false;
    let emailError: string | undefined;

    if (reservation.guestEmail) {
      const emailResult = await sendReservationConfirmation({ reservation, property });
      emailSent = emailResult.sent;
      emailError = emailResult.reason;

      if (!emailSent && emailResult.reason) {
        request.log.warn({ reason: emailResult.reason }, "Email de confirmação não enviado");
      }
    }

    return reply.status(201).send({ ...reservation, emailSent, emailError });
  });

  app.delete("/reservations/:id", { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const existing = await prisma.reservation.findUnique({ where: { id } });

    if (!existing) {
      return reply.status(404).send({ error: "Reserva não encontrada" });
    }

    await prisma.reservation.delete({ where: { id } });

    return reply.send({ success: true });
  });

  app.post("/reservations/check-availability", async (request) => {
    const body = quoteSchema.parse(request.body);
    const checkIn = toDateOnly(body.checkIn);
    const checkOut = toDateOnly(body.checkOut);

    const [reservations, blocks] = await Promise.all([
      prisma.reservation.findMany({ where: { propertyId: body.propertyId } }),
      prisma.availabilityBlock.findMany({ where: { propertyId: body.propertyId } }),
    ]);

    const conflicts = findAvailabilityConflicts({
      propertyId: body.propertyId,
      checkIn,
      checkOut,
      reservations,
      blocks,
    });

    return { available: conflicts.length === 0, conflicts };
  });
}

export async function calendarRoutes(app: FastifyInstance) {
  app.get("/calendar/:propertyId", async (request) => {
    const { propertyId } = request.params as { propertyId: string };
    const { from, to } = request.query as { from?: string; to?: string };

    const fromDate = from ? toDateOnly(from) : toDateOnly(new Date());
    const toDate = to ? toDateOnly(to) : toDateOnly(new Date(Date.now() + 90 * 86400000));

    const [reservations, blocks] = await Promise.all([
      prisma.reservation.findMany({
        where: {
          propertyId,
          checkIn: { lte: toDate },
          checkOut: { gte: fromDate },
          status: { in: ["PENDING", "CONFIRMED", "CHECKED_IN"] },
        },
        include: { property: true },
        orderBy: { checkIn: "asc" },
      }),
      prisma.availabilityBlock.findMany({
        where: {
          propertyId,
          startDate: { lte: toDate },
          endDate: { gte: fromDate },
        },
        orderBy: { startDate: "asc" },
      }),
    ]);

    const isAdmin = verifyAdminToken(request.headers.authorization);
    const visibleReservations = isAdmin ? reservations : reservations.map(anonymizeReservation);

    return { from: formatDate(fromDate), to: formatDate(toDate), reservations: visibleReservations, blocks };
  });
}

function anonymizeReservation<T extends { guestName: string; guestEmail: string | null; guestPhone: string | null }>(
  reservation: T
) {
  return {
    ...reservation,
    guestName: "Ocupado",
    guestEmail: null,
    guestPhone: null,
  };
}

export async function pricingRoutes(app: FastifyInstance) {
  app.get("/pricing-rules", async (request) => {
    const { propertyId } = request.query as { propertyId?: string };

    return prisma.pricingRule.findMany({
      where: { propertyId },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    });
  });

  app.post("/pricing-rules", { preHandler: requireAdmin }, async (request, reply) => {
    const body = createPricingRuleSchema.parse(request.body);

    const rule = await prisma.pricingRule.create({
      data: {
        propertyId: body.propertyId,
        name: body.name,
        priority: body.priority,
        startDate: body.startDate ? toDateOnly(body.startDate) : null,
        endDate: body.endDate ? toDateOnly(body.endDate) : null,
        dayOfWeek: body.dayOfWeek ?? null,
        minNights: body.minNights ?? null,
        modifier: body.modifier,
        modifierType: body.modifierType,
      },
    });

    return reply.status(201).send(rule);
  });

  app.post("/pricing/quote", async (request) => {
    const body = quoteSchema.parse(request.body);
    const checkIn = toDateOnly(body.checkIn);
    const checkOut = toDateOnly(body.checkOut);

    const property = await prisma.property.findUniqueOrThrow({
      where: { id: body.propertyId },
    });

    const rules = await prisma.pricingRule.findMany({
      where: { propertyId: body.propertyId, isActive: true },
    });

    return calculateDynamicPrice(
      Number(property.basePrice),
      property.currency,
      checkIn,
      checkOut,
      rules,
      body.guests
    );
  });
}

export async function blockRoutes(app: FastifyInstance) {
  app.post("/blocks", { preHandler: requireAdmin }, async (request, reply) => {
    const body = createBlockSchema.parse(request.body);
    const startDate = toDateOnly(body.startDate);
    const endDate = toDateOnly(body.endDate);

    const block = await prisma.availabilityBlock.create({
      data: {
        propertyId: body.propertyId,
        startDate,
        endDate,
        reason: body.reason,
      },
    });

    return reply.status(201).send(block);
  });
}

export async function dashboardRoutes(app: FastifyInstance) {
  app.get("/dashboard/kpis", { preHandler: requireAdmin }, async (request) => {
    const { propertyId, month } = request.query as { propertyId?: string; month?: string };

    const now = new Date();
    const fallbackMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const selectedMonth = month && /^\d{4}-\d{2}$/.test(month) ? month : fallbackMonth;
    const { start: monthStart, end: monthEnd, daysInMonth, label } = monthBounds(selectedMonth);

    const where = propertyId ? { propertyId } : {};

    const reservations = await prisma.reservation.findMany({
      where: {
        ...where,
        status: { in: ["CONFIRMED", "CHECKED_IN", "CHECKED_OUT"] },
        checkIn: { lte: monthEnd },
        checkOut: { gte: monthStart },
      },
    });

    const revenue = reservations.reduce((sum, reservation) => sum + Number(reservation.totalPrice), 0);
    const bookedNights = reservations.reduce(
      (sum, reservation) => sum + nightsInRange(reservation.checkIn, reservation.checkOut, monthStart, monthEnd),
      0
    );
    const occupancyRate = daysInMonth > 0 ? Math.round((bookedNights / daysInMonth) * 100) : 0;

    return {
      month: label,
      reservations: reservations.length,
      revenue: Math.round(revenue * 100) / 100,
      occupancyRate,
      bookedNights,
    };
  });
}
