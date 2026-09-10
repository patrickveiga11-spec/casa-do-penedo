import { z } from "zod";
import { resolveGuestCounts } from "./lib/guest-counts.js";

const guestAgeFields = {
  guestsChildren: z.number().int().min(0).max(10).optional(),
  guestsYouth: z.number().int().min(0).max(10).optional(),
  guestsAdults: z.number().int().min(0).max(10).optional(),
  guests: z.number().int().min(1).max(10).optional(),
};

function withResolvedGuests<T extends z.ZodRawShape>(shape: T) {
  return z.object(shape).superRefine((data, ctx) => {
    const resolved = resolveGuestCounts(data);
    if (resolved.guests < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Indica pelo menos 1 hóspede",
        path: ["guestsAdults"],
      });
    }
    if (resolved.guests > 10) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Máximo de 10 hóspedes",
        path: ["guests"],
      });
    }
  }).transform((data) => {
    const resolved = resolveGuestCounts(data);
    return { ...data, ...resolved };
  });
}

export const createReservationSchema = withResolvedGuests({
  propertyId: z.string(),
  channelId: z.string().optional(),
  guestName: z.string().min(1),
  guestEmail: z.string().email().optional(),
  guestPhone: z.string().trim().min(4, "Telemóvel é obrigatório"),
  checkIn: z.string(),
  checkOut: z.string(),
  ...guestAgeFields,
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

export const updateReservationDetailsSchema = z
  .object({
    guestName: z.string().min(1).optional(),
    guestEmail: z.string().email().nullable().optional(),
    guestPhone: z.string().trim().min(4).optional(),
    checkIn: z.string().optional(),
    checkOut: z.string().optional(),
    ...guestAgeFields,
    notes: z.string().max(4000).nullable().optional(),
  })
  .superRefine((data, ctx) => {
    const hasAnyCategory =
      data.guestsChildren !== undefined ||
      data.guestsYouth !== undefined ||
      data.guestsAdults !== undefined ||
      data.guests !== undefined;
    if (!hasAnyCategory) return;
    const resolved = resolveGuestCounts({
      guestsChildren: data.guestsChildren,
      guestsYouth: data.guestsYouth,
      guestsAdults: data.guestsAdults,
      guests: data.guests,
    });
    if (resolved.guests < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Indica pelo menos 1 hóspede",
        path: ["guestsAdults"],
      });
    }
  })
  .transform((data) => {
    const hasAnyCategory =
      data.guestsChildren !== undefined ||
      data.guestsYouth !== undefined ||
      data.guestsAdults !== undefined ||
      data.guests !== undefined;
    if (!hasAnyCategory) return data;
    return { ...data, ...resolveGuestCounts(data) };
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

export const quoteSchema = withResolvedGuests({
  propertyId: z.string(),
  checkIn: z.string(),
  checkOut: z.string(),
  ...guestAgeFields,
});
