-- Add requested LSE-listed ETF instruments from the Phase 8 seed review.
-- These are additive seed rows only; existing instrument history is preserved.

INSERT INTO "InvestmentInstrument" (
    "id",
    "symbol",
    "provider",
    "providerSymbol",
    "displayName",
    "kind",
    "exchangeMic",
    "sourceCurrency",
    "riskBand",
    "enabled",
    "sortOrder",
    "updatedAt"
) VALUES
    ('investment-instrument-vusa', 'VUSA', 'twelve-data', 'VUSA', 'Vanguard S&P 500 UCITS ETF', 'etf', 'XLON', 'GBP', 'medium', true, 9, CURRENT_TIMESTAMP),
    ('investment-instrument-csp1', 'CSP1', 'twelve-data', 'CSP1', 'iShares Core S&P 500 UCITS ETF', 'etf', 'XLON', 'GBp', 'medium', true, 10, CURRENT_TIMESTAMP),
    ('investment-instrument-eqqq', 'EQQQ', 'twelve-data', 'EQQQ', 'Invesco EQQQ NASDAQ-100 UCITS ETF', 'etf', 'XLON', 'GBp', 'high', true, 11, CURRENT_TIMESTAMP),
    ('investment-instrument-jepq', 'JEPQ', 'twelve-data', 'JEPQ', 'JPMorgan Nasdaq Equity Premium Income Active UCITS ETF', 'etf', 'XLON', 'USD', 'high', true, 12, CURRENT_TIMESTAMP),
    ('investment-instrument-jepi', 'JEPI', 'twelve-data', 'JEPI', 'JPM US Equity Premium Income Active UCITS ETF', 'etf', 'XLON', 'USD', 'medium', true, 13, CURRENT_TIMESTAMP)
ON CONFLICT ("provider", "providerSymbol") DO UPDATE SET
    "symbol" = EXCLUDED."symbol",
    "displayName" = EXCLUDED."displayName",
    "kind" = EXCLUDED."kind",
    "exchangeMic" = EXCLUDED."exchangeMic",
    "sourceCurrency" = EXCLUDED."sourceCurrency",
    "riskBand" = EXCLUDED."riskBand",
    "enabled" = EXCLUDED."enabled",
    "sortOrder" = EXCLUDED."sortOrder",
    "updatedAt" = CURRENT_TIMESTAMP;
