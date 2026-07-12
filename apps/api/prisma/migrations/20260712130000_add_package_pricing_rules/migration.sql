INSERT INTO "PricingRule" (
  "id",
  "propertyId",
  "name",
  "priority",
  "isActive",
  "minNights",
  "modifier",
  "modifierType",
  "createdAt",
  "updatedAt"
)
SELECT
  'cprule1night200',
  p."id",
  'Estadia de 1 noite (200€)',
  10,
  true,
  1,
  200,
  'PACKAGE',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Property" p
WHERE p."slug" = 'casa-do-penedo'
  AND NOT EXISTS (
    SELECT 1
    FROM "PricingRule" r
    WHERE r."propertyId" = p."id"
      AND r."modifierType" = 'PACKAGE'
      AND r."minNights" = 1
  );

INSERT INTO "PricingRule" (
  "id",
  "propertyId",
  "name",
  "priority",
  "isActive",
  "minNights",
  "modifier",
  "modifierType",
  "createdAt",
  "updatedAt"
)
SELECT
  'cprule2night250',
  p."id",
  'Estadia de 2 noites (250€)',
  9,
  true,
  2,
  250,
  'PACKAGE',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Property" p
WHERE p."slug" = 'casa-do-penedo'
  AND NOT EXISTS (
    SELECT 1
    FROM "PricingRule" r
    WHERE r."propertyId" = p."id"
      AND r."modifierType" = 'PACKAGE'
      AND r."minNights" = 2
  );
