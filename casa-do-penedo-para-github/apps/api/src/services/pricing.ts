import type { PricingRule } from "@prisma/client";
import { eachNight, formatDate } from "../lib/dates.js";

export const INCLUDED_GUESTS = 7;
export const EXTRA_GUEST_FEE = 15;
export const MAX_GUESTS = 10;

export function extraGuestFee(guests: number): number {
  const extraGuests = Math.max(0, Math.min(guests, MAX_GUESTS) - INCLUDED_GUESTS);
  return extraGuests * EXTRA_GUEST_FEE;
}

export function nightlyRateBeforeRules(basePrice: number, guests: number): number {
  return basePrice + extraGuestFee(guests);
}

export interface PriceBreakdownNight {
  date: string;
  basePrice: number;
  guestSurcharge: number;
  adjustedPrice: number;
  appliedRules: string[];
}

export interface PriceBreakdown {
  nights: PriceBreakdownNight[];
  subtotal: number;
  currency: string;
  guests: number;
}

function ruleApplies(rule: PricingRule, date: Date, nightCount: number): boolean {
  if (!rule.isActive) return false;

  if (rule.modifierType === "PACKAGE") {
    return false;
  }

  if (rule.startDate && date < rule.startDate) return false;
  if (rule.endDate && date > rule.endDate) return false;
  if (rule.dayOfWeek !== null && rule.dayOfWeek !== date.getDay()) return false;
  if (rule.minNights !== null && nightCount < rule.minNights) return false;

  return true;
}

function packageRuleApplies(rule: PricingRule, nightCount: number, referenceDate: Date): boolean {
  if (!rule.isActive || rule.modifierType !== "PACKAGE") return false;
  if (rule.minNights !== nightCount) return false;

  if (rule.startDate && referenceDate < rule.startDate) return false;
  if (rule.endDate && referenceDate > rule.endDate) return false;
  if (rule.dayOfWeek !== null && rule.dayOfWeek !== referenceDate.getDay()) return false;

  return true;
}

function findPackageRule(rules: PricingRule[], nightCount: number, referenceDate: Date): PricingRule | undefined {
  const sortedRules = [...rules].sort((a, b) => b.priority - a.priority);

  return sortedRules.find((rule) => packageRuleApplies(rule, nightCount, referenceDate));
}

function buildPackageBreakdown(
  nights: Date[],
  packageRule: PricingRule,
  guestSurcharge: number,
  currency: string,
  guests: number
): PriceBreakdown {
  const nightCount = nights.length;
  const packageBase = Number(packageRule.modifier);
  const guestTotal = guestSurcharge * nightCount;
  const subtotal = Math.round((packageBase + guestTotal) * 100) / 100;
  const perNight = Math.round((subtotal / nightCount) * 100) / 100;
  const appliedRules = [packageRule.name];
  if (guestTotal > 0) {
    appliedRules.push(`+${guestTotal}€ hóspedes extra`);
  }

  return {
    nights: nights.map((date) => ({
      date: formatDate(date),
      basePrice: packageBase,
      guestSurcharge,
      adjustedPrice: perNight,
      appliedRules,
    })),
    subtotal,
    currency,
    guests,
  };
}

function applyModifier(price: number, rule: PricingRule): number {
  const modifier = Number(rule.modifier);

  if (rule.modifierType === "FIXED") {
    return Math.max(0, price + modifier);
  }

  if (rule.modifierType === "PACKAGE") {
    return Math.max(0, modifier);
  }

  return Math.max(0, price * (1 + modifier / 100));
}

export function calculateDynamicPrice(
  basePrice: number,
  currency: string,
  checkIn: Date,
  checkOut: Date,
  rules: PricingRule[],
  guests = 1
): PriceBreakdown {
  const nights = eachNight(checkIn, checkOut);
  const nightCount = nights.length;
  const guestSurcharge = extraGuestFee(guests);
  const sortedRules = [...rules].sort((a, b) => b.priority - a.priority);

  const packageRule = findPackageRule(sortedRules, nightCount, nights[0]);
  if (packageRule) {
    return buildPackageBreakdown(nights, packageRule, guestSurcharge, currency, guests);
  }

  const breakdown: PriceBreakdownNight[] = nights.map((date) => {
    let adjustedPrice = nightlyRateBeforeRules(basePrice, guests);
    const appliedRules: string[] = [];

    if (guestSurcharge > 0) {
      appliedRules.push(`+${guestSurcharge}€ hóspedes extra`);
    }

    for (const rule of sortedRules) {
      if (ruleApplies(rule, date, nightCount)) {
        adjustedPrice = applyModifier(adjustedPrice, rule);
        appliedRules.push(rule.name);
      }
    }

    return {
      date: formatDate(date),
      basePrice,
      guestSurcharge,
      adjustedPrice: Math.round(adjustedPrice * 100) / 100,
      appliedRules,
    };
  });

  const subtotal = breakdown.reduce((sum, night) => sum + night.adjustedPrice, 0);

  return {
    nights: breakdown,
    subtotal: Math.round(subtotal * 100) / 100,
    currency,
    guests,
  };
}

export function applyReservationDiscount(subtotal: number, discountPercent = 0): number {
  if (discountPercent <= 0) {
    return subtotal;
  }

  return Math.round(subtotal * (1 - discountPercent / 100) * 100) / 100;
}
