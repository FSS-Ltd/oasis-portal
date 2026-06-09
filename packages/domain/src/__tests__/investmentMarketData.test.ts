import { describe, expect, it } from 'vitest';
import {
  GBP_PER_MERIT,
  LEARNING_RETURN_MULTIPLIER,
  applyLearningReturnMultiplier,
  buildMarketDataMeritValuation,
  computeLearningHoldingReturn,
  holdingValueMeritsFromGbpPrice,
  gbpToMerits,
  normaliseTwelveDataHistoryResponse,
  normaliseTwelveDataProfileResponse,
  normaliseTwelveDataQuoteResponse,
} from '../investmentMarketData.js';

const serverFetchedAt = new Date('2026-06-05T15:45:00.000Z');

const gbpQuote = {
  symbol: 'VOD',
  name: 'Vodafone Group PLC',
  exchange: 'London Stock Exchange',
  mic_code: 'XLON',
  currency: 'GBP',
  timestamp: '1780672500',
  close: '72.41',
  previous_close: '70.00',
  percent_change: '3.442857',
};

describe('market data merit valuation', () => {
  it('documents the backend GBP-to-merit rate', () => {
    expect(GBP_PER_MERIT).toBe(10);
  });

  it('converts GBP prices to six-decimal merit prices deterministically', () => {
    expect(gbpToMerits('72.41')).toBe(7.241);
    expect(gbpToMerits('75.325555')).toBe(7.532556);
    expect(gbpToMerits('-1.25')).toBe(-0.125);
  });

  it('builds merit valuation fields from GBP-normalized market snapshots', () => {
    expect(
      buildMarketDataMeritValuation({
        gbpPrice: '160.00',
        previousCloseGbp: '158.75',
      }),
    ).toEqual({
      dailyMovementMerits: 0.125,
      previousCloseMerits: 15.875,
      priceMerits: 16,
    });
  });

  it('values holdings from units and GBP prices while preserving zero-unit holdings', () => {
    expect(holdingValueMeritsFromGbpPrice({ gbpPrice: '160.00', units: '1.5' })).toBe(24);
    expect(holdingValueMeritsFromGbpPrice({ gbpPrice: '160.00', units: '0' })).toBe(0);
  });
});

