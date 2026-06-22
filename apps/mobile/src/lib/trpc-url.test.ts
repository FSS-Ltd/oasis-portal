import { describe, expect, it } from 'vitest';
import { normalizeTrpcUrl } from './trpc-url';

describe('normalizeTrpcUrl', () => {
  it('uses the canonical Oasis web host instead of the redirecting www host', () => {
    expect(normalizeTrpcUrl('https://www.oasisportal.space/api/trpc')).toBe(
      'https://oasisportal.space/api/trpc',
    );
  });

  it('preserves non-production URLs unchanged', () => {
    expect(normalizeTrpcUrl('https://preview.example.test/api/trpc')).toBe(
      'https://preview.example.test/api/trpc',
    );
  });
});
