import { describe, expect, it } from 'vitest';
import {
  ANNUAL_DRIFT,
  computeWithdrawalFee,
  generateNavSeries,
  mulberry32,
  seedFromString,
} from '../investmentSim.js';

describe('mulberry32', () => {
  it('is deterministic for a given seed', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 100; i++) expect(a()).toBe(b());
  });

  it('produces values in [0, 1)', () => {
    const rng = mulberry32(1);
    for (let i = 0; i < 1000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('seedFromString', () => {
  it('is deterministic', () => {
    expect(seedFromString('oasis')).toBe(seedFromString('oasis'));
  });
  it('differs for different inputs', () => {
    expect(seedFromString('oasis')).not.toBe(seedFromString('oasis-v2'));
  });
});

describe('generateNavSeries', () => {
  it('produces the requested number of days', () => {
    const ticks = generateNavSeries({ seed: 'oasis', days: 252 });
    expect(ticks).toHaveLength(252);
  });

  it('is deterministic given the same seed', () => {
    const a = generateNavSeries({ seed: 'oasis', days: 50 });
    const b = generateNavSeries({ seed: 'oasis', days: 50 });
    expect(a.map((t) => t.nav)).toEqual(b.map((t) => t.nav));
  });

  it('trends upward on average over 3 years (allowing realistic variance)', () => {
    const ticks = generateNavSeries({ seed: 'oasis', days: 252 * 3, startingNav: 100 });
    const final = ticks[ticks.length - 1]?.nav ?? 0;
    // μ ≈ 10% p.a. compounded over 3 years → ~133; but with σ=15% a single
    // 3-year path can easily land between 80 and 200. We only assert the
    // weaker property that it finishes positive and the mean daily return
    // is within a wide band of the theoretical daily drift.
    expect(final).toBeGreaterThan(50);
    const meanDaily = ticks.reduce((a, t) => a + t.dailyReturn, 0) / ticks.length;
    expect(meanDaily).toBeGreaterThan(ANNUAL_DRIFT / 252 - 0.005);
    expect(meanDaily).toBeLessThan(ANNUAL_DRIFT / 252 + 0.005);
  });

  it('produces some down days (the point of the lesson)', () => {
    const ticks = generateNavSeries({ seed: 'oasis', days: 60 });
    const downs = ticks.filter((t) => t.dailyReturn < 0).length;
    expect(downs).toBeGreaterThan(5);
  });
});

describe('computeWithdrawalFee', () => {
  it('applies the default 5% fee rounded down', () => {
    expect(computeWithdrawalFee({ proceedsMerits: 100 })).toBe(5);
    expect(computeWithdrawalFee({ proceedsMerits: 19 })).toBe(0);
  });

  it('honours a custom fee rate', () => {
    expect(computeWithdrawalFee({ proceedsMerits: 100, feeRatePct: 10 })).toBe(10);
  });

  it('rejects invalid inputs', () => {
    expect(() => computeWithdrawalFee({ proceedsMerits: -1 })).toThrow();
    expect(() => computeWithdrawalFee({ proceedsMerits: 100, feeRatePct: 150 })).toThrow();
  });
});
