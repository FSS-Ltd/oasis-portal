import { createHash } from 'node:crypto';
import { readTwelveDataConfig, type TwelveDataConfig } from './twelve-data-config.js';

const DEFAULT_TIMEOUT_MS = 8_000;
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_BACKOFF_MS = 250;

export interface QuoteFetchResult {
  payload: unknown;
  rawPayloadHash: string;
  httpStatus?: number;
  providerCreditsLeft?: number;
  providerCreditsUsed?: number;
}

export interface TwelveDataQuoteProvider {
  getQuote(symbol: string): Promise<QuoteFetchResult>;
}

export interface TwelveDataProviderOptions {
  config?: TwelveDataConfig;
  fetchImpl?: typeof fetch;
  maxRetries?: number;
  timeoutMs?: number;
  backoffMs?: number;
}

function hashPayload(rawPayload: string): string {
  return `sha256:${createHash('sha256').update(rawPayload).digest('hex')}`;
}

function parseCreditHeader(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined;
}

async function sleep(ms: number): Promise<void> {
  if (ms <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function quoteUrl(config: TwelveDataConfig, symbol: string): string {
  const url = new URL('/quote', config.baseUrl);
  url.searchParams.set('symbol', symbol);
  url.searchParams.set('apikey', config.apiKey);
  return url.toString();
}

async function fetchQuoteWithTimeout(input: {
  fetchImpl: typeof fetch;
  timeoutMs: number;
  url: string;
}): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, input.timeoutMs);
  try {
    return await input.fetchImpl(input.url, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function optionalQuoteMeta(input: {
  httpStatus?: number | undefined;
  providerCreditsLeft?: number | undefined;
  providerCreditsUsed?: number | undefined;
}): Pick<QuoteFetchResult, 'httpStatus' | 'providerCreditsLeft' | 'providerCreditsUsed'> {
  const result: Pick<
    QuoteFetchResult,
    'httpStatus' | 'providerCreditsLeft' | 'providerCreditsUsed'
  > = {};
  if (input.httpStatus !== undefined) result.httpStatus = input.httpStatus;
  if (input.providerCreditsLeft !== undefined) {
    result.providerCreditsLeft = input.providerCreditsLeft;
  }
  if (input.providerCreditsUsed !== undefined) {
    result.providerCreditsUsed = input.providerCreditsUsed;
  }
  return result;
}

export function quoteNormalisationMeta(
  quote: QuoteFetchResult,
): Pick<QuoteFetchResult, 'httpStatus' | 'providerCreditsLeft' | 'providerCreditsUsed'> {
  return optionalQuoteMeta({
    httpStatus: quote.httpStatus,
    providerCreditsLeft: quote.providerCreditsLeft,
    providerCreditsUsed: quote.providerCreditsUsed,
  });
}

export function createTwelveDataMarketDataProvider(
  options: TwelveDataProviderOptions = {},
): TwelveDataQuoteProvider {
  const config = options.config ?? readTwelveDataConfig();
  const fetchImpl = options.fetchImpl ?? fetch;
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const backoffMs = options.backoffMs ?? DEFAULT_BACKOFF_MS;

  return {
    async getQuote(symbol: string): Promise<QuoteFetchResult> {
      const url = quoteUrl(config, symbol);
      let lastError: Error | null = null;

      for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
        try {
          const response = await fetchQuoteWithTimeout({ fetchImpl, timeoutMs, url });
          const rawPayload = await response.text();
          const payload: unknown = rawPayload ? JSON.parse(rawPayload) : null;

          if (response.status < 500 || attempt === maxRetries) {
            return {
              ...optionalQuoteMeta({
                httpStatus: response.status,
                providerCreditsLeft: parseCreditHeader(response.headers.get('api-credits-left')),
                providerCreditsUsed: parseCreditHeader(response.headers.get('api-credits-used')),
              }),
              payload,
              rawPayloadHash: hashPayload(rawPayload),
            };
          }
        } catch (err) {
          lastError = err instanceof Error ? err : new Error('Twelve Data request failed');
          if (attempt === maxRetries) throw lastError;
        }

        await sleep(backoffMs * (attempt + 1));
      }

      throw lastError ?? new Error('Twelve Data request failed');
    },
  };
}
