import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { assertAvailable, findAvailabilityConflicts } from "../services/availability.js";
import { calculateDynamicPrice, applyReservationDiscount } from "../services/pricing.js";
import {
  sendOwnerNewReservationNotification,
  sendReservationCancellation,
  sendReservationConfirmation,
  sendReservationFinalConfirmation,
  sendWelcomeGuideEmail,
} from "../services/email.js";
import {
  maybeRunDailyWelcomeEmails,
  processWelcomeEmailAfterValidation,
  shouldSendWelcomeOnValidation,
} from "../services/welcome-email.js";
import { ensureReservationAccessCode, generateUniqueAccessCode } from "../services/access-code.js";
import { syncGuestByEmail, syncGuestFromReservation } from "../services/guest-registry.js";
import { createBlockSchema, createPricingRuleSchema, createReservationSchema, quoteSchema, updateBlockSchema, updateReservationDetailsSchema, updateReservationPaymentSchema, updateReservationSchema } from "../schemas.js";
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

    const isAdmin = verifyAdminToken(request.headers.authorization);
    let discountPercent = 0;

    if (body.discountPercent && body.discountPercent > 0) {
      if (!isAdmin) {
        return reply.status(403).send({ error: "Desconto só disponível na gestão" });
      }

      discountPercent = body.discountPercent;
    }

    const totalPrice = applyReservationDiscount(pricing.subtotal, discountPercent);

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
        totalPrice,
        discountPercent: discountPercent > 0 ? discountPercent : null,
        currency: property.currency,
        notes: body.notes,
        status: "PENDING",
      },
      include: { property: true },
    });

    let emailSent = false;
    let emailError: string | undefined;

    if (reservation.guestEmail) {
      const emailResult = await sendReservationConfirmation({
        reservation,
        property: reservation.property,
      });
      emailSent = emailResult.sent;
      emailError = emailResult.reason;
    }

    const ownerEmailResult = await sendOwnerNewReservationNotification({
      reservation,
      property: reservation.property,
    });

    if (!ownerEmailResult.sent) {
      console.warn("[email:owner-notification]", ownerEmailResult.reason);
    }

    void syncGuestFromReservation(reservation).catch((error) => {
      console.warn("[guest-registry:sync]", error);
    });

    return reply.status(201).send({ ...reservation, emailSent, emailError });
  });

  app.delete("/reservations/:id", { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const existing = await prisma.reservation.findUnique({
      where: { id },
      include: { property: true },
    });

    if (!existing) {
      return reply.status(404).send({ error: "Reserva não encontrada" });
    }

    let emailSent = false;
    let emailError: string | undefined;

    if (existing.guestEmail) {
      const emailResult = await sendReservationCancellation({
        reservation: existing,
        property: existing.property,
      });
      emailSent = emailResult.sent;
      emailError = emailResult.reason;

      if (!emailSent && emailResult.reason) {
        request.log.warn({ reason: emailResult.reason }, "Email de anulação não enviado");
      }
    }

    await prisma.reservation.delete({ where: { id } });

    void syncGuestByEmail(existing.guestEmail).catch((error) => {
      console.warn("[guest-registry:sync]", error);
    });

    return reply.send({ success: true, emailSent, emailError });
  });

  app.patch("/reservations/:id", { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateReservationSchema.parse(request.body);

    const existing = await prisma.reservation.findUnique({
      where: { id },
      include: { property: true },
    });

    if (!existing) {
      return reply.status(404).send({ error: "Reserva não encontrada" });
    }

    const pricingRules = await prisma.pricingRule.findMany({
      where: { propertyId: existing.propertyId, isActive: true },
    });

    const pricing = calculateDynamicPrice(
      Number(existing.property.basePrice),
      existing.property.currency,
      existing.checkIn,
      existing.checkOut,
      pricingRules,
      existing.guests
    );

    let totalPrice: number;
    let discountPercent: number | null = null;

    if (body.totalPrice !== undefined) {
      totalPrice = Math.round(body.totalPrice * 100) / 100;

      if (body.discountPercent !== undefined && body.discountPercent > 0) {
        const fromDiscount = applyReservationDiscount(pricing.subtotal, body.discountPercent);
        if (Math.abs(fromDiscount - totalPrice) < 0.01) {
          discountPercent = body.discountPercent;
        }
      }
    } else if (body.discountPercent !== undefined) {
      totalPrice = applyReservationDiscount(pricing.subtotal, body.discountPercent);
      discountPercent = body.discountPercent > 0 ? body.discountPercent : null;
    } else {
      return reply.status(400).send({ error: "Indica desconto ou valor final" });
    }

    const reservation = await prisma.reservation.update({
      where: { id },
      data: {
        totalPrice,
        discountPercent: discountPercent,
      },
      include: { property: true },
    });

    return reply.send({
      ...reservation,
      subtotalBeforeDiscount: pricing.subtotal,
    });
  });

  app.patch("/reservations/:id/details", { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateReservationDetailsSchema.parse(request.body);

    const existing = await prisma.reservation.findUnique({
      where: { id },
      include: { property: true },
    });

    if (!existing) {
      return reply.status(404).send({ error: "Reserva não encontrada" });
    }

    const checkIn = body.checkIn ? toDateOnly(body.checkIn) : existing.checkIn;
    const checkOut = body.checkOut ? toDateOnly(body.checkOut) : existing.checkOut;
    const guests = body.guests ?? existing.guests;

    if (checkOut <= checkIn) {
      return reply.status(400).send({ error: "Check-out deve ser posterior ao check-in" });
    }

    if (guests > existing.property.maxGuests) {
      return reply.status(400).send({ error: `Máximo de ${existing.property.maxGuests} hóspedes` });
    }

    const datesChanged =
      checkIn.getTime() !== existing.checkIn.getTime() || checkOut.getTime() !== existing.checkOut.getTime();

    if (datesChanged) {
      const [reservations, blocks] = await Promise.all([
        prisma.reservation.findMany({ where: { propertyId: existing.propertyId } }),
        prisma.availabilityBlock.findMany({ where: { propertyId: existing.propertyId } }),
      ]);

      try {
        assertAvailable({
          propertyId: existing.propertyId,
          checkIn,
          checkOut,
          excludeReservationId: id,
          reservations,
          blocks,
        });
      } catch (error) {
        return reply.status(409).send({
          error: error instanceof Error ? error.message : "Conflito de disponibilidade",
          conflicts: findAvailabilityConflicts({
            propertyId: existing.propertyId,
            checkIn,
            checkOut,
            excludeReservationId: id,
            reservations,
            blocks,
          }),
        });
      }
    }

    const reservation = await prisma.reservation.update({
      where: { id },
      data: {
        ...(body.guestName !== undefined ? { guestName: body.guestName } : {}),
        ...(body.guestEmail !== undefined ? { guestEmail: body.guestEmail } : {}),
        ...(body.guestPhone !== undefined ? { guestPhone: body.guestPhone } : {}),
        ...(body.checkIn !== undefined ? { checkIn } : {}),
        ...(body.checkOut !== undefined ? { checkOut } : {}),
        ...(body.guests !== undefined ? { guests } : {}),
        ...(body.notes !== undefined ? { notes: body.notes } : {}),
      },
      include: { property: true },
    });

    void syncGuestFromReservation(reservation).catch((error) => {
      console.warn("[guest-registry:sync]", error);
    });

    return reply.send(reservation);
  });

  app.patch("/reservations/:id/payment", { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateReservationPaymentSchema.parse(request.body);

    const existing = await prisma.reservation.findUnique({ where: { id } });

    if (!existing) {
      return reply.status(404).send({ error: "Reserva não encontrada" });
    }

    const reservation = await prisma.reservation.update({
      where: { id },
      data: {
        paymentStatus: body.paymentStatus,
        amountPaid: body.amountPaid ?? null,
      },
      include: { property: true },
    });

    return reply.send(reservation);
  });

  app.post("/reservations/:id/resend-confirmation", { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const existing = await prisma.reservation.findUnique({
      where: { id },
      include: { property: true },
    });

    if (!existing) {
      return reply.status(404).send({ error: "Reserva não encontrada" });
    }

    if (!existing.guestEmail) {
      return reply.status(400).send({ error: "Reserva sem email do hóspede" });
    }

    let emailResult;

    if (existing.validatedAt) {
      const accessCode = await ensureReservationAccessCode(existing);
      emailResult = await sendReservationFinalConfirmation(
        {
          reservation: { ...existing, accessCode },
          property: existing.property,
        },
        { includeWelcomeGuide: false }
      );
    } else {
      emailResult = await sendReservationConfirmation({
        reservation: existing,
        property: existing.property,
      });
    }

    if (!emailResult.sent) {
      return reply.status(502).send({
        error: emailResult.reason ?? "Não foi possível enviar o email",
        emailSent: false,
      });
    }

    return reply.send({ success: true, emailSent: true, type: existing.validatedAt ? "final" : "provisional" });
  });

  app.post("/reservations/:id/resend-welcome", { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const existing = await prisma.reservation.findUnique({
      where: { id },
      include: { property: true },
    });

    if (!existing) {
      return reply.status(404).send({ error: "Reserva não encontrada" });
    }

    if (!existing.validatedAt) {
      return reply.status(400).send({ error: "Reserva ainda não validada" });
    }

    if (!existing.guestEmail) {
      return reply.status(400).send({ error: "Reserva sem email do hóspede" });
    }

    const accessCode = await ensureReservationAccessCode(existing);
    const emailResult = await sendWelcomeGuideEmail({
      reservation: { ...existing, accessCode },
      property: existing.property,
    });

    if (!emailResult.sent) {
      return reply.status(502).send({
        error: emailResult.reason ?? "Não foi possível enviar o email",
        emailSent: false,
      });
    }

    await prisma.reservation.update({
      where: { id },
      data: { welcomeEmailSentAt: new Date() },
    });

    return reply.send({ success: true, emailSent: true });
  });

  app.post("/reservations/:id/validate", { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const existing = await prisma.reservation.findUnique({
      where: { id },
      include: { property: true },
    });

    if (!existing) {
      return reply.status(404).send({ error: "Reserva não encontrada" });
    }

    if (existing.validatedAt) {
      return reply.status(409).send({ error: "Reserva já validada" });
    }

    if (!existing.guestEmail) {
      return reply.status(400).send({ error: "Reserva sem email do cliente" });
    }

    const includeWelcomeGuide = shouldSendWelcomeOnValidation(existing.checkIn);

    const accessCode = await generateUniqueAccessCode(
      existing.propertyId,
      existing.checkIn,
      existing.checkOut,
      existing.id
    );

    const reservationForEmail = { ...existing, accessCode };

    const emailResult = await sendReservationFinalConfirmation(
      {
        reservation: reservationForEmail,
        property: existing.property,
      },
      { includeWelcomeGuide }
    );

    if (!emailResult.sent) {
      return reply.status(502).send({
        error: emailResult.reason ?? "Não foi possível enviar o email",
        emailSent: false,
      });
    }

    const reservation = await prisma.reservation.update({
      where: { id },
      data: {
        validatedAt: new Date(),
        status: "CONFIRMED",
        accessCode,
        ...(emailResult.welcomeGuideAttached ? { welcomeEmailSentAt: new Date() } : {}),
      },
      include: { property: true },
    });

    let welcomeEmailSent = Boolean(emailResult.welcomeGuideAttached);
    let welcomeEmailNote: string | undefined;

    if (!welcomeEmailSent) {
      const welcomeResult = await processWelcomeEmailAfterValidation(reservation);
      welcomeEmailSent = welcomeResult.sent;
      welcomeEmailNote = welcomeResult.reason;
      if (!welcomeResult.sent && welcomeResult.reason) {
        console.warn("[email:welcome-after-validation]", reservation.id, welcomeResult.reason);
      }
    }

    return reply.send({
      ...reservation,
      emailSent: true,
      welcomeEmailSent,
      welcomeEmailNote,
    });
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

    const isAdmin = verifyAdminToken(request.headers.authorization);
    const visibleConflicts = isAdmin
      ? conflicts
      : conflicts.map((conflict) => ({
          ...conflict,
          label: conflict.type === "reservation" ? "Ocupado" : conflict.label,
        }));

    return { available: visibleConflicts.length === 0, conflicts: visibleConflicts };
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

function anonymizeReservation<
  T extends {
    guestName: string;
    guestEmail: string | null;
    guestPhone: string | null;
    notes?: string | null;
  },
>(reservation: T) {
  return {
    ...reservation,
    guestName: "Ocupado",
    guestEmail: null,
    guestPhone: null,
    notes: null,
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
  app.get("/blocks", { preHandler: requireAdmin }, async (request) => {
    const { propertyId } = request.query as { propertyId?: string };

    if (!propertyId) {
      return [];
    }

    return prisma.availabilityBlock.findMany({
      where: { propertyId },
      orderBy: { startDate: "asc" },
    });
  });

  app.post("/blocks", { preHandler: requireAdmin }, async (request, reply) => {
    const body = createBlockSchema.parse(request.body);
    const startDate = toDateOnly(body.startDate);
    const endDate = toDateOnly(body.endDate);

    if (endDate < startDate) {
      return reply.status(400).send({ error: "A data de fim deve ser igual ou posterior à data de início" });
    }

    const [reservations, blocks] = await Promise.all([
      prisma.reservation.findMany({ where: { propertyId: body.propertyId } }),
      prisma.availabilityBlock.findMany({ where: { propertyId: body.propertyId } }),
    ]);

    const conflicts = findAvailabilityConflicts({
      propertyId: body.propertyId,
      checkIn: startDate,
      checkOut: endDate,
      reservations,
      blocks,
    });

    if (conflicts.length > 0) {
      const first = conflicts[0];
      return reply.status(409).send({
        error: `Conflito com ${first.type === "reservation" ? "reserva" : "bloqueio"} (${first.label}) entre ${first.startDate} e ${first.endDate}`,
      });
    }

    const block = await prisma.availabilityBlock.create({
      data: {
        propertyId: body.propertyId,
        startDate,
        endDate,
        reason: body.reason?.trim() || "Bloqueio manual",
      },
    });

    return reply.status(201).send(block);
  });

  app.patch("/blocks/:id", { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateBlockSchema.parse(request.body);

    const existing = await prisma.availabilityBlock.findUnique({ where: { id } });

    if (!existing) {
      return reply.status(404).send({ error: "Bloqueio não encontrado" });
    }

    const startDate = body.startDate ? toDateOnly(body.startDate) : existing.startDate;
    const endDate = body.endDate ? toDateOnly(body.endDate) : existing.endDate;

    if (endDate < startDate) {
      return reply.status(400).send({ error: "A data de fim deve ser igual ou posterior à data de início" });
    }

    const datesChanged =
      startDate.getTime() !== existing.startDate.getTime() || endDate.getTime() !== existing.endDate.getTime();

    if (datesChanged) {
      const [reservations, blocks] = await Promise.all([
        prisma.reservation.findMany({ where: { propertyId: existing.propertyId } }),
        prisma.availabilityBlock.findMany({ where: { propertyId: existing.propertyId } }),
      ]);

      const conflicts = findAvailabilityConflicts({
        propertyId: existing.propertyId,
        checkIn: startDate,
        checkOut: endDate,
        excludeBlockId: id,
        reservations,
        blocks,
      });

      if (conflicts.length > 0) {
        const first = conflicts[0];
        return reply.status(409).send({
          error: `Conflito com ${first.type === "reservation" ? "reserva" : "bloqueio"} (${first.label}) entre ${first.startDate} e ${first.endDate}`,
        });
      }
    }

    const block = await prisma.availabilityBlock.update({
      where: { id },
      data: {
        ...(body.startDate !== undefined ? { startDate } : {}),
        ...(body.endDate !== undefined ? { endDate } : {}),
        ...(body.reason !== undefined ? { reason: body.reason.trim() || "Bloqueio manual" } : {}),
      },
    });

    return reply.send(block);
  });

  app.delete("/blocks/:id", { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const existing = await prisma.availabilityBlock.findUnique({ where: { id } });

    if (!existing) {
      return reply.status(404).send({ error: "Bloqueio não encontrado" });
    }

    await prisma.availabilityBlock.delete({ where: { id } });

    return reply.send({ success: true });
  });
}

export async function dashboardRoutes(app: FastifyInstance) {
  app.get("/dashboard/kpis", { preHandler: requireAdmin }, async (request) => {
    void maybeRunDailyWelcomeEmails().catch((error) => {
      console.warn("[email:welcome-daily]", error);
    });

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

  app.get("/dashboard/monthly-revenue", { preHandler: requireAdmin }, async (request) => {
    const { propertyId, year } = request.query as { propertyId?: string; year?: string };
    const selectedYear = year && /^\d{4}$/.test(year) ? Number(year) : new Date().getFullYear();

    const yearStart = new Date(Date.UTC(selectedYear, 0, 1));
    const yearEnd = new Date(Date.UTC(selectedYear, 11, 31));

    const reservations = await prisma.reservation.findMany({
      where: {
        ...(propertyId ? { propertyId } : {}),
        status: { not: "CANCELLED" },
        checkIn: { gte: yearStart, lte: yearEnd },
      },
      select: {
        totalPrice: true,
        checkIn: true,
      },
    });

    const monthLabels = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    const buckets = monthLabels.map((label, index) => ({
      month: index + 1,
      label,
      revenue: 0,
      reservations: 0,
    }));

    for (const reservation of reservations) {
      const monthIndex = reservation.checkIn.getUTCMonth();
      buckets[monthIndex].revenue += Number(reservation.totalPrice);
      buckets[monthIndex].reservations += 1;
    }

    const months = buckets.map((bucket) => ({
      ...bucket,
      revenue: Math.round(bucket.revenue * 100) / 100,
    }));

    const totalRevenue = Math.round(months.reduce((sum, month) => sum + month.revenue, 0) * 100) / 100;

    return {
      year: selectedYear,
      months,
      totalRevenue,
    };
  });
}
