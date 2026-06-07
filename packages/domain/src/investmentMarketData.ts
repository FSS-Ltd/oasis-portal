import { z } from 'zod';

export type MarketDataProvider = 'twelve-data';
export type InvestmentMarketInstrumentKind = 'stock' | 'etf';

export type MarketDataErrorCode =
  | 'invalid_response'
  | 'missing_price'
  | 'missing_timestamp'
  | 'missing_currency'
  | 'missing_conversion_rate'
  | 'unsupported_instrument_type'
  | 'rate_limited'
  | 'provider_error'
  | 'stale_quote';

export interface MarketDataNormalisationError {
  code: MarketDataErrorCode;
  message: string;
  providerStatus?: number | undefined;
}

export type MarketDataNormalisationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: MarketDataNormalisationError };

export interface ProviderQuoteSnapshot {
  provider: MarketDataProvider;
  symbol: string;
  name?: string | undefined;
  exchangeMic: string;
  instrumentKind: InvestmentMarketInstrumentKind;
  providerTimestamp: Date;
  serverFetchedAt: Date;
  sourceCurrency: string;
  sourcePrice: number;
  gbpConversionRate: number;
  gbpPrice: number;
  previousCloseGbp: number;
  dayChangePct: number;
  providerCreditsUsed?: number | undefined;
  providerCreditsLeft?: number | undefined;
}

export interface ProviderHistoryPoint {
  symbol: string;
  timestamp: Date;
  sourceCurrency: string;
  openSource: number;
  highSource: number;
  lowSource: number;
  closeSource: number;
  closeGbp: number;
  volume?: number | undefined;
}

export interface ProviderInstrumentProfile {
  provider: MarketDataProvider;
  symbol: string;
  name: string;
  exchangeMic: string;
  instrumentKind: InvestmentMarketInstrumentKind;
  sourceCurrency: string;
  country?: string | undefined;
}

export const GBP_PER_MERIT = 10;

const MERIT_DECIMAL_PLACES = 6;
const MONEY_DECIMAL_PLACES = 6;

export type DecimalValue = number | string | { toString(): string };

export interface MarketDataMeritValuationInput {
  gbpPrice: DecimalValue;
  previousCloseGbp: DecimalValue;
}

export interface MarketDataMeritValuation {
  priceMerits: number;
  previousCloseMerits: number;
  dailyMovementMerits: number;
}

export interface HoldingValueMeritsInput {
  units: DecimalValue;
  gbpPrice: DecimalValue;
}

export interface TwelveDataQuoteContext {
  symbol: string;
  exchangeMic: string;
  instrumentKind: InvestmentMarketInstrumentKind;
  serverFetchedAt: Date;
  gbpConversionRates?: Partial<Record<string, number>>;
  maxQuoteAgeMs?: number;
  httpStatus?: number;
  providerCreditsUsed?: number;
  providerCreditsLeft?: number;
}

export interface TwelveDataHistoryContext {
  symbol: string;
  sourceCurrency: string;
  gbpConversionRate: number;
}

const providerErrorSchema = z.object({
  status: z.literal('error'),
  code: z.union([z.number(), z.string()]).optional(),
  message: z.string().optional(),
});

const quoteSchema = z.object({
  symbol: z.string().min(1),
  name: z.string().optional(),
  mic_code: z.string().optional(),
  currency: z.string().min(1).optional(),
  timestamp: z.union([z.string(), z.number()]).optional(),
  datetime: z.string().optional(),
  close: z.union([z.string(), z.number()]).optional(),
  previous_close: z.union([z.string(), z.number()]).optional(),
  percent_change: z.union([z.string(), z.number()]).optional(),
});

const historyPointSchema = z.object({
  datetime: z.string(),
  open: z.union([z.string(), z.number()]),
  high: z.union([z.string(), z.number()]),
  low: z.union([z.string(), z.number()]),
  close: z.union([z.string(), z.number()]),
  volume: z.union([z.string(), z.number()]).optional(),
});

const historySchema = z.object({
  values: z.array(historyPointSchema),
});

