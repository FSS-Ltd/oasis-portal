import { describe, expect, it } from 'vitest';
import {
  readTwelveDataConfig,
  TWELVE_DATA_API_KEY_ENV,
} from '../services/market-data/twelve-data-config.js';

describe('readTwelveDataConfig', () => {
  it('reads and trims the server-only Twelve Data API key', () => {
    expect(
      readTwelveDataConfig({
        TWELVE_DATA_API_KEY: '  td_test_key  ',
      }),
    ).toEqual({
      apiKey: 'td_test_key',
      baseUrl: 'https://api.twelvedata.com',
    });
  });

  it('allows an explicit base URL for tests and sandbox providers', () => {
    expect(
      readTwelveDataConfig({
        TWELVE_DATA_API_KEY: 'td_test_key',
        TWELVE_DATA_BASE_URL: ' https://sandbox.example.test/ ',
      }),
    ).toEqual({
      apiKey: 'td_test_key',
      baseUrl: 'https://sandbox.example.test',
    });
  });

  it('rejects missing API keys without leaking provider details', () => {
    expect(() => readTwelveDataConfig({})).toThrow(
      `${TWELVE_DATA_API_KEY_ENV} is required for Twelve Data market data`,
    );
  });
});
