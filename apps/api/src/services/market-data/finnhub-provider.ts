import { createHash } from 'node:crypto';

export const FINNHUB_API_KEY_ENV = 'FINNHUB_API_KEY';
export const FINNHUB_BASE_URL_ENV = 'FINNHUB_BASE_URL';
export const DEFAULT_FINNHUB_BASE_URL = 'https://finnhub.io/api/v1';

const DEFAULT_TIMEOUT_MS = 8_000;
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_BACKOFF_MS = 250;

export interface FinnhubEnv {
  [key: string]: string | undefined;
  FINNHUB_API_KEY?: string;
  FINNHUB_BASE_URL?: string;
}

export interface FinnhubConfig {
  apiKey: string;
  baseUrl: string;
}

export interface FinnhubFetchResult {
  payload: unknown;
  rawPayloadHash: string;
  httpStatus?: number;
}

export interface FinnhubProvider {
  getCompanyNews(symbol: string, from: string, to: string): Promise<FinnhubFetchResult>;
  getDividends(symbol: string, from: string, to: string): Promise<FinnhubFetchResult>;
}

export interface FinnhubProviderOptions {
  config?: FinnhubConfig;
  fetchImpl?: typeof fetch;
  maxRetries?: number;
  timeoutMs?: number;
  backoffMs?: number;
}

function normaliseBaseUrl(value: string | undefined): string {
  const candidate = value?.trim() || DEFAULT_FINNHUB_BASE_URL;
  try {
    return new URL(candidate).toString().replace(/\/$/, '');
  } catch {
    throw new Error(`${FINNHUB_BASE_URL_ENV} must be a valid URL`);
  }
}

export function readFinnhubConfig(env: FinnhubEnv = process.env): FinnhubConfig {
  const apiKey = env.FINNHUB_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(`${FINNHUB_API_KEY_ENV} is required for Finnhub market enrichment`);
  }

  return {
    apiKey,
    baseUrl: normaliseBaseUrl(env.FINNHUB_BASE_URL),
  };
}

function hashPayload(rawPayload: string): string {
  return `sha256:${createHash('sha256').update(rawPayload).digest('hex')}`;
}

async function sleep(ms: number): Promise<void> {
  if (ms <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function providerUrl(config: FinnhubConfig, path: string, params: Record<string, string>): string {
  const url = new URL(path, config.baseUrl);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  url.searchParams.set('token', config.apiKey);
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

export function createFinnhubProvider(options: FinnhubProviderOptions = {}): FinnhubProvider {
  const config = options.config ?? readFinnhubConfig();
  const fetchImpl = options.fetchImpl ?? fetch;
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const backoffMs = options.backoffMs ?? DEFAULT_BACKOFF_MS;

  async function getJson(url: string): Promise<FinnhubFetchResult> {
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
        lastError = err instanceof Error ? err : new Error('Finnhub request failed');
        if (attempt === maxRetries) throw lastError;
      }

      await sleep(backoffMs * (attempt + 1));
    }

    throw lastError ?? new Error('Finnhub request failed');
  }

  return {
    getCompanyNews(symbol: string, from: string, to: string): Promise<FinnhubFetchResult> {
      return getJson(providerUrl(config, '/company-news', { from, symbol, to }));
    },
    getDividends(symbol: string, from: string, to: string): Promise<FinnhubFetchResult> {
      return getJson(providerUrl(config, '/stock/dividend', { from, symbol, to }));
    },
  };
}
