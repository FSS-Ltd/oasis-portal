-- Phase 8 PR-8.2: provider-backed educational investment instruments and
-- market-data snapshots. Existing NAV, account, transaction, and ledger tables
-- remain untouched.

CREATE TABLE "InvestmentInstrument" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerSymbol" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "exchangeMic" TEXT NOT NULL,
    "sourceCurrency" TEXT NOT NULL,
    "riskBand" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvestmentInstrument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MarketDataSnapshot" (
    "id" TEXT NOT NULL,
    "instrumentId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerTimestamp" TIMESTAMP(3) NOT NULL,
    "serverFetchedAt" TIMESTAMP(3) NOT NULL,
    "sourceCurrency" TEXT NOT NULL,
    "sourcePrice" DECIMAL(18,6) NOT NULL,
    "gbpConversionRate" DECIMAL(18,6) NOT NULL,
    "gbpPrice" DECIMAL(18,6) NOT NULL,
    "previousCloseGbp" DECIMAL(18,6) NOT NULL,
    "dayChangePct" DECIMAL(10,6) NOT NULL,
    "rawPayloadHash" TEXT NOT NULL,
    "providerCreditsUsed" INTEGER,
    "providerCreditsLeft" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketDataSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InvestmentInstrument_provider_providerSymbol_key"
    ON "InvestmentInstrument"("provider", "providerSymbol");

CREATE INDEX "InvestmentInstrument_enabled_sortOrder_idx"
    ON "InvestmentInstrument"("enabled", "sortOrder");

CREATE INDEX "InvestmentInstrument_symbol_idx"
    ON "InvestmentInstrument"("symbol");

CREATE INDEX "MarketDataSnapshot_instrumentId_serverFetchedAt_idx"
    ON "MarketDataSnapshot"("instrumentId", "serverFetchedAt");

CREATE INDEX "MarketDataSnapshot_provider_providerTimestamp_idx"
    ON "MarketDataSnapshot"("provider", "providerTimestamp");

ALTER TABLE "MarketDataSnapshot"
    ADD CONSTRAINT "MarketDataSnapshot_instrumentId_fkey"
    FOREIGN KEY ("instrumentId") REFERENCES "InvestmentInstrument"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

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
    ('investment-instrument-voo', 'VOO', 'twelve-data', 'VOO', 'Vanguard S&P 500 ETF', 'etf', 'ARCX', 'USD', 'medium', true, 1, CURRENT_TIMESTAMP),
    ('investment-instrument-vt', 'VT', 'twelve-data', 'VT', 'Vanguard Total World Stock ETF', 'etf', 'ARCX', 'USD', 'medium', true, 2, CURRENT_TIMESTAMP),
    ('investment-instrument-bnd', 'BND', 'twelve-data', 'BND', 'Vanguard Total Bond Market ETF', 'etf', 'XNAS', 'USD', 'low', true, 3, CURRENT_TIMESTAMP),
    ('investment-instrument-gld', 'GLD', 'twelve-data', 'GLD', 'SPDR Gold Shares', 'etf', 'ARCX', 'USD', 'medium', true, 4, CURRENT_TIMESTAMP),
    ('investment-instrument-aapl', 'AAPL', 'twelve-data', 'AAPL', 'Apple', 'stock', 'XNAS', 'USD', 'high', true, 5, CURRENT_TIMESTAMP),
    ('investment-instrument-msft', 'MSFT', 'twelve-data', 'MSFT', 'Microsoft', 'stock', 'XNAS', 'USD', 'high', true, 6, CURRENT_TIMESTAMP),
    ('investment-instrument-nvda', 'NVDA', 'twelve-data', 'NVDA', 'Nvidia', 'stock', 'XNAS', 'USD', 'high', true, 7, CURRENT_TIMESTAMP),
    ('investment-instrument-dis', 'DIS', 'twelve-data', 'DIS', 'Disney', 'stock', 'XNYS', 'USD', 'high', true, 8, CURRENT_TIMESTAMP)
ON CONFLICT ("provider", "providerSymbol") DO NOTHING;