describe('normaliseTwelveDataQuoteResponse', () => {
  it('normalises a GBP stock quote into a server snapshot', () => {
    const result = normaliseTwelveDataQuoteResponse(gbpQuote, {
      exchangeMic: 'XLON',
      instrumentKind: 'stock',
      serverFetchedAt,
      symbol: 'VOD',
    });

    expect(result).toEqual({
      ok: true,
      value: {
        dayChangePct: 3.442857,
        exchangeMic: 'XLON',
        gbpConversionRate: 1,
        gbpPrice: 72.41,
        instrumentKind: 'stock',
        name: 'Vodafone Group PLC',
        previousCloseGbp: 70,
        provider: 'twelve-data',
        providerCreditsLeft: undefined,
        providerCreditsUsed: undefined,
        providerTimestamp: new Date('2026-06-05T15:15:00.000Z'),
        serverFetchedAt,
        sourceCurrency: 'GBP',
        sourcePrice: 72.41,
        symbol: 'VOD',
      },
    });
  });

  it('normalises a non-GBP ETF quote when a conversion rate is supplied', () => {
    const result = normaliseTwelveDataQuoteResponse(
      {
        ...gbpQuote,
        currency: 'USD',
        close: '100.00',
        previous_close: '95.00',
        symbol: 'SPY',
      },
      {
        exchangeMic: 'ARCX',
        gbpConversionRates: { USD: 0.8 },
        instrumentKind: 'etf',
        providerCreditsLeft: 792,
        providerCreditsUsed: 8,
        serverFetchedAt,
        symbol: 'SPY',
      },
    );

    expect(result).toMatchObject({
      ok: true,
      value: {
        exchangeMic: 'ARCX',
        gbpConversionRate: 0.8,
        gbpPrice: 80,
        instrumentKind: 'etf',
        previousCloseGbp: 76,
        providerCreditsLeft: 792,
        providerCreditsUsed: 8,
        sourceCurrency: 'USD',
        sourcePrice: 100,
        symbol: 'SPY',
      },
    });
  });

  it('normalises London GBp quotes into GBP values', () => {
    const result = normaliseTwelveDataQuoteResponse(
      {
        ...gbpQuote,
        close: '7532.00',
        currency: 'GBp',
        previous_close: '7500.00',
        symbol: 'CSP1',
      },
      {
        exchangeMic: 'XLON',
        instrumentKind: 'etf',
        serverFetchedAt,
        symbol: 'CSP1',
      },
    );

    expect(result).toMatchObject({
      ok: true,
      value: {
        gbpConversionRate: 0.01,
        gbpPrice: 75.32,
        previousCloseGbp: 75,
        sourceCurrency: 'GBX',
        sourcePrice: 7532,
        symbol: 'CSP1',
      },
    });
  });

  it('rejects non-GBP quotes without a conversion rate', () => {
    const result = normaliseTwelveDataQuoteResponse(
      { ...gbpQuote, currency: 'USD', symbol: 'SPY' },
      {
        exchangeMic: 'ARCX',
        instrumentKind: 'etf',
        serverFetchedAt,
        symbol: 'SPY',
      },
    );

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'missing_conversion_rate',
        message: 'GBP conversion rate is required for USD quotes',
        providerStatus: undefined,
      },
    });
  });

  it('maps missing and malformed quote fields to typed errors', () => {
    expect(
      normaliseTwelveDataQuoteResponse(
        { ...gbpQuote, close: undefined },
        {
          exchangeMic: 'XLON',
          instrumentKind: 'stock',
          serverFetchedAt,
          symbol: 'VOD',
        },
      ),
    ).toEqual({
      ok: false,
      error: {
        code: 'missing_price',
        message: 'Twelve Data quote did not include a valid close price',
        providerStatus: undefined,
      },
    });

    expect(
      normaliseTwelveDataQuoteResponse(
        { ...gbpQuote, timestamp: 'not-a-timestamp' },
        {
          exchangeMic: 'XLON',
          instrumentKind: 'stock',
          serverFetchedAt,
          symbol: 'VOD',
        },
      ),
    ).toEqual({
      ok: false,
      error: {
        code: 'missing_timestamp',
        message: 'Twelve Data quote did not include a valid timestamp',
        providerStatus: undefined,
      },
    });
  });

  it('maps provider and rate-limit errors without throwing', () => {
    expect(
      normaliseTwelveDataQuoteResponse(
        { status: 'error', code: 400, message: 'symbol is invalid' },
        {
          exchangeMic: 'XLON',
          instrumentKind: 'stock',
          serverFetchedAt,
          symbol: 'BAD',
        },
      ),
    ).toEqual({
      ok: false,
      error: {
        code: 'provider_error',
        message: 'symbol is invalid',
        providerStatus: 400,
      },
    });

    expect(
      normaliseTwelveDataQuoteResponse(gbpQuote, {
        exchangeMic: 'XLON',
        httpStatus: 429,
        instrumentKind: 'stock',
        serverFetchedAt,
        symbol: 'VOD',
      }),
    ).toEqual({
      ok: false,
      error: {
        code: 'rate_limited',
        message: 'Twelve Data rate limit was reached',
        providerStatus: 429,
      },
    });
  });

  it('marks quotes stale when the provider timestamp exceeds max age', () => {
    const result = normaliseTwelveDataQuoteResponse(gbpQuote, {
      exchangeMic: 'XLON',
      instrumentKind: 'stock',
      maxQuoteAgeMs: 60_000,
      serverFetchedAt,
      symbol: 'VOD',
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'stale_quote',
        message: 'Twelve Data quote is older than the allowed max age',
        providerStatus: undefined,
      },
    });
  });
});

