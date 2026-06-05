export type InstrumentType = 'etf' | 'stock';

export type RangeId = '1D' | '1W' | '1M' | '3M' | '1Y' | 'ALL';

export interface CustomRange {
  from: Date;
  to: Date;
}

export interface Instrument {
  ticker: string;
  name: string;
  type: InstrumentType;
  sector: string;
  price: number;
  prevClose: number;
  dayChange: number;
  dayChangePct: number;
  volatility: number;
  color: string;
  about: string;
  daily: readonly number[];
  intraday: readonly number[];
}

export interface Holding {
  ticker: string;
  units: number;
  avgCost: number;
}

export type TransactionKind = 'award' | 'buy' | 'dividend' | 'sell' | 'withdraw';

export interface InvestmentTransaction {
  id: number;
  kind: TransactionKind;
  ticker: string | null;
  units: number;
  merits: number;
  date: string;
  note: string;
}

export interface ChartPoint {
  x: number;
  value: number;
  date: Date;
}

export interface ChartSeries {
  points: readonly ChartPoint[];
  first: number;
  last: number;
}

export interface RangeOption {
  id: RangeId;
  label: string;
  days: number;
}

interface RawInstrument {
  ticker: string;
  name: string;
  type: InstrumentType;
  sector: string;
  price: number;
  drift: number;
  volatility: number;
  color: string;
  about: string;
}

export const today = new Date(2026, 5, 4);
export const historyDays = 400;
export const meritGbp = 10;
export const spendWalletBalance = 238;
export const withdrawFeePct = 5;
export const capitalGainsTaxPct = 15;

const msDay = 86_400_000;

export const rangeOptions: readonly RangeOption[] = [
  { id: '1D', label: '1D', days: 1 },
  { id: '1W', label: '1W', days: 7 },
  { id: '1M', label: '1M', days: 30 },
  { id: '3M', label: '3M', days: 90 },
  { id: '1Y', label: '1Y', days: 365 },
  { id: 'ALL', label: 'All', days: historyDays },
];

export const studentInvestor = {
  name: 'Grace Williams',
  firstName: 'Grace',
  initials: 'GW',
  year: 'Y8',
  tutor: 'Mrs Thompson',
  color: '#7d3c98',
} as const;

