import type { PricingRule } from "@prisma/client";
import { formatDate, toDateOnly } from "../lib/dates.js";
import type { PriceBreakdown } from "./pricing.js";

export const SUMMER_2027_START = toDateOnly("2027-06-01");
export const SUMMER_2027_END = toDateOnly("2027-09-30");
export const SUMMER_2027_EXTRA_NIGHT_RATE = 150;

const INCLUDED_GUESTS = 7;
const EXTRA_GUEST_FEE = 15;
const MAX_GUESTS = 10;

function extraGuestFee(guests: number): number {
  const extraGuests = Math.max(0, Math.min(guests, MAX_GUESTS) - INCLUDED_GUESTS);
  return extraGuests * EXTRA_GUEST_FEE;
}

export function isSummer2027Rule(rule: PricingRule): boolean {
  if (!rule.startDate || !rule.endDate) {
    return false;
  }

  return formatDate(rule.startDate) === "2027-06-01" && formatDate(rule.endDate) === "2027-09-30";
}

export function isStayFullyInSummer2027(nights: Date[]): boolean {
  return (
    nights.length > 0 && nights.every((night) => night >= SUMMER_2027_START && night <= SUMMER_2027_END)
  );
}

export function getActiveSummer2027Rules(rules: PricingRule[]): PricingRule[] {
  return rules.filter((rule) => isSummer2027Rule(rule) && rule.isActive);
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export function calculateSummer2027Price(
  nights: Date[],
  rules: PricingRule[],
  currency: string,
  guests: number
): PriceBreakdown | null {
  const activeSummerRules = getActiveSummer2027Rules(rules);

  if (!isStayFullyInSummer2027(nights) || activeSummerRules.length === 0) {
    return null;
  }

  const nightCount = nights.length;
  const guestSurcharge = extraGuestFee(guests);
  const packageRules = activeSummerRules
    .filter((rule) => rule.modifierType === "PACKAGE" && rule.minNights !== null)
    .sort((a, b) => (b.minNights ?? 0) - (a.minNights ?? 0));

  const packageRule = packageRules.find((rule) => rule.minNights === nightCount);
  const threeNightRule = packageRules.find((rule) => rule.minNights === 3);
  const longStayRule = activeSummerRules.find(
    (rule) => rule.modifierType === "PERCENT" && rule.minNights !== null && nightCount >= rule.minNights
  );

  const appliedRules = ["Época alta 2027 (jun–set)"];
  let baseTotal: number;

  if (packageRule) {
    baseTotal = Number(packageRule.modifier);
    appliedRules.push(packageRule.name);
  } else if (nightCount > 3 && threeNightRule) {
    const packageBase = Number(threeNightRule.modifier);
    const extraNights = nightCount - 3;
    baseTotal = packageBase + extraNights * SUMMER_2027_EXTRA_NIGHT_RATE;
    appliedRules.push(`${threeNightRule.name} + ${extraNights}×${SUMMER_2027_EXTRA_NIGHT_RATE}€`);
  } else {
    return null;
  }

  let subtotal = baseTotal + guestSurcharge * nightCount;

  if (guestSurcharge > 0) {
    appliedRules.push(`+${guestSurcharge * nightCount}€ hóspedes extra`);
  }

  if (longStayRule) {
    const discount = Number(longStayRule.modifier);
    subtotal = subtotal * (1 + discount / 100);
    appliedRules.push(longStayRule.name);
  }

  subtotal = roundMoney(subtotal);
  const perNight = roundMoney(subtotal / nightCount);

  return {
    nights: nights.map((date) => ({
      date: formatDate(date),
      basePrice: baseTotal,
      guestSurcharge,
      adjustedPrice: perNight,
      appliedRules,
    })),
    subtotal,
    currency,
    guests,
  };
}
