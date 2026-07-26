import { createHash } from 'node:crypto';
import type { QuoteFetchResult } from './twelve-data-provider.js';

export const YAHOO_FINANCE_BASE_URL_ENV = 'YAHOO_FINANCE_BASE_URL';
export const DEFAULT_YAHOO_FINANCE_BASE_URL = 'https://query1.finance.yahoo.com';

const DEFAULT_TIMEOUT_MS = 8_000;
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_BACKOFF_MS = 250;

export interface YahooFinanceEnv {
  [key: string]: string | undefined;
  YAHOO_FINANCE_BASE_URL?: string;
}

export interface YahooFinanceConfig {
  baseUrl: string;
}

export interface YahooFinanceProvider {
  getDividends(symbol: string): Promise<QuoteFetchResult>;
  getQuote(symbol: string): Promise<QuoteFetchResult>;
  getGbpRate(currency: string): Promise<number>;
}

export interface YahooFinanceProviderOptions {
  config?: YahooFinanceConfig;
  fetchImpl?: typeof fetch;
  maxRetries?: number;
  timeoutMs?: number;
  backoffMs?: number;
}

function normaliseBaseUrl(value: string | undefined): string {
  const candidate = value?.trim() || DEFAULT_YAHOO_FINANCE_BASE_URL;
  try {
    return new URL(candidate).toString().replace(/\/$/, '');
  } catch {
    throw new Error(`${YAHOO_FINANCE_BASE_URL_ENV} must be a valid URL`);
  }
}

export function readYahooFinanceConfig(env: YahooFinanceEnv = process.env): YahooFinanceConfig {
  return {
    baseUrl: normaliseBaseUrl(env.YAHOO_FINANCE_BASE_URL),
  };
}

function hashPayload(rawPayload: string): string {
  return `sha256:${createHash('sha256').update(rawPayload).digest('hex')}`;
}

async function sleep(ms: number): Promise<void> {
  if (ms <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function chartUrl(
  config: YahooFinanceConfig,
  symbol: string,
  options: { events?: string; interval?: string; range?: string } = {},
): string {
  const url = new URL(`/v8/finance/chart/${encodeURIComponent(symbol)}`, config.baseUrl);
  url.searchParams.set('range', options.range ?? '1d');
  url.searchParams.set('interval', options.interval ?? '1d');
  if (options.events) {
    url.searchParams.set('events', options.events);
  }
  return url.toString();
}

async function fetchWithTimeout(input: {
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function closeFromYahooPayload(payload: unknown): number | null {
  if (!isRecord(payload)) return null;
  const chart = payload['chart'];
  if (!isRecord(chart)) return null;
  const result = chart['result'];
  if (!Array.isArray(result)) return null;
  const resultItems: readonly unknown[] = result;
  const first = resultItems[0];
  if (!isRecord(first)) return null;
  const meta = first['meta'];
  if (!isRecord(meta)) return null;
  const value = meta['regularMarketPrice'];
  const parsed =
    typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function createYahooFinanceProvider(
  options: YahooFinanceProviderOptions = {},
): YahooFinanceProvider {
  const config = options.config ?? readYahooFinanceConfig();
  const fetchImpl = options.fetchImpl ?? fetch;
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const backoffMs = options.backoffMs ?? DEFAULT_BACKOFF_MS;

  async function getJsonFromYahoo(url: string): Promise<QuoteFetchResult> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      try {
        const response = await fetchWithTimeout({ fetchImpl, timeoutMs, url });
        const rawPayload = await response.text();
        const payload: unknown = rawPayload ? JSON.parse(rawPayload) : null;

        if (response.status < 500 || attempt === maxRetries) {
          return {
            httpStatus: response.status,
            payload,
            rawPayloadHash: hashPayload(rawPayload),
          };
        }
      } catch (err) {
        lastError = err instanceof Error ? err : new Error('Yahoo Finance request failed');
        if (attempt === maxRetries) throw lastError;
      }

      await sleep(backoffMs * (attempt + 1));
    }

    throw lastError ?? new Error('Yahoo Finance request failed');
  }

  async function getQuote(symbol: string): Promise<QuoteFetchResult> {
    return getJsonFromYahoo(chartUrl(config, symbol));
  }

  return {
    async getDividends(symbol: string): Promise<QuoteFetchResult> {
      return getJsonFromYahoo(
        chartUrl(config, symbol, {
          events: 'div',
          interval: '1d',
          range: '5y',
        }),
      );
    },
    async getGbpRate(currency: string): Promise<number> {
      const trimmedCurrency = currency.trim();
      const normalised = trimmedCurrency.toUpperCase();
      if (normalised === 'GBP') return 1;
      if (normalised === 'GBX' || trimmedCurrency === 'GBp') return 0.01;

      const quote = await getQuote(`${normalised}GBP=X`);
      const close = closeFromYahooPayload(quote.payload);
      if (!close) {
        throw new Error(`GBP conversion quote was invalid for ${normalised}`);
      }
      return close;
    },
    getQuote,
  };
}
