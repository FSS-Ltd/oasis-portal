import { describe, expect, it } from 'vitest';
import { expectedTwoFactor } from '../../scripts/realtime-configuration.js';

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
