-- Merit Markets provider rework: Yahoo Finance prices for stocks/ETFs,
-- Twelve Data crypto prices, and Finnhub news/dividend enrichment.

ALTER TYPE "InvestmentTxType" ADD VALUE IF NOT EXISTS 'Dividend';

ALTER TABLE "InvestmentInstrument"
  ADD COLUMN "category" TEXT,
  ADD COLUMN "summary" TEXT,
  ADD COLUMN "themeColor" TEXT,
  ADD COLUMN "newsSymbol" TEXT,
  ADD COLUMN "dividendSymbol" TEXT;

UPDATE "InvestmentInstrument"
SET
  "provider" = 'yahoo-finance',
  "providerSymbol" = CASE "symbol"
    WHEN 'VUSA' THEN 'VUSA.L'
    WHEN 'CSP1' THEN 'CSP1.L'
    WHEN 'EQQQ' THEN 'EQQQ.L'
    WHEN 'JEPQ' THEN 'JEPQ.L'
    WHEN 'JEPI' THEN 'JEPI.L'
    ELSE "symbol"
  END,
  "newsSymbol" = CASE
    WHEN "kind" = 'stock' THEN "symbol"
    ELSE NULL
  END,
  "dividendSymbol" = CASE
    WHEN "kind" IN ('stock', 'etf') THEN "symbol"
    ELSE NULL
  END,
  "category" = CASE
    WHEN "kind" = 'etf' THEN 'ETF'
    ELSE 'Stock'
  END,
  "themeColor" = CASE "symbol"
    WHEN 'AAPL' THEN '#555b61'
    WHEN 'MSFT' THEN '#2e7d32'
    WHEN 'NVDA' THEN '#1a7a4a'
    WHEN 'DIS' THEN '#2e5e8c'
    ELSE '#2e5e8c'
  END,
  "summary" = CASE "symbol"
    WHEN 'AAPL' THEN 'Maker of the iPhone, Mac, and iPad. One of the most valuable technology companies in the world.'
    WHEN 'MSFT' THEN 'Windows, Office, Xbox, and Azure. A major software and cloud computing company.'
    WHEN 'NVDA' THEN 'Designs chips used for gaming, graphics, data centres, and artificial intelligence.'
    WHEN 'DIS' THEN 'Films, theme parks, Disney+, and ESPN. A long-running entertainment business.'
    WHEN 'VOO' THEN 'A broad S&P 500 ETF holding many large US companies in one fund.'
    WHEN 'VT' THEN 'A global stock ETF designed to spread exposure across many countries.'
    WHEN 'BND' THEN 'A bond market ETF used as a steadier portfolio building block.'
    WHEN 'GLD' THEN 'A gold-backed ETF that can move differently from shares.'
    WHEN 'VUSA' THEN 'A London-listed S&P 500 ETF holding many large US companies.'
    WHEN 'CSP1' THEN 'A London-listed S&P 500 ETF from iShares.'
    WHEN 'EQQQ' THEN 'A London-listed Nasdaq 100 ETF with a strong technology tilt.'
    WHEN 'JEPQ' THEN 'A London-listed income ETF linked to Nasdaq companies.'
    WHEN 'JEPI' THEN 'A London-listed income ETF linked to US equities.'
    ELSE "summary"
  END,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "kind" IN ('stock', 'etf');

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
  ('investment-instrument-crypto-btc-usd', 'BTC/USD', 'twelve-data', 'BTC/USD', 'Bitcoin', 'crypto', 'CRYPTO', 'USD', 'high', 'Crypto', 'Bitcoin is the largest cryptocurrency and is known for its fixed supply and large price swings.', '#f7931a', 'BTC', NULL, true, 101, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('investment-instrument-crypto-eth-usd', 'ETH/USD', 'twelve-data', 'ETH/USD', 'Ethereum', 'crypto', 'CRYPTO', 'USD', 'high', 'Crypto', 'Ethereum is a blockchain network used for smart contracts and applications.', '#627eea', 'ETH', NULL, true, 102, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('investment-instrument-crypto-usdt-usd', 'USDT/USD', 'twelve-data', 'USDT/USD', 'Tether', 'crypto', 'CRYPTO', 'USD', 'medium', 'Crypto', 'Tether is a stablecoin designed to track the US dollar, though it still carries crypto-specific risks.', '#26a17b', 'USDT', NULL, true, 103, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('investment-instrument-crypto-bnb-usd', 'BNB/USD', 'twelve-data', 'BNB/USD', 'BNB', 'crypto', 'CRYPTO', 'USD', 'high', 'Crypto', 'BNB is a crypto asset associated with the Binance ecosystem.', '#f3ba2f', 'BNB', NULL, true, 104, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('investment-instrument-crypto-usdc-usd', 'USDC/USD', 'twelve-data', 'USDC/USD', 'USD Coin', 'crypto', 'CRYPTO', 'USD', 'medium', 'Crypto', 'USD Coin is a regulated stablecoin designed to track the US dollar.', '#2775ca', 'USDC', NULL, true, 105, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('investment-instrument-crypto-xrp-usd', 'XRP/USD', 'twelve-data', 'XRP/USD', 'XRP', 'crypto', 'CRYPTO', 'USD', 'high', 'Crypto', 'XRP is a digital asset used by the XRP Ledger for fast transfers.', '#23292f', 'XRP', NULL, true, 106, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('investment-instrument-crypto-sol-usd', 'SOL/USD', 'twelve-data', 'SOL/USD', 'Solana', 'crypto', 'CRYPTO', 'USD', 'high', 'Crypto', 'Solana is a blockchain network focused on fast transactions and applications.', '#14f195', 'SOL', NULL, true, 107, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('investment-instrument-crypto-trx-usd', 'TRX/USD', 'twelve-data', 'TRX/USD', 'TRON', 'crypto', 'CRYPTO', 'USD', 'high', 'Crypto', 'TRON is a blockchain network used for digital assets and applications.', '#ef0027', 'TRX', NULL, true, 108, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('investment-instrument-crypto-hype-usd', 'HYPE/USD', 'twelve-data', 'HYPE/USD', 'Hyperliquid', 'crypto', 'CRYPTO', 'USD', 'high', 'Crypto', 'Hyperliquid is a crypto asset associated with decentralised trading infrastructure.', '#00b8d9', 'HYPE', NULL, true, 109, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('investment-instrument-crypto-doge-usd', 'DOGE/USD', 'twelve-data', 'DOGE/USD', 'Dogecoin', 'crypto', 'CRYPTO', 'USD', 'high', 'Crypto', 'Dogecoin began as a meme coin and remains highly volatile.', '#c2a633', 'DOGE', NULL, true, 110, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('investment-instrument-crypto-leo-usd', 'LEO/USD', 'twelve-data', 'LEO/USD', 'UNUS SED LEO', 'crypto', 'CRYPTO', 'USD', 'high', 'Crypto', 'LEO is a crypto token associated with an exchange ecosystem.', '#8c6b2f', 'LEO', NULL, true, 111, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('investment-instrument-crypto-zec-usd', 'ZEC/USD', 'twelve-data', 'ZEC/USD', 'Zcash', 'crypto', 'CRYPTO', 'USD', 'high', 'Crypto', 'Zcash is a cryptocurrency focused on optional privacy features.', '#ecb244', 'ZEC', NULL, true, 112, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('investment-instrument-crypto-xmr-usd', 'XMR/USD', 'twelve-data', 'XMR/USD', 'Monero', 'crypto', 'CRYPTO', 'USD', 'high', 'Crypto', 'Monero is a privacy-focused cryptocurrency and can be especially volatile.', '#ff6600', 'XMR', NULL, true, 113, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('investment-instrument-crypto-xlm-usd', 'XLM/USD', 'twelve-data', 'XLM/USD', 'Stellar', 'crypto', 'CRYPTO', 'USD', 'high', 'Crypto', 'Stellar is a network for moving digital assets and payments.', '#111827', 'XLM', NULL, true, 114, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('investment-instrument-crypto-cc-usd', 'CC/USD', 'twelve-data', 'CC/USD', 'Canton', 'crypto', 'CRYPTO', 'USD', 'high', 'Crypto', 'Canton is included because it ranked in the selected top-16 list; it should remain disabled if the provider cannot supply it.', '#475569', 'CC', NULL, true, 115, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('investment-instrument-crypto-ada-usd', 'ADA/USD', 'twelve-data', 'ADA/USD', 'Cardano', 'crypto', 'CRYPTO', 'USD', 'high', 'Crypto', 'Cardano is a blockchain network focused on research-led protocol design.', '#0033ad', 'ADA', NULL, true, 116, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
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

CREATE TABLE "InvestmentNewsItem" (
  "id" TEXT NOT NULL,
  "instrumentId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "providerNewsId" TEXT NOT NULL,
  "headline" TEXT NOT NULL,
  "summary" TEXT NOT NULL DEFAULT '',
  "source" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "imageUrl" TEXT,
  "publishedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InvestmentNewsItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InvestmentDividendEvent" (
  "id" TEXT NOT NULL,
  "instrumentId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "providerEventId" TEXT NOT NULL,
  "exDate" DATE NOT NULL,
  "payDate" DATE,
  "sourceCurrency" TEXT NOT NULL,
  "amountSource" DECIMAL(18, 6) NOT NULL,
  "gbpConversionRate" DECIMAL(18, 6) NOT NULL,
  "amountGbp" DECIMAL(18, 6) NOT NULL,
  "amountMerits" DECIMAL(18, 6) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InvestmentDividendEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InvestmentDividendPayment" (
  "id" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "dividendEventId" TEXT NOT NULL,
  "transactionId" TEXT NOT NULL,
  "units" DECIMAL(18, 6) NOT NULL,
  "payoutMerits" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InvestmentDividendPayment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InvestmentNewsItem_provider_providerNewsId_key"
  ON "InvestmentNewsItem"("provider", "providerNewsId");
CREATE INDEX "InvestmentNewsItem_instrumentId_publishedAt_idx"
  ON "InvestmentNewsItem"("instrumentId", "publishedAt");

CREATE UNIQUE INDEX "InvestmentDividendEvent_provider_providerEventId_key"
  ON "InvestmentDividendEvent"("provider", "providerEventId");
CREATE UNIQUE INDEX "InvestmentDividendEvent_instrumentId_exDate_amountSource_key"
  ON "InvestmentDividendEvent"("instrumentId", "exDate", "amountSource");
CREATE INDEX "InvestmentDividendEvent_instrumentId_exDate_idx"
  ON "InvestmentDividendEvent"("instrumentId", "exDate");

CREATE UNIQUE INDEX "InvestmentDividendPayment_studentId_dividendEventId_key"
  ON "InvestmentDividendPayment"("studentId", "dividendEventId");
CREATE INDEX "InvestmentDividendPayment_dividendEventId_idx"
  ON "InvestmentDividendPayment"("dividendEventId");
CREATE INDEX "InvestmentDividendPayment_transactionId_idx"
  ON "InvestmentDividendPayment"("transactionId");

ALTER TABLE "InvestmentNewsItem"
  ADD CONSTRAINT "InvestmentNewsItem_instrumentId_fkey"
  FOREIGN KEY ("instrumentId") REFERENCES "InvestmentInstrument"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "InvestmentDividendEvent"
  ADD CONSTRAINT "InvestmentDividendEvent_instrumentId_fkey"
  FOREIGN KEY ("instrumentId") REFERENCES "InvestmentInstrument"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "InvestmentDividendPayment"
  ADD CONSTRAINT "InvestmentDividendPayment_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "Student"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "InvestmentDividendPayment"
  ADD CONSTRAINT "InvestmentDividendPayment_dividendEventId_fkey"
  FOREIGN KEY ("dividendEventId") REFERENCES "InvestmentDividendEvent"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "InvestmentDividendPayment"
  ADD CONSTRAINT "InvestmentDividendPayment_transactionId_fkey"
  FOREIGN KEY ("transactionId") REFERENCES "InvestmentTransaction"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
