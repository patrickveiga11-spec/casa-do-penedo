import { z } from "zod";

export const createReservationSchema = z.object({
  propertyId: z.string(),
  channelId: z.string().optional(),
  guestName: z.string().min(1),
  guestEmail: z.string().email().optional(),
  guestPhone: z.string().trim().min(4, "Telemóvel é obrigatório"),
  checkIn: z.string(),
  checkOut: z.string(),
  guests: z.number().int().min(1).max(10).default(1),
  notes: z.string().optional(),
  discountPercent: z.number().min(0).max(100).optional(),
});

export const updateReservationSchema = z
  .object({
    discountPercent: z.number().min(0).max(100).optional(),
    totalPrice: z.number().min(0).optional(),
  })
  .refine((data) => data.discountPercent !== undefined || data.totalPrice !== undefined, {
    message: "Indica desconto ou valor final",
  });

export const updateReservationDetailsSchema = z.object({
  guestName: z.string().min(1).optional(),
  guestEmail: z.string().email().nullable().optional(),
  guestPhone: z.string().trim().min(4).optional(),
  checkIn: z.string().optional(),
  checkOut: z.string().optional(),
  guests: z.number().int().min(1).max(10).optional(),
  notes: z.string().max(4000).nullable().optional(),
});

export const updateReservationPaymentSchema = z.object({
  paymentStatus: z.enum(["PENDING", "PARTIAL", "PAID"]),
  amountPaid: z.number().min(0).nullable().optional(),
});

export const createPricingRuleSchema = z.object({
  propertyId: z.string(),
  name: z.string().min(1),
  priority: z.number().int().default(0),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  dayOfWeek: z.number().int().min(0).max(6).optional(),
  minNights: z.number().int().positive().optional(),
  modifier: z.number(),
  modifierType: z.enum(["PERCENT", "FIXED", "PACKAGE"]).default("PERCENT"),
});

export const updatePricingRuleSchema = z.object({
  isActive: z.boolean().optional(),
});

export const createBlockSchema = z.object({
  propertyId: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  reason: z.string().optional(),
});

export const updateBlockSchema = z
  .object({
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    reason: z.string().optional(),
  })
  .refine((data) => data.startDate !== undefined || data.endDate !== undefined || data.reason !== undefined, {
    message: "Indica pelo menos um campo para atualizar",
  });

export const quoteSchema = z.object({
  propertyId: z.string(),
  checkIn: z.string(),
  checkOut: z.string(),
  guests: z.number().int().min(1).max(10).default(1),
});
