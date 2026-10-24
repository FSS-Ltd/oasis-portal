import { describe, expect, it } from 'vitest';
import {
  assertRealtimeTransport,
  expectedTwoFactor,
} from '../../scripts/realtime-configuration.js';

describe('Realtime 2FA deployment configuration', () => {
  it('matches application trim/lowercase true semantics', () => {
    expect(expectedTwoFactor(' TRUE ')).toBe(true);
    expect(expectedTwoFactor('false')).toBe(false);
    expect(expectedTwoFactor('1')).toBe(false);
    expect(expectedTwoFactor('')).toBe(false);
  });
  it('fails closed when the deployment variable is missing', () => {
    expect(() => expectedTwoFactor(undefined)).toThrow('OASIS_ENFORCE_2FA must be set');
  });
});

describe('hosted Realtime deployment readiness', () => {
  const ready = { database: 'postgres', messages: true, send: true, authorization: true };

  it('accepts an installed transport with private authorization', () => {
    expect(() => {
      assertRealtimeTransport(ready);
    }).not.toThrow();
  });

  it.each(['messages', 'send'] as const)(
    'rejects missing %s in the application database',
    (field) => {
      expect(() => {
        assertRealtimeTransport({ ...ready, database: 'oasis_prod', [field]: false });
      }).toThrow('Application tables and managed Realtime transport must share a database');
    },
  );

  it('rejects missing private authorization even when transport exists', () => {
    expect(() => {
      assertRealtimeTransport({ ...ready, authorization: false });
    }).toThrow('Private Realtime authorization policies are missing');
  });

  it('rejects an absent readiness result', () => {
    expect(() => {
      assertRealtimeTransport(undefined);
    }).toThrow('Realtime transport is unavailable');
  });
});
