-- AlterTable
ALTER TABLE "PricingRule" ADD COLUMN "showOnPublicPage" BOOLEAN NOT NULL DEFAULT true;

-- Época alta 2027 (oculta no público, activa para orçamentos)
INSERT INTO "PricingRule" (
  "id", "propertyId", "name", "priority", "isActive", "showOnPublicPage",
  "startDate", "endDate", "minNights", "modifier", "modifierType",
  "createdAt", "updatedAt"
)
SELECT
  'cprule2027_1n',
  p."id",
  'Época alta 2027 — 1 noite (200€)',
  20,
  true,
  false,
  '2027-06-01'::date,
  '2027-09-30'::date,
  1,
  200,
  'PACKAGE',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Property" p
WHERE p."slug" = 'casa-do-penedo'
  AND NOT EXISTS (SELECT 1 FROM "PricingRule" r WHERE r."id" = 'cprule2027_1n');

INSERT INTO "PricingRule" (
  "id", "propertyId", "name", "priority", "isActive", "showOnPublicPage",
  "startDate", "endDate", "minNights", "modifier", "modifierType",
  "createdAt", "updatedAt"
)
SELECT
  'cprule2027_2n',
  p."id",
  'Época alta 2027 — 2 noites (350€)',
  19,
  true,
  false,
  '2027-06-01'::date,
  '2027-09-30'::date,
  2,
  350,
  'PACKAGE',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Property" p
WHERE p."slug" = 'casa-do-penedo'
  AND NOT EXISTS (SELECT 1 FROM "PricingRule" r WHERE r."id" = 'cprule2027_2n');

INSERT INTO "PricingRule" (
  "id", "propertyId", "name", "priority", "isActive", "showOnPublicPage",
  "startDate", "endDate", "minNights", "modifier", "modifierType",
  "createdAt", "updatedAt"
)
SELECT
  'cprule2027_3n',
  p."id",
  'Época alta 2027 — 3 noites (450€)',
  18,
  true,
  false,
  '2027-06-01'::date,
  '2027-09-30'::date,
  3,
  450,
  'PACKAGE',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Property" p
WHERE p."slug" = 'casa-do-penedo'
  AND NOT EXISTS (SELECT 1 FROM "PricingRule" r WHERE r."id" = 'cprule2027_3n');

INSERT INTO "PricingRule" (
  "id", "propertyId", "name", "priority", "isActive", "showOnPublicPage",
  "startDate", "endDate", "minNights", "modifier", "modifierType",
  "createdAt", "updatedAt"
)
SELECT
  'cprule2027_long',
  p."id",
  'Época alta 2027 — estadia longa (6+ noites, -10%)',
  17,
  true,
  false,
  '2027-06-01'::date,
  '2027-09-30'::date,
  6,
  -10,
  'PERCENT',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Property" p
WHERE p."slug" = 'casa-do-penedo'
  AND NOT EXISTS (SELECT 1 FROM "PricingRule" r WHERE r."id" = 'cprule2027_long');

INSERT INTO "PricingRule" (
  "id", "propertyId", "name", "priority", "isActive", "showOnPublicPage",
  "startDate", "endDate", "minNights", "modifier", "modifierType",
  "createdAt", "updatedAt"
)
SELECT
  'cprule2027_extra',
  p."id",
  'Época alta 2027 — noite extra (150€)',
  16,
  true,
  false,
  '2027-06-01'::date,
  '2027-09-30'::date,
  4,
  150,
  'FIXED',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Property" p
WHERE p."slug" = 'casa-do-penedo'
  AND NOT EXISTS (SELECT 1 FROM "PricingRule" r WHERE r."id" = 'cprule2027_extra');
