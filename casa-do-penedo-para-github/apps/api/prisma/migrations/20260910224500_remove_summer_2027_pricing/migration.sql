-- Remover tarifas de época alta 2027 (já substituídas pelas tarifas padrão actuais)
DELETE FROM "PricingRule"
WHERE "id" IN (
  'cprule2027_1n',
  'cprule2027_2n',
  'cprule2027_3n',
  'cprule2027_long',
  'cprule2027_extra'
);
