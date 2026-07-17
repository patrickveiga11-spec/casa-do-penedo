/**
 * Smoke tests do motor de preços — corre com: npx tsx scripts/pricing-smoke.ts
 * Falha com exit 1 se algum cenário der valor inesperado (ex.: 0€).
 */
import type { PricingRule } from "@prisma/client";
import { calculateDynamicPrice } from "../src/services/pricing.js";
import { toDateOnly } from "../src/lib/dates.js";

function rule(
  partial: Partial<PricingRule> & {
    id: string;
    name: string;
    modifier: number;
    modifierType: string;
  }
): PricingRule {
  return {
    propertyId: "p1",
    priority: 0,
    isActive: true,
    showOnPublicPage: true,
    startDate: null,
    endDate: null,
    dayOfWeek: null,
    minNights: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...partial,
    modifier: partial.modifier as unknown as PricingRule["modifier"],
  } as PricingRule;
}

const rules: PricingRule[] = [
  rule({ id: "pkg1", name: "1n", priority: 10, minNights: 1, modifier: 200, modifierType: "PACKAGE" }),
  rule({ id: "pkg2", name: "2n", priority: 9, minNights: 2, modifier: 250, modifierType: "PACKAGE" }),
  rule({
    id: "long",
    name: "long",
    priority: 1,
    minNights: 6,
    modifier: -10,
    modifierType: "PERCENT",
  }),
  rule({
    id: "s1",
    name: "2027-1n",
    priority: 20,
    minNights: 1,
    modifier: 200,
    modifierType: "PACKAGE",
    startDate: toDateOnly("2027-06-01"),
    endDate: toDateOnly("2027-09-30"),
    showOnPublicPage: false,
  }),
  rule({
    id: "s2",
    name: "2027-2n",
    priority: 19,
    minNights: 2,
    modifier: 350,
    modifierType: "PACKAGE",
    startDate: toDateOnly("2027-06-01"),
    endDate: toDateOnly("2027-09-30"),
    showOnPublicPage: false,
  }),
  rule({
    id: "s3",
    name: "2027-3n",
    priority: 18,
    minNights: 3,
    modifier: 450,
    modifierType: "PACKAGE",
    startDate: toDateOnly("2027-06-01"),
    endDate: toDateOnly("2027-09-30"),
    showOnPublicPage: false,
  }),
  rule({
    id: "slong",
    name: "2027-long",
    priority: 17,
    minNights: 6,
    modifier: -10,
    modifierType: "PERCENT",
    startDate: toDateOnly("2027-06-01"),
    endDate: toDateOnly("2027-09-30"),
    showOnPublicPage: false,
  }),
  rule({
    id: "sextra",
    name: "2027-extra",
    priority: 16,
    minNights: 4,
    modifier: 150,
    modifierType: "FIXED",
    startDate: toDateOnly("2027-06-01"),
    endDate: toDateOnly("2027-09-30"),
    showOnPublicPage: false,
  }),
];

function quote(checkIn: string, checkOut: string, guests = 2) {
  return calculateDynamicPrice(100, "EUR", toDateOnly(checkIn), toDateOnly(checkOut), rules, guests);
}

const cases: Array<{ label: string; checkIn: string; checkOut: string; expected: number }> = [
  { label: "nov 2026 · 1 noite", checkIn: "2026-11-10", checkOut: "2026-11-11", expected: 200 },
  { label: "nov 2026 · 2 noites", checkIn: "2026-11-10", checkOut: "2026-11-12", expected: 250 },
  { label: "nov 2026 · 3 noites", checkIn: "2026-11-10", checkOut: "2026-11-13", expected: 300 },
  { label: "nov 2026 · 7 noites (-10%)", checkIn: "2026-11-01", checkOut: "2026-11-08", expected: 630 },
  { label: "ago 2026 · 3 noites", checkIn: "2026-08-10", checkOut: "2026-08-13", expected: 300 },
  { label: "mai 2027 · 3 noites", checkIn: "2027-05-10", checkOut: "2027-05-13", expected: 300 },
  { label: "jul 2027 · 1 noite", checkIn: "2027-07-10", checkOut: "2027-07-11", expected: 200 },
  { label: "jul 2027 · 2 noites", checkIn: "2027-07-10", checkOut: "2027-07-12", expected: 350 },
  { label: "jul 2027 · 3 noites", checkIn: "2027-07-10", checkOut: "2027-07-13", expected: 450 },
  { label: "jul 2027 · 4 noites", checkIn: "2027-07-10", checkOut: "2027-07-14", expected: 600 },
  { label: "jul 2027 · 6 noites (-10%)", checkIn: "2027-07-10", checkOut: "2027-07-16", expected: 810 },
  { label: "nov 2027 · 3 noites", checkIn: "2027-11-10", checkOut: "2027-11-13", expected: 300 },
];

let failed = 0;

for (const testCase of cases) {
  try {
    const result = quote(testCase.checkIn, testCase.checkOut);
    if (result.subtotal !== testCase.expected) {
      console.error(`FAIL ${testCase.label}: got ${result.subtotal}, expected ${testCase.expected}`);
      failed += 1;
    } else if (result.subtotal <= 0) {
      console.error(`FAIL ${testCase.label}: subtotal <= 0`);
      failed += 1;
    } else {
      console.log(`OK   ${testCase.label}: ${result.subtotal}€`);
    }
  } catch (error) {
    console.error(`FAIL ${testCase.label}:`, error instanceof Error ? error.message : error);
    failed += 1;
  }
}

for (const bad of [
  { checkIn: "2026-11-10", checkOut: "2026-11-10" },
  { checkIn: "2026-11-11", checkOut: "2026-11-10" },
]) {
  try {
    quote(bad.checkIn, bad.checkOut);
    console.error(`FAIL invalid ${bad.checkIn}→${bad.checkOut}: should throw`);
    failed += 1;
  } catch {
    console.log(`OK   rejeita ${bad.checkIn}→${bad.checkOut}`);
  }
}

if (failed > 0) {
  console.error(`\n${failed} teste(s) falharam`);
  process.exit(1);
}

console.log("\nTodos os testes de preço passaram.");
