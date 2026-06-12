UPDATE "InvestmentHolding"
SET "units" = "units" * 10
WHERE "units" <> 0;

UPDATE "InvestmentTransaction"
SET
  "units" = "units" * 10,
  "nav" = "nav" / 10
WHERE "instrumentId" IS NOT NULL;

UPDATE "InvestmentDividendPayment"
SET "units" = "units" * 10
WHERE "units" <> 0;

UPDATE "InvestmentDividendEvent"
SET "amountMerits" = "amountMerits" / 10
WHERE "amountMerits" <> 0;