const rawInstruments: readonly RawInstrument[] = [
  {
    ticker: 'VUSA',
    name: 'Vanguard S&P 500',
    type: 'etf',
    sector: 'US Large-Cap',
    price: 71.2,
    drift: 0.0006,
    volatility: 0.009,
    color: '#2e5e8c',
    about:
      'Tracks the 500 biggest companies in the United States in one basket, giving instant spread across technology, banks, healthcare, and consumer brands.',
  },
  {
    ticker: 'VWRL',
    name: 'FTSE All-World',
    type: 'etf',
    sector: 'Global',
    price: 105.8,
    drift: 0.0005,
    volatility: 0.008,
    color: '#1a7a4a',
    about:
      'A single fund holding thousands of companies from around the world. It is the broadest option in this mock market.',
  },
  {
    ticker: 'EQQQ',
    name: 'Nasdaq 100',
    type: 'etf',
    sector: 'US Tech',
    price: 342,
    drift: 0.0008,
    volatility: 0.013,
    color: '#4338ca',
    about:
      'The 100 largest non-financial companies on the Nasdaq. It leans heavily toward technology, with higher growth and higher swings.',
  },
  {
    ticker: 'VUKE',
    name: 'FTSE 100',
    type: 'etf',
    sector: 'UK Large-Cap',
    price: 36.4,
    drift: 0.0003,
    volatility: 0.007,
    color: '#7d1c2c',
    about:
      "Britain's 100 biggest listed companies, including banks, energy businesses, miners, and familiar high-street names.",
  },
  {
    ticker: 'INRG',
    name: 'Global Clean Energy',
    type: 'etf',
    sector: 'Clean Energy',
    price: 8.9,
    drift: 0.0004,
    volatility: 0.018,
    color: '#0e9f6e',
    about:
      'A themed fund of solar, wind, and renewable-energy companies worldwide. The theme can move sharply, so it carries more risk.',
  },
  {
    ticker: 'SGLN',
    name: 'Physical Gold',
    type: 'etf',
    sector: 'Commodity',
    price: 42.1,
    drift: 0.0004,
    volatility: 0.008,
    color: '#b8860b',
    about:
      'Backed by physical gold. It can help balance a portfolio when shares are falling, though it can still move down.',
  },
  {
    ticker: 'AAPL',
    name: 'Apple',
    type: 'stock',
    sector: 'Technology',
    price: 172.4,
    drift: 0.0007,
    volatility: 0.014,
    color: '#555b61',
    about: 'Maker of the iPhone, Mac, and iPad. One of the most valuable companies in the world.',
  },
  {
    ticker: 'MSFT',
    name: 'Microsoft',
    type: 'stock',
    sector: 'Technology',
    price: 338.9,
    drift: 0.0008,
    volatility: 0.013,
    color: '#2e7d32',
    about: 'Windows, Office, Xbox, and Azure. A giant of business and consumer software.',
  },
  {
    ticker: 'NVDA',
    name: 'Nvidia',
    type: 'stock',
    sector: 'Technology',
    price: 108.3,
    drift: 0.0013,
    volatility: 0.024,
    color: '#1a7a4a',
    about:
      'Designs chips used for video games and artificial intelligence. Fast-growing and famously volatile.',
  },
  {
    ticker: 'GOOGL',
    name: 'Alphabet',
    type: 'stock',
    sector: 'Technology',
    price: 162.1,
    drift: 0.0007,
    volatility: 0.015,
    color: '#4285f4',
    about: 'The parent company of Google, YouTube, Android, and other internet businesses.',
  },
  {
    ticker: 'AMZN',
    name: 'Amazon',
    type: 'stock',
    sector: 'Consumer',
    price: 183.2,
    drift: 0.0008,
    volatility: 0.016,
    color: '#e47911',
    about: 'The online shopping giant, also a leader in cloud computing and streaming.',
  },
  {
    ticker: 'TSLA',
    name: 'Tesla',
    type: 'stock',
    sector: 'Automotive',
    price: 214.6,
    drift: 0.0006,
    volatility: 0.03,
    color: '#c0392b',
    about: 'Electric cars, batteries, and solar. One of the most talked-about and volatile stocks.',
  },
  {
    ticker: 'DIS',
    name: 'Walt Disney',
    type: 'stock',
    sector: 'Media',
    price: 98.7,
    drift: 0.0004,
    volatility: 0.015,
    color: '#2e5e8c',
    about: 'Films, theme parks, Disney+, and ESPN. A long-running entertainment business.',
  },
  {
    ticker: 'NKE',
    name: 'Nike',
    type: 'stock',
    sector: 'Consumer',
    price: 74.3,
    drift: 0.0003,
    volatility: 0.016,
    color: '#6b4c0a',
    about: 'The sportswear brand behind trainers, kit, and the famous swoosh.',
  },
  {
    ticker: 'KO',
    name: 'Coca-Cola',
    type: 'stock',
    sector: 'Consumer',
    price: 58.4,
    drift: 0.0003,
    volatility: 0.006,
    color: '#9b2235',
    about: 'The drinks company behind Coca-Cola, Fanta, and Sprite. Known for steadier returns.',
  },
  {
    ticker: 'SBUX',
    name: 'Starbucks',
    type: 'stock',
    sector: 'Consumer',
    price: 82.1,
    drift: 0.0004,
    volatility: 0.013,
    color: '#1a7a4a',
    about: 'The global coffee-shop chain with stores in towns and cities around the world.',
  },
];

