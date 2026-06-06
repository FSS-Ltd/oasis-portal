export const TWELVE_DATA_API_KEY_ENV = 'TWELVE_DATA_API_KEY';
export const TWELVE_DATA_BASE_URL_ENV = 'TWELVE_DATA_BASE_URL';
export const DEFAULT_TWELVE_DATA_BASE_URL = 'https://api.twelvedata.com';

export interface TwelveDataEnv {
  [key: string]: string | undefined;
  TWELVE_DATA_API_KEY?: string;
  TWELVE_DATA_BASE_URL?: string;
}

export interface TwelveDataConfig {
  apiKey: string;
  baseUrl: string;
}

function normaliseBaseUrl(value: string | undefined): string {
  const candidate = value?.trim() || DEFAULT_TWELVE_DATA_BASE_URL;
  try {
    return new URL(candidate).toString().replace(/\/$/, '');
  } catch {
    throw new Error(`${TWELVE_DATA_BASE_URL_ENV} must be a valid URL`);
  }
}

export function readTwelveDataConfig(env: TwelveDataEnv = process.env): TwelveDataConfig {
  const apiKey = env.TWELVE_DATA_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(`${TWELVE_DATA_API_KEY_ENV} is required for Twelve Data market data`);
  }

  return {
    apiKey,
    baseUrl: normaliseBaseUrl(env.TWELVE_DATA_BASE_URL),
  };
}