const profileSchema = z.object({
  symbol: z.string().min(1),
  name: z.string().min(1),
  currency: z.string().min(1),
  mic_code: z.string().min(1),
  country: z.string().optional(),
  type: z.string().min(1),
});

function error(
  code: MarketDataErrorCode,
  message: string,
  providerStatus?: number,
): MarketDataNormalisationResult<never> {
  return {
    ok: false,
    error: {
      code,
      message,
      providerStatus,
    },
  };
}

function parseRawNumber(value: unknown): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number(value.trim());
  return null;
}

function parseFinitePositiveNumber(value: unknown): number | null {
  const parsed = parseRawNumber(value);
  if (parsed === null) return null;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseFiniteNumber(value: unknown): number | null {
  const parsed = parseRawNumber(value);
  if (parsed === null) return null;
  return Number.isFinite(parsed) ? parsed : null;
}

function parseTimestamp(timestamp: unknown, datetime: string | undefined): Date | null {
  const timestampNumber = parseFinitePositiveNumber(timestamp);
  if (timestampNumber) {
    return new Date(timestampNumber * 1000);
  }

  if (!datetime) return null;
  const parsed = new Date(datetime);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseProviderStatus(code: number | string | undefined): number | undefined {
  if (typeof code === 'number') return code;
  if (!code) return undefined;
  const parsed = Number(code);
  return Number.isInteger(parsed) ? parsed : undefined;
}

function normaliseCurrency(value: string): string {
  const normalised = value.trim().toUpperCase();
  if (normalised === 'GBX' || value.trim() === 'GBp') return 'GBX';
  if (normalised === 'GBP') return 'GBP';
  return normalised;
}

function gbpRateFor(
  sourceCurrency: string,
  rates: Partial<Record<string, number>> = {},
): number | null {
  if (sourceCurrency === 'GBP') return 1;
  if (sourceCurrency === 'GBX') return 0.01;
  const rate = rates[sourceCurrency];
  return Number.isFinite(rate) && rate && rate > 0 ? rate : null;
}

function roundMoney(value: number): number {
  return Number(value.toFixed(6));
}

function decimalText(value: DecimalValue): string {
  const raw = typeof value === 'number' ? value.toString() : value.toString().trim();
  if (!raw) {
    throw new Error('decimal value is required');
  }
  if (!/e/i.test(raw)) {
    return raw;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    throw new Error(`decimal value ${raw} is not finite`);
  }
  return parsed.toFixed(12).replace(/\.?0+$/, '');
}

function decimalToScaledInteger(value: DecimalValue, scale: number): bigint {
  if (!Number.isInteger(scale) || scale < 0) {
    throw new Error('scale must be a non-negative integer');
  }

  const match = /^([+-])?(\d+)(?:\.(\d+))?$/.exec(decimalText(value));
  if (!match) {
    throw new Error(`decimal value ${value.toString()} is not valid`);
  }

  const sign = match[1] === '-' ? -1n : 1n;
  const integerPart = match[2] ?? '0';
  const fractionPart = match[3] ?? '';
  const paddedFraction = fractionPart.padEnd(scale + 1, '0');
  const keptFraction = scale === 0 ? '' : paddedFraction.slice(0, scale);
  const roundingDigit = Number(paddedFraction[scale] ?? '0');
  const magnitudeText = `${integerPart}${keptFraction}`.replace(/^0+/, '') || '0';
  let scaled = BigInt(magnitudeText);
  if (roundingDigit >= 5) {
    scaled += 1n;
  }
  return sign * scaled;
}

function divideRounded(value: bigint, divisor: bigint): bigint {
  if (divisor <= 0n) {
    throw new Error('divisor must be positive');
  }

  const sign = value < 0n ? -1n : 1n;
  const magnitude = value < 0n ? -value : value;
  let quotient = magnitude / divisor;
  const remainder = magnitude % divisor;
  if (remainder * 2n >= divisor) {
    quotient += 1n;
  }
  return sign * quotient;
}

function scaledIntegerToNumber(value: bigint, scale: number): number {
  const sign = value < 0n ? '-' : '';
  const magnitude = value < 0n ? -value : value;
  if (scale === 0) {
    return Number(`${sign}${magnitude.toString()}`);
  }

  const divisor = 10n ** BigInt(scale);
  const integerPart = magnitude / divisor;
  const fractionPart = (magnitude % divisor).toString().padStart(scale, '0');
  return Number(`${sign}${integerPart.toString()}.${fractionPart}`);
}

function gbpToMeritScaled(value: DecimalValue): bigint {
  const gbpScaled = decimalToScaledInteger(value, MERIT_DECIMAL_PLACES + 1);
  return divideRounded(gbpScaled, BigInt(GBP_PER_MERIT * 10));
}

export function gbpToMerits(value: DecimalValue): number {
  return scaledIntegerToNumber(gbpToMeritScaled(value), MERIT_DECIMAL_PLACES);
}

export function buildMarketDataMeritValuation(
  input: MarketDataMeritValuationInput,
): MarketDataMeritValuation {
  const priceScaled = gbpToMeritScaled(input.gbpPrice);
  const previousCloseScaled = gbpToMeritScaled(input.previousCloseGbp);
  return {
    dailyMovementMerits: scaledIntegerToNumber(
      priceScaled - previousCloseScaled,
      MERIT_DECIMAL_PLACES,
    ),
    previousCloseMerits: scaledIntegerToNumber(previousCloseScaled, MERIT_DECIMAL_PLACES),
    priceMerits: scaledIntegerToNumber(priceScaled, MERIT_DECIMAL_PLACES),
  };
}

export function holdingValueMeritsFromGbpPrice(input: HoldingValueMeritsInput): number {
  const unitsScaled = decimalToScaledInteger(input.units, MERIT_DECIMAL_PLACES);
  if (unitsScaled <= 0n) return 0;

  const gbpPriceScaled = decimalToScaledInteger(input.gbpPrice, MONEY_DECIMAL_PLACES);
  const product = unitsScaled * gbpPriceScaled;
  const divisor = BigInt(GBP_PER_MERIT) * 10n ** BigInt(MONEY_DECIMAL_PLACES);
  return scaledIntegerToNumber(divideRounded(product, divisor), MERIT_DECIMAL_PLACES);
}

function parseProviderError(input: unknown): MarketDataNormalisationError | null {
  const parsed = providerErrorSchema.safeParse(input);
  if (!parsed.success) return null;

  return {
    code: 'provider_error',
    message: parsed.data.message?.trim() || 'Twelve Data returned an error',
    providerStatus: parseProviderStatus(parsed.data.code),
  };
}

export function normaliseTwelveDataQuoteResponse(
  input: unknown,
  context: TwelveDataQuoteContext,
): MarketDataNormalisationResult<ProviderQuoteSnapshot> {
  if (context.httpStatus === 429) {
    return error('rate_limited', 'Twelve Data rate limit was reached', 429);
  }

  const providerError = parseProviderError(input);
  if (providerError) return { ok: false, error: providerError };

  const parsed = quoteSchema.safeParse(input);
  if (!parsed.success) {
    return error('invalid_response', 'Twelve Data quote response was not valid');
  }

  const sourceCurrencyValue = parsed.data.currency?.trim();
  if (!sourceCurrencyValue) {
    return error('missing_currency', 'Twelve Data quote did not include a currency');
  }
  const sourceCurrency = normaliseCurrency(sourceCurrencyValue);
  const sourcePrice = parseFinitePositiveNumber(parsed.data.close);
  if (!sourcePrice) {
    return error('missing_price', 'Twelve Data quote did not include a valid close price');
  }

  const providerTimestamp = parseTimestamp(parsed.data.timestamp, parsed.data.datetime);
  if (!providerTimestamp) {
    return error('missing_timestamp', 'Twelve Data quote did not include a valid timestamp');
  }

  if (
    context.maxQuoteAgeMs !== undefined &&
    context.serverFetchedAt.getTime() - providerTimestamp.getTime() > context.maxQuoteAgeMs
  ) {
    return error('stale_quote', 'Twelve Data quote is older than the allowed max age');
  }

  const gbpConversionRate = gbpRateFor(sourceCurrency, context.gbpConversionRates);
  if (!gbpConversionRate) {
    return error(
      'missing_conversion_rate',
      `GBP conversion rate is required for ${sourceCurrency} quotes`,
    );
  }

  const previousClose = parseFinitePositiveNumber(parsed.data.previous_close) ?? sourcePrice;
  const dayChangePct = parseFiniteNumber(parsed.data.percent_change) ?? 0;

  return {
    ok: true,
    value: {
      dayChangePct,
      exchangeMic: context.exchangeMic,
      gbpConversionRate,
      gbpPrice: roundMoney(sourcePrice * gbpConversionRate),
      instrumentKind: context.instrumentKind,
      name: parsed.data.name,
      previousCloseGbp: roundMoney(previousClose * gbpConversionRate),
      provider: 'twelve-data',
      providerCreditsLeft: context.providerCreditsLeft,
      providerCreditsUsed: context.providerCreditsUsed,
      providerTimestamp,
      serverFetchedAt: context.serverFetchedAt,
      sourceCurrency,
      sourcePrice,
      symbol: context.symbol,
    },
  };
}

export function normaliseTwelveDataHistoryResponse(
  input: unknown,
  context: TwelveDataHistoryContext,
): MarketDataNormalisationResult<ProviderHistoryPoint[]> {
  const providerError = parseProviderError(input);
  if (providerError) return { ok: false, error: providerError };

  const parsed = historySchema.safeParse(input);
  if (!parsed.success || context.gbpConversionRate <= 0) {
    return error('invalid_response', 'Twelve Data history response was not valid');
  }

  const points: ProviderHistoryPoint[] = [];
  for (const point of parsed.data.values) {
    const timestamp = parseTimestamp(undefined, `${point.datetime}T00:00:00.000Z`);
    const openSource = parseFinitePositiveNumber(point.open);
    const highSource = parseFinitePositiveNumber(point.high);
    const lowSource = parseFinitePositiveNumber(point.low);
    const closeSource = parseFinitePositiveNumber(point.close);
    if (!timestamp || !openSource || !highSource || !lowSource || !closeSource) {
      return error('invalid_response', 'Twelve Data history response contained an invalid point');
    }

    const volume = parseFiniteNumber(point.volume);
    points.push({
      closeGbp: roundMoney(closeSource * context.gbpConversionRate),
      closeSource,
      highSource,
      lowSource,
      openSource,
      sourceCurrency: normaliseCurrency(context.sourceCurrency),
      symbol: context.symbol,
      timestamp,
      volume: volume ?? undefined,
    });
  }

  return {
    ok: true,
    value: points.sort((left, right) => left.timestamp.getTime() - right.timestamp.getTime()),
  };
}

function normaliseInstrumentKind(type: string): InvestmentMarketInstrumentKind | null {
  const normalised = type.trim().toLowerCase();
  if (normalised === 'stock' || normalised === 'common stock') return 'stock';
  if (normalised === 'etf' || normalised === 'exchange traded fund') return 'etf';
  return null;
}

export function normaliseTwelveDataProfileResponse(
  input: unknown,
): MarketDataNormalisationResult<ProviderInstrumentProfile> {
  const providerError = parseProviderError(input);
  if (providerError) return { ok: false, error: providerError };

  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) {
    return error('invalid_response', 'Twelve Data profile response was not valid');
  }

  const instrumentKind = normaliseInstrumentKind(parsed.data.type);
  if (!instrumentKind) {
    return error(
      'unsupported_instrument_type',
      `Twelve Data profile type ${parsed.data.type} is not supported`,
    );
  }

  return {
    ok: true,
    value: {
      country: parsed.data.country,
      exchangeMic: parsed.data.mic_code,
      instrumentKind,
      name: parsed.data.name,
      provider: 'twelve-data',
      sourceCurrency: normaliseCurrency(parsed.data.currency),
      symbol: parsed.data.symbol,
    },
  };
}