export const initialHoldings: readonly Holding[] = [
  { ticker: 'VUSA', units: 8.1, avgCost: 64.8 },
  { ticker: 'EQQQ', units: 1.05, avgCost: 298.4 },
  { ticker: 'AAPL', units: 1.6, avgCost: 151.2 },
  { ticker: 'MSFT', units: 0.62, avgCost: 305.1 },
  { ticker: 'NVDA', units: 3.2, avgCost: 79.5 },
  { ticker: 'INRG', units: 9.5, avgCost: 9.85 },
  { ticker: 'DIS', units: 1.4, avgCost: 104.2 },
  { ticker: 'NKE', units: 1.8, avgCost: 82.6 },
];

export const initialCashMerits = 18.5;

export const initialTransactions: readonly InvestmentTransaction[] = [
  {
    id: 1,
    kind: 'buy',
    ticker: 'VUSA',
    units: 1.2,
    merits: 8.5,
    date: '28 May 2026',
    note: 'Recurring weekly invest',
  },
  {
    id: 2,
    kind: 'award',
    ticker: null,
    units: 0,
    merits: 15,
    date: '26 May 2026',
    note: 'Scripture Memory merit to Investment',
  },
  {
    id: 3,
    kind: 'sell',
    ticker: 'TSLA',
    units: 0.4,
    merits: 8.6,
    date: '21 May 2026',
    note: 'Trimmed a volatile holding',
  },
  { id: 4, kind: 'buy', ticker: 'NVDA', units: 0.8, merits: 8.4, date: '19 May 2026', note: '' },
  {
    id: 5,
    kind: 'dividend',
    ticker: 'KO',
    units: 0,
    merits: 0.6,
    date: '15 May 2026',
    note: 'Quarterly dividend',
  },
  { id: 6, kind: 'buy', ticker: 'INRG', units: 4.5, merits: 4, date: '12 May 2026', note: '' },
  {
    id: 7,
    kind: 'withdraw',
    ticker: null,
    units: 0,
    merits: -12,
    date: '8 May 2026',
    note: 'To Spend wallet',
  },
  { id: 8, kind: 'buy', ticker: 'AAPL', units: 0.6, merits: 9.5, date: '2 May 2026', note: '' },
  {
    id: 9,
    kind: 'award',
    ticker: null,
    units: 0,
    merits: 10,
    date: '28 Apr 2026',
    note: 'Academic Excellence merit to Investment',
  },
  { id: 10, kind: 'buy', ticker: 'EQQQ', units: 0.3, merits: 9.6, date: '21 Apr 2026', note: '' },
  {
    id: 11,
    kind: 'dividend',
    ticker: 'VUSA',
    units: 0,
    merits: 1.1,
    date: '15 Apr 2026',
    note: 'Fund distribution',
  },
  { id: 12, kind: 'sell', ticker: 'DIS', units: 0.3, merits: 2.9, date: '9 Apr 2026', note: '' },
];

function hashString(value: string): number {
  let hash = 1_779_033_703 ^ value.length;
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 3_432_913_533);
    hash = (hash << 13) | (hash >>> 19);
  }
  return hash >>> 0;
}

