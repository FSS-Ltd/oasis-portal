/**
 * Investment simulator.
 *
 * Teaches students that investing grows wealth over time but is not risk-free.
 *
 * Parameters (Director mandate):
 *   - Target long-run drift: ~10% per year.
 *   - Volatility: ~15% per year (annualised sigma).
 *   - Occasional drawdown regimes — some days, some weeks, the NAV falls.
 *   - Deterministic given a seed — two staging environments with the same
 *     seed produce the same NAV history (testable, reproducible).
 *
 * Model: geometric Brownian motion with rare regime switches.
 *   daily_drift  = 0.10 / 252
 *   daily_sigma  = 0.15 / sqrt(252)
 *   z            = Box-Muller from a seeded PRNG
 *   return       = exp( (drift - sigma^2/2) + sigma*z )
 *   during regime = drift -= 0.002, sigma *= 1.5   (triggered ~2% of days, runs 5-20 days)
 */

const TRADING_DAYS_PER_YEAR = 252;
export const ANNUAL_DRIFT = 0.1;
export const ANNUAL_VOL = 0.15;

const DAILY_DRIFT = ANNUAL_DRIFT / TRADING_DAYS_PER_YEAR;
const DAILY_VOL = ANNUAL_VOL / Math.sqrt(TRADING_DAYS_PER_YEAR);
const REGIME_TRIGGER_PROB = 0.02;
const REGIME_MIN_DAYS = 5;
const REGIME_MAX_DAYS = 20;

/** Mulberry32 PRNG — tiny, fast, seeded, good-enough for a classroom sim. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next(): number {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hash a string seed to a 32-bit integer. FNV-1a. */
export function seedFromString(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Box-Muller transform: two uniforms in (0,1] -> one standard normal. */
function boxMuller(rng: () => number): number {
  const u1 = Math.max(1e-12, rng());
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

export interface NavTick {
  day: number; // 0-indexed trading day
  nav: number;
  dailyReturn: number;
}

export interface NavSeriesOptions {
  seed: string;
  days: number;
  startingNav?: number;
}

export function generateNavSeries(opts: NavSeriesOptions): NavTick[] {
  const rng = mulberry32(seedFromString(opts.seed));
  const ticks: NavTick[] = [];
  let nav = opts.startingNav ?? 100;
  let regimeDaysLeft = 0;

  for (let day = 0; day < opts.days; day++) {
    if (regimeDaysLeft === 0 && rng() < REGIME_TRIGGER_PROB) {
      regimeDaysLeft =
        REGIME_MIN_DAYS + Math.floor(rng() * (REGIME_MAX_DAYS - REGIME_MIN_DAYS + 1));
    }

    const inRegime = regimeDaysLeft > 0;
    const drift = inRegime ? DAILY_DRIFT - 0.002 : DAILY_DRIFT;
    const sigma = inRegime ? DAILY_VOL * 1.5 : DAILY_VOL;

    const z = boxMuller(rng);
    const dailyReturn = Math.exp(drift - (sigma * sigma) / 2 + sigma * z) - 1;
    nav = nav * (1 + dailyReturn);

    ticks.push({ day, nav, dailyReturn });

    if (regimeDaysLeft > 0) regimeDaysLeft -= 1;
  }

  return ticks;
}

/**
 * Withdrawal fee in merits. Default: 5% of proceeds, configurable.
 * Fee is logged against the FeeSink account so totals still reconcile.
 */
export interface WithdrawFeeOpts {
  proceedsMerits: number;
  feeRatePct?: number;
}

export function computeWithdrawalFee({
  proceedsMerits,
  feeRatePct = 5,
}: WithdrawFeeOpts): number {
  if (proceedsMerits < 0) throw new Error('proceedsMerits must be non-negative');
  if (feeRatePct < 0 || feeRatePct > 100) throw new Error('feeRatePct out of range');
  return Math.floor((proceedsMerits * feeRatePct) / 100);
}