describe('normaliseTwelveDataHistoryResponse', () => {
  it('normalises history points in ascending timestamp order', () => {
    const result = normaliseTwelveDataHistoryResponse(
      {
        values: [
          {
            datetime: '2026-06-05',
            open: '71.00',
            high: '73.00',
            low: '70.00',
            close: '72.00',
            volume: '1000',
          },
          {
            datetime: '2026-06-04',
            open: '70.00',
            high: '72.00',
            low: '69.00',
            close: '71.00',
            volume: '900',
          },
        ],
      },
      {
        gbpConversionRate: 1,
        sourceCurrency: 'GBP',
        symbol: 'VOD',
      },
    );

    expect(result).toEqual({
      ok: true,
      value: [
        {
          closeGbp: 71,
          closeSource: 71,
          highSource: 72,
          lowSource: 69,
          openSource: 70,
          sourceCurrency: 'GBP',
          symbol: 'VOD',
          timestamp: new Date('2026-06-04T00:00:00.000Z'),
          volume: 900,
        },
        {
          closeGbp: 72,
          closeSource: 72,
          highSource: 73,
          lowSource: 70,
          openSource: 71,
          sourceCurrency: 'GBP',
          symbol: 'VOD',
          timestamp: new Date('2026-06-05T00:00:00.000Z'),
          volume: 1000,
        },
      ],
    });
  });

  it('rejects malformed history values', () => {
    const result = normaliseTwelveDataHistoryResponse(
      {
        values: [
          { datetime: '2026-06-05', open: '71.00', high: 'bad', low: '70.00', close: '72.00' },
        ],
      },
      {
        gbpConversionRate: 1,
        sourceCurrency: 'GBP',
        symbol: 'VOD',
      },
    );

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'invalid_response',
        message: 'Twelve Data history response contained an invalid point',
        providerStatus: undefined,
      },
    });
  });
});

describe('normaliseTwelveDataProfileResponse', () => {
  it('normalises stock and ETF profiles', () => {
    expect(
      normaliseTwelveDataProfileResponse({
        symbol: 'VOD',
        name: 'Vodafone Group PLC',
        currency: 'GBP',
        exchange: 'London Stock Exchange',
        mic_code: 'XLON',
        country: 'United Kingdom',
        type: 'Stock',
      }),
    ).toEqual({
      ok: true,
      value: {
        country: 'United Kingdom',
        exchangeMic: 'XLON',
        instrumentKind: 'stock',
        name: 'Vodafone Group PLC',
        provider: 'twelve-data',
        sourceCurrency: 'GBP',
        symbol: 'VOD',
      },
    });

    expect(
      normaliseTwelveDataProfileResponse({
        symbol: 'VUSA',
        name: 'Vanguard S&P 500 UCITS ETF',
        currency: 'GBP',
        exchange: 'London Stock Exchange',
        mic_code: 'XLON',
        country: 'United Kingdom',
        type: 'ETF',
      }),
    ).toMatchObject({
      ok: true,
      value: {
        instrumentKind: 'etf',
        symbol: 'VUSA',
      },
    });
  });

  it('rejects unsupported instrument profiles', () => {
    expect(
      normaliseTwelveDataProfileResponse({
        symbol: 'BTC',
        name: 'Bitcoin',
        currency: 'USD',
        exchange: 'Crypto',
        mic_code: 'CRYPTO',
        country: '',
        type: 'Digital Currency',
      }),
    ).toEqual({
      ok: false,
      error: {
        code: 'unsupported_instrument_type',
        message: 'Twelve Data profile type Digital Currency is not supported',
        providerStatus: undefined,
      },
    });
  });
});

