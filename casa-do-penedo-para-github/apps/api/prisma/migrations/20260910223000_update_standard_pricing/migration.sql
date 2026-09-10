-- Diária e pacotes públicos (sem datas = todo o ano)
UPDATE "Property"
SET "basePrice" = 150
WHERE "slug" = 'casa-do-penedo';

UPDATE "PricingRule" AS r
SET
  "name" = 'Estadia de 1 noite (225€)',
  "modifier" = 225,
  "updatedAt" = CURRENT_TIMESTAMP
FROM "Property" AS p
WHERE r."propertyId" = p."id"
  AND p."slug" = 'casa-do-penedo'
  AND r."modifierType" = 'PACKAGE'
  AND r."minNights" = 1
  AND r."startDate" IS NULL
  AND r."endDate" IS NULL;

UPDATE "PricingRule" AS r
SET
  "name" = 'Estadia de 2 noites (325€)',
  "modifier" = 325,
  "updatedAt" = CURRENT_TIMESTAMP
FROM "Property" AS p
WHERE r."propertyId" = p."id"
  AND p."slug" = 'casa-do-penedo'
  AND r."modifierType" = 'PACKAGE'
  AND r."minNights" = 2
  AND r."startDate" IS NULL
  AND r."endDate" IS NULL;