function seededRandom(seed: number): () => number {
  return () => {
    let nextSeed = seed;
    nextSeed = (nextSeed + 0x6d2b79f5) | 0;
    let t = Math.imul(nextSeed ^ (nextSeed >>> 15), 1 | nextSeed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    seed = nextSeed;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function buildSeries(
  ticker: string,
  price: number,
  drift: number,
  volatility: number,
): readonly number[] {
  const random = seededRandom(hashString(ticker));
  const raw = [100];
  for (let index = 1; index < historyDays; index += 1) {
    const shock = (random() - 0.5) * 2 * volatility;
    const wobble = Math.sin(index / 22 + (hashString(ticker) % 7)) * volatility * 0.4;
    const previous = raw[index - 1] ?? 100;
    const next = previous * (1 + drift + shock + wobble * 0.04);
    raw.push(next < 5 ? 5 + random() * 3 : next);
  }
  const scale = price / (raw[raw.length - 1] ?? price);
  return raw.map((value) => Number((value * scale).toFixed(2)));
}

function buildIntraday(ticker: string, prevClose: number, price: number): readonly number[] {
  const random = seededRandom(hashString(`${ticker}intraday`));
  const points = 32;
  const output: number[] = [];
  for (let index = 0; index < points; index += 1) {
    const progress = index / (points - 1);
    const base = prevClose + (price - prevClose) * progress;
    const noise =
      (random() - 0.5) * Math.abs(price - prevClose || price * 0.01) * 1.3 * (1 - progress * 0.5);
    output.push(Number((base + noise).toFixed(2)));
  }
  output[0] = prevClose;
  output[points - 1] = price;
  return output;
}

export const instruments: readonly Instrument[] = rawInstruments.map((item) => {
  const daily = buildSeries(item.ticker, item.price, item.drift, item.volatility);
  const prevClose = daily[daily.length - 2] ?? item.price;
  const intraday = buildIntraday(item.ticker, prevClose, item.price);
  return {
    ticker: item.ticker,
    name: item.name,
    type: item.type,
    sector: item.sector,
    price: item.price,
    prevClose,
    dayChange: item.price - prevClose,
    dayChangePct: ((item.price - prevClose) / prevClose) * 100,
    volatility: item.volatility,
    color: item.color,
    about: item.about,
    daily,
    intraday,
  };
});

export const instrumentsByTicker = new Map(
  instruments.map((instrument) => [instrument.ticker, instrument]),
);

export function dayDate(index: number, days = historyDays): Date {
  return new Date(today.getTime() - (days - 1 - index) * msDay);
}

export function toMerits(gbp: number): number {
  return gbp / meritGbp;
}

export function toGbp(merits: number): number {
  return merits * meritGbp;
}

export function instrumentForTicker(ticker: string): Instrument {
  const instrument = instrumentsByTicker.get(ticker);
  if (!instrument) {
    throw new Error(`Unknown investment ticker: ${ticker}`);
  }
  return instrument;
}

export function holdingValueMerits(holding: Holding): number {
  return toMerits(holding.units * instrumentForTicker(holding.ticker).price);
}

export function holdingCostMerits(holding: Holding): number {
  return toMerits(holding.units * holding.avgCost);
}

export function holdingsValueMerits(holdings: readonly Holding[]): number {
  return holdings.reduce((total, holding) => total + holdingValueMerits(holding), 0);
}

export function holdingsCostMerits(holdings: readonly Holding[]): number {
  return holdings.reduce((total, holding) => total + holdingCostMerits(holding), 0);
}

export function netWorthMerits(holdings: readonly Holding[], cashMerits: number): number {
  return holdingsValueMerits(holdings) + cashMerits;
}

export function holdingDayProfitLoss(holding: Holding): number {
  const instrument = instrumentForTicker(holding.ticker);
  return toMerits(holding.units * (instrument.price - instrument.prevClose));
}

export function sliceInstrumentSeries(
  instrument: Instrument,
  rangeId: RangeId,
  customRange: CustomRange | null,
): ChartSeries {
  if (rangeId === '1D' && !customRange) {
    const points = instrument.intraday.map((value, index) => ({
      x: index / (instrument.intraday.length - 1),
      value,
      date: today,
    }));
    const first = points[0]?.value ?? instrument.price;
    const last = points[points.length - 1]?.value ?? instrument.price;
    return { points, first, last };
  }

  const { startIndex, endIndex } = seriesIndexes(rangeId, customRange);
  const segment = instrument.daily.slice(startIndex, endIndex + 1);
  const points = segment.map((value, index) => ({
    x: index / (segment.length - 1 || 1),
    value,
    date: dayDate(startIndex + index),
  }));
  return {
    points,
    first: segment[0] ?? instrument.price,
    last: segment[segment.length - 1] ?? instrument.price,
  };
}

export function portfolioSeries(
  holdings: readonly Holding[],
  cashMerits: number,
  rangeId: RangeId,
  customRange: CustomRange | null,
): ChartSeries {
  const liveHoldings = holdings.filter((holding) => holding.units > 0.000001);
  if (rangeId === '1D' && !customRange) {
    const points = Array.from({ length: 32 }, (_, index) => {
      const gbp = liveHoldings.reduce(
        (total, holding) =>
          total +
          holding.units *
            (instrumentForTicker(holding.ticker).intraday[index] ??
              instrumentForTicker(holding.ticker).price),
        0,
      );
      return {
        x: index / 31,
        value: cashMerits + toMerits(gbp),
        date: today,
      };
    });
    return {
      points,
      first: points[0]?.value ?? cashMerits,
      last: points[points.length - 1]?.value ?? cashMerits,
    };
  }

  const { startIndex, endIndex } = seriesIndexes(rangeId, customRange);
  const points: ChartPoint[] = [];
  for (let index = startIndex; index <= endIndex; index += 1) {
    const gbp = liveHoldings.reduce(
      (total, holding) =>
        total +
        holding.units *
          (instrumentForTicker(holding.ticker).daily[index] ??
            instrumentForTicker(holding.ticker).price),
      0,
    );
    points.push({
      x: (index - startIndex) / (endIndex - startIndex || 1),
      value: cashMerits + toMerits(gbp),
      date: dayDate(index),
    });
  }
  return {
    points,
    first: points[0]?.value ?? cashMerits,
    last: points[points.length - 1]?.value ?? cashMerits,
  };
}

function seriesIndexes(
  rangeId: RangeId,
  customRange: CustomRange | null,
): { startIndex: number; endIndex: number } {
  if (customRange) {
    const fromOffset = Math.round((today.getTime() - customRange.from.getTime()) / msDay);
    const toOffset = Math.round((today.getTime() - customRange.to.getTime()) / msDay);
    const startIndex = Math.max(0, historyDays - 1 - fromOffset);
    const endIndex = Math.max(
      startIndex + 1,
      Math.min(historyDays - 1, historyDays - 1 - toOffset),
    );
    return { startIndex, endIndex };
  }

  const range = rangeOptions.find((option) => option.id === rangeId) ?? {
    days: 30,
    id: '1M',
    label: '1M',
  };
  return {
    startIndex: Math.max(0, historyDays - 1 - range.days),
    endIndex: historyDays - 1,
  };
}

export function riskBand(volatility: number): {
  label: string;
  level: 1 | 2 | 3;
  tone: 'amber' | 'green' | 'red';
} {
  if (volatility <= 0.008) return { label: 'Lower risk', level: 1, tone: 'green' };
  if (volatility <= 0.015) return { label: 'Medium risk', level: 2, tone: 'amber' };
  return { label: 'Higher risk', level: 3, tone: 'red' };
}

export function formatMerits(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return '-';
  const absolute = Math.abs(value);
  const maximumFractionDigits = absolute >= 1000 ? 0 : digits;
  return new Intl.NumberFormat('en-GB', {
    minimumFractionDigits: maximumFractionDigits,
    maximumFractionDigits,
  }).format(value);
}

export function formatSignedMerits(value: number, digits = 1): string {
  return `${value >= 0 ? '+' : '-'}${formatMerits(Math.abs(value), digits)}`;
}

export function formatPercent(value: number, digits = 2): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(digits)}%`;
}

export function formatGbp(value: number): string {
  return new Intl.NumberFormat('en-GB', {
    currency: 'GBP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    style: 'currency',
  }).format(value);
}

export function formatDate(value: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(value);
}

export function formatShortDate(value: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
  }).format(value);
}

export function formatDateInput(value: Date): string {
  return value.toISOString().slice(0, 10);
}