describe('applyLearningReturnMultiplier', () => {
  it('documents the default learning multiplier', () => {
    expect(LEARNING_RETURN_MULTIPLIER).toBe(10);
  });

  it('scales a small positive return by the multiplier', () => {
    expect(applyLearningReturnMultiplier(0.003, 'daily')).toBeCloseTo(0.03);
  });

  it('scales a small negative return (loss is also amplified)', () => {
    expect(applyLearningReturnMultiplier(-0.003, 'daily')).toBeCloseTo(-0.03);
  });

  it('returns zero for a flat market', () => {
    expect(applyLearningReturnMultiplier(0, 'daily')).toBe(0);
  });

  it('clamps an extreme positive daily return to the daily cap', () => {
    expect(applyLearningReturnMultiplier(0.05, 'daily')).toBe(0.08);
  });

  it('clamps an extreme negative daily return to the daily cap', () => {
    expect(applyLearningReturnMultiplier(-0.05, 'daily')).toBe(-0.08);
  });

  it('hits the daily cap exactly when raw × multiplier equals the cap', () => {
    expect(applyLearningReturnMultiplier(0.008, 'daily')).toBeCloseTo(0.08);
  });

  it('clamps to the weekly cap', () => {
    expect(applyLearningReturnMultiplier(0.1, 'weekly')).toBe(0.18);
    expect(applyLearningReturnMultiplier(-0.1, 'weekly')).toBe(-0.18);
  });

  it('clamps to the monthly cap', () => {
    expect(applyLearningReturnMultiplier(0.2, 'monthly')).toBe(0.35);
    expect(applyLearningReturnMultiplier(-0.2, 'monthly')).toBe(-0.35);
  });

  it('respects a custom multiplier override', () => {
    expect(applyLearningReturnMultiplier(0.01, 'daily', 5)).toBeCloseTo(0.05);
  });
});

describe('computeLearningHoldingReturn', () => {
  it('computes raw and learning returns for a gain', () => {
    // 1 unit at 100 GBP cost → 10 merits cost basis
    // current price 110 GBP → 11 merits raw value → +10% raw
    // learning: 10% × 10 = 100% → clamped to +8% daily
    const result = computeLearningHoldingReturn({
      units: '1',
      costBasisMerits: '10',
      currentGbpPrice: '110',
      range: 'daily',
    });

    expect(result.rawValueMerits).toBe(11);
    expect(result.rawReturnRate).toBeCloseTo(0.1);
    expect(result.rawProfitMerits).toBeCloseTo(1);
    expect(result.learningReturnRate).toBe(0.08);
    expect(result.learningValueMerits).toBeCloseTo(10.8);
    expect(result.learningProfitMerits).toBeCloseTo(0.8);
  });

  it('amplifies a loss up to the daily cap', () => {
    // current price 90 GBP → 9 merits raw → -10% raw
    // learning: -10% × 10 = -100% → clamped to -8% daily
    const result = computeLearningHoldingReturn({
      units: '1',
      costBasisMerits: '10',
      currentGbpPrice: '90',
      range: 'daily',
    });

    expect(result.rawReturnRate).toBeCloseTo(-0.1);
    expect(result.learningReturnRate).toBe(-0.08);
    expect(result.learningValueMerits).toBeCloseTo(9.2);
    expect(result.learningProfitMerits).toBeCloseTo(-0.8);
  });

  it('returns zero profit for a flat holding', () => {
    const result = computeLearningHoldingReturn({
      units: '1',
      costBasisMerits: '10',
      currentGbpPrice: '100',
      range: 'daily',
    });

    expect(result.rawReturnRate).toBe(0);
    expect(result.learningReturnRate).toBe(0);
    expect(result.rawProfitMerits).toBe(0);
    expect(result.learningProfitMerits).toBe(0);
  });

  it('does not divide by zero when cost basis is zero', () => {
    const result = computeLearningHoldingReturn({
      units: '1',
      costBasisMerits: '0',
      currentGbpPrice: '100',
      range: 'daily',
    });

    expect(result.rawReturnRate).toBe(0);
    expect(result.learningReturnRate).toBe(0);
  });

  it('does not mutate the costBasisMerits input', () => {
    const input = {
      units: '1',
      costBasisMerits: '10',
      currentGbpPrice: '120',
      range: 'daily' as const,
    };
    computeLearningHoldingReturn(input);
    expect(input.costBasisMerits).toBe('10');
  });

  it('respects a custom multiplier passed to the input', () => {
    // 2% gain × multiplier 2 = 4% → uncapped at daily (cap is 8%)
    const result = computeLearningHoldingReturn({
      units: '1',
      costBasisMerits: '10',
      currentGbpPrice: '102',
      range: 'daily',
      multiplier: 2,
    });

    expect(result.learningReturnRate).toBeCloseTo(0.04);
  });
});
