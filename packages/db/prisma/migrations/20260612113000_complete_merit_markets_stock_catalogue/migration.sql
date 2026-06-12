-- Complete the provider-backed Merit Markets stock catalogue. The UI now uses
-- InvestmentInstrument as the source of truth once live market data is enabled.

UPDATE "InvestmentInstrument"
SET
  "sortOrder" = CASE "symbol"
    WHEN 'VUSA' THEN 15
    WHEN 'CSP1' THEN 16
    WHEN 'EQQQ' THEN 17
    WHEN 'JEPQ' THEN 18
    WHEN 'JEPI' THEN 19
    ELSE "sortOrder"
  END,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "symbol" IN ('VUSA', 'CSP1', 'EQQQ', 'JEPQ', 'JEPI');

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
  "category",
  "summary",
  "themeColor",
  "newsSymbol",
  "dividendSymbol",
  "enabled",
  "sortOrder",
  "createdAt",
  "updatedAt"
) VALUES
  ('investment-instrument-googl', 'GOOGL', 'yahoo-finance', 'GOOGL', 'Alphabet', 'stock', 'XNAS', 'USD', 'high', 'Technology', 'The parent company of Google, YouTube, Android, and other internet businesses.', '#4285f4', 'GOOGL', 'GOOGL', true, 9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('investment-instrument-amzn', 'AMZN', 'yahoo-finance', 'AMZN', 'Amazon', 'stock', 'XNAS', 'USD', 'high', 'Consumer', 'The online shopping giant, also a leader in cloud computing and streaming.', '#e47911', 'AMZN', 'AMZN', true, 10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('investment-instrument-tsla', 'TSLA', 'yahoo-finance', 'TSLA', 'Tesla', 'stock', 'XNAS', 'USD', 'high', 'Automotive', 'Electric cars, batteries, and solar. One of the most talked-about and volatile stocks.', '#c0392b', 'TSLA', 'TSLA', true, 11, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('investment-instrument-nke', 'NKE', 'yahoo-finance', 'NKE', 'Nike', 'stock', 'XNYS', 'USD', 'high', 'Consumer', 'The sportswear brand behind trainers, kit, and the famous swoosh.', '#6b4c0a', 'NKE', 'NKE', true, 12, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('investment-instrument-ko', 'KO', 'yahoo-finance', 'KO', 'Coca-Cola', 'stock', 'XNYS', 'USD', 'medium', 'Consumer', 'The drinks company behind Coca-Cola, Fanta, and Sprite. Known for steadier returns.', '#9b2235', 'KO', 'KO', true, 13, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('investment-instrument-sbux', 'SBUX', 'yahoo-finance', 'SBUX', 'Starbucks', 'stock', 'XNAS', 'USD', 'high', 'Consumer', 'The global coffee-shop chain with stores in towns and cities around the world.', '#1a7a4a', 'SBUX', 'SBUX', true, 14, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("provider", "providerSymbol") DO UPDATE SET
  "symbol" = EXCLUDED."symbol",
  "displayName" = EXCLUDED."displayName",
  "kind" = EXCLUDED."kind",
  "exchangeMic" = EXCLUDED."exchangeMic",
  "sourceCurrency" = EXCLUDED."sourceCurrency",
  "riskBand" = EXCLUDED."riskBand",
  "category" = EXCLUDED."category",
  "summary" = EXCLUDED."summary",
  "themeColor" = EXCLUDED."themeColor",
  "newsSymbol" = EXCLUDED."newsSymbol",
  "dividendSymbol" = EXCLUDED."dividendSymbol",
  "enabled" = EXCLUDED."enabled",
  "sortOrder" = EXCLUDED."sortOrder",
  "updatedAt" = CURRENT_TIMESTAMP;
