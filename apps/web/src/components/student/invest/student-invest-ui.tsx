'use client';

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { CalendarDays, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  formatDate,
  formatGbpForMerits,
  formatMerits,
  formatPercent,
  formatShortDate,
  rangeOptions,
  riskBand,
  type ChartSeries,
  type Instrument,
  type RangeId,
} from './student-invest-data';
import styles from './student-invest.module.css';

export function MeritIcon({ className, size = 16 }: { className?: string; size?: number }) {
  return (
    <svg aria-hidden="true" className={className} height={size} viewBox="0 0 24 24" width={size}>
      <circle cx="12" cy="12" fill="#b8860b" r="11" />
      <circle
        cx="12"
        cy="12"
        fill="none"
        r="11"
        stroke="rgba(255,255,255,0.45)"
        strokeWidth="1.2"
      />
      <path
        d="M12 5.6l1.78 3.9 4.22.5-3.13 2.86.85 4.18L12 14.9l-3.72 2.14.85-4.18L6 9.99l4.22-.49z"
        fill="#fff"
        fillOpacity="0.92"
      />
    </svg>
  );
}

export function MeritValue({
  colorClass,
  digits = 1,
  value,
}: {
  colorClass?: string | undefined;
  digits?: number;
  value: number;
}) {
  return (
    <span className={cn(styles.strongValue, colorClass)}>
      <MeritIcon size={14} /> {formatMerits(value, digits)}
    </span>
  );
}

export function GbpEquivalent({
  className,
  prefix = 'Approx.',
  value,
}: {
  className?: string | undefined;
  prefix?: string;
  value: number;
}) {
  if (!Number.isFinite(value)) return null;
  return (
    <span className={cn(styles.gbpEquivalent, className)}>
      {prefix} {formatGbpForMerits(value)}
    </span>
  );
}

export function MeritValueStack({
  digits = 1,
  value,
}: {
  digits?: number;
  value: number;
}) {
  return (
    <span className={styles.valueStack}>
      <MeritValue digits={digits} value={value} />
      <GbpEquivalent value={value} />
    </span>
  );
}

export function InvestmentCard({
  children,
  className,
  flush = false,
}: {
  children: ReactNode;
  className?: string | undefined;
  flush?: boolean;
}) {
  return (
    <section className={cn(styles.card, flush ? styles.cardFlush : undefined, className)}>
      {children}
    </section>
  );
}

export function InvestmentBadge({
  children,
  tone = 'blue',
}: {
  children: ReactNode;
  tone?: 'blue' | 'gold' | 'green' | 'grey' | 'red';
}) {
  return (
    <span
      className={cn(
        styles.badge,
        tone === 'gold' ? styles.badgeGold : undefined,
        tone === 'green' ? styles.badgeGreen : undefined,
        tone === 'grey' ? styles.badgeGrey : undefined,
        tone === 'red' ? styles.badgeRed : undefined,
      )}
    >
      {children}
    </span>
  );
}

export function TickerMark({ instrument, size = 42 }: { instrument: Instrument; size?: number }) {
  const letters =
    instrument.type === 'etf' ? instrument.ticker.slice(0, 2) : instrument.ticker.slice(0, 1);
  return (
    <span
      aria-hidden="true"
      className={styles.tickerMark}
      style={{
        backgroundColor: instrument.color,
        fontSize: size * (instrument.type === 'etf' ? 0.32 : 0.42),
        height: size,
        width: size,
      }}
    >
      {letters}
    </span>
  );
}

export function DeltaPill({
  arrow = true,
  plain = false,
  value,
}: {
  arrow?: boolean;
  plain?: boolean;
  value: number;
}) {
  const positive = value >= 0;
  const label = `${arrow ? (positive ? '^ ' : 'v ') : ''}${formatPercent(value)}`;
  if (plain) {
    return <span className={positive ? styles.positiveText : styles.negativeText}>{label}</span>;
  }
  return (
    <span className={cn(styles.delta, positive ? styles.positivePill : styles.negativePill)}>
      {label}
    </span>
  );
}

export function HelpTip({ label, text }: { label: string; text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span
      className={styles.infoWrap}
      onBlur={() => {
        setOpen(false);
      }}
      onFocus={() => {
        setOpen(true);
      }}
      onMouseEnter={() => {
        setOpen(true);
      }}
      onMouseLeave={() => {
        setOpen(false);
      }}
    >
      <button
        aria-label={label}
        className={styles.infoButton}
        onClick={() => {
          setOpen((current) => !current);
        }}
        type="button"
      >
        <Info aria-hidden="true" size={10} />
      </button>
      {open ? (
        <span className={styles.infoBubble} role="tooltip">
          <strong>{label}</strong>
          <br />
          {text}
        </span>
      ) : null}
    </span>
  );
}

export function RangeTabs({
  customActive = false,
  onCustom,
  onRange,
  value,
}: {
  customActive?: boolean;
  onCustom: () => void;
  onRange: (range: RangeId) => void;
  value: RangeId;
}) {
  return (
    <div aria-label="Chart date range" className={styles.rangeTabs} role="group">
      {rangeOptions.map((range) => {
        const active = value === range.id && !customActive;
        return (
          <button
            className={cn(styles.rangeButton, active ? styles.rangeButtonActive : undefined)}
            key={range.id}
            onClick={() => {
              onRange(range.id);
            }}
            type="button"
          >
            {range.label}
          </button>
        );
      })}
      <button
        className={cn(styles.rangeButton, customActive ? styles.rangeButtonActive : undefined)}
        onClick={onCustom}
        type="button"
      >
        <CalendarDays aria-hidden="true" size={13} /> Custom
      </button>
    </div>
  );
}

export function Sparkline({
  daily,
  height = 30,
  width = 88,
}: {
  daily: readonly number[];
  height?: number;
  width?: number;
}) {
  const segment = daily.slice(-30);
  const min = Math.min(...segment);
  const max = Math.max(...segment);
  const range = max - min || 1;
  const positive = (segment[segment.length - 1] ?? 0) >= (segment[0] ?? 0);
  const color = positive ? '#137a47' : '#c0392b';
  const points = segment
    .map((value, index) => {
      const x = (index / (segment.length - 1)) * width;
      const y = height - ((value - min) / range) * (height - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg
      aria-hidden="true"
      className={styles.sparkline}
      height={height}
      viewBox={`0 0 ${String(width)} ${String(height)}`}
      width={width}
    >
      <polyline
        fill="none"
        points={points}
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

export function AreaChart({
  dateFormatter,
  height = 270,
  series,
  valueFormatter = (value) => formatMerits(value, 1),
}: {
  dateFormatter?: (date: Date) => string;
  height?: number;
  series: ChartSeries;
  valueFormatter?: (value: number) => string;
}) {
  const [ref, width] = useMeasuredWidth();
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const gradientId = useId().replaceAll(':', '');
  const points = series.points;
  const values = points.map((point) => point.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const padding = (maxValue - minValue) * 0.12 || maxValue * 0.04 || 1;
  const min = minValue - padding;
  const max = maxValue + padding;
  const range = max - min || 1;
  const padTop = 16;
  const padBottom = 28;
  const plotHeight = height - padTop - padBottom;
  const plotWidth = Math.max(10, width);
  const positive = series.last >= series.first;
  const color = positive ? '#137a47' : '#c0392b';
  const xFor = useCallback((x: number) => x * plotWidth, [plotWidth]);
  const yFor = useCallback(
    (value: number) => padTop + (1 - (value - min) / range) * plotHeight,
    [min, plotHeight, range],
  );
  const linePath = points
    .map(
      (point, index) =>
        `${index === 0 ? 'M' : 'L'}${xFor(point.x).toFixed(1)},${yFor(point.value).toFixed(1)}`,
    )
    .join(' ');
  const firstPoint = points[0] ?? { date: new Date(), value: 0, x: 0 };
  const lastPoint = points[points.length - 1] ?? firstPoint;
  const areaPath = `${linePath} L${xFor(lastPoint.x).toFixed(1)},${String(
    padTop + plotHeight,
  )} L${xFor(firstPoint.x).toFixed(1)},${String(padTop + plotHeight)} Z`;
  const baselineY = yFor(series.first);
  const formatter = dateFormatter ?? formatShortDate;

  const ticks = useMemo(() => {
    const count = Math.min(5, points.length);
    return Array.from({ length: count }, (_, index) => {
      const point = points[Math.round((index / (count - 1)) * (points.length - 1))];
      return point ?? firstPoint;
    });
  }, [firstPoint, points]);

  const handleMove = useCallback(
    (clientX: number, element: SVGSVGElement) => {
      const rect = element.getBoundingClientRect();
      const fraction = Math.min(1, Math.max(0, (clientX - rect.left) / plotWidth));
      setHoverIndex(
        Math.min(points.length - 1, Math.max(0, Math.round(fraction * (points.length - 1)))),
      );
    },
    [plotWidth, points.length],
  );

  const hoverPoint = hoverIndex === null ? null : points[hoverIndex];

  return (
    <div className={styles.chartWrap} ref={ref} style={{ minHeight: height }}>
      <svg
        className={styles.chartSvg}
        height={height}
        onMouseLeave={() => {
          setHoverIndex(null);
        }}
        onMouseMove={(event) => {
          handleMove(event.clientX, event.currentTarget);
        }}
        onTouchMove={(event) => {
          const touch = event.touches[0];
          if (touch) handleMove(touch.clientX, event.currentTarget);
        }}
        viewBox={`0 0 ${String(width)} ${String(height)}`}
        width={width}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity="0.26" />
            <stop offset="0.72" stopColor={color} stopOpacity="0.05" />
            <stop offset="1" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <line
          opacity="0.45"
          stroke="#8899bb"
          strokeDasharray="4 4"
          strokeWidth="1"
          x1="0"
          x2={plotWidth}
          y1={baselineY}
          y2={baselineY}
        />
        <path d={areaPath} fill={`url(#${gradientId})`} />
        <path
          d={linePath}
          fill="none"
          stroke={color}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.4"
        />
        <circle
          cx={xFor(lastPoint.x)}
          cy={yFor(lastPoint.value)}
          fill={color}
          r="4"
          stroke="#fff"
          strokeWidth="2"
        />
        {ticks.map((point, index) => (
          <text
            fill="#8899bb"
            fontSize="10.5"
            fontWeight="700"
            key={`${point.date.toISOString()}-${String(index)}`}
            textAnchor={index === 0 ? 'start' : index === ticks.length - 1 ? 'end' : 'middle'}
            x={Math.min(plotWidth - 2, Math.max(2, xFor(point.x)))}
            y={height - 8}
          >
            {formatter(point.date)}
          </text>
        ))}
        {hoverPoint ? (
          <g>
            <line
              opacity="0.4"
              stroke={color}
              strokeWidth="1"
              x1={xFor(hoverPoint.x)}
              x2={xFor(hoverPoint.x)}
              y1={padTop}
              y2={padTop + plotHeight}
            />
            <circle
              cx={xFor(hoverPoint.x)}
              cy={yFor(hoverPoint.value)}
              fill="#fff"
              r="5"
              stroke={color}
              strokeWidth="2.5"
            />
          </g>
        ) : null}
      </svg>
      {hoverPoint ? (
        <div
          className={styles.tooltipCard}
          style={{ left: Math.min(width - 132, Math.max(0, xFor(hoverPoint.x) - 66)), top: 0 }}
        >
          <strong>
            <MeritIcon size={13} /> {valueFormatter(hoverPoint.value)}
          </strong>
          <span>{formatDate(hoverPoint.date)}</span>
        </div>
      ) : null}
    </div>
  );
}

export function RiskDots({ instrument }: { instrument: Instrument }) {
  const risk = riskBand(instrument.volatility);
  const color = risk.tone === 'green' ? '#137a47' : risk.tone === 'amber' ? '#d99100' : '#c0392b';
  return (
    <span className={styles.riskDots}>
      <span aria-hidden="true">
        {[0, 1, 2].map((index) => (
          <span
            className={styles.riskDot}
            key={index}
            style={{ backgroundColor: index < risk.level ? color : undefined }}
          />
        ))}
      </span>
      <span style={{ color }}>{risk.label}</span>
    </span>
  );
}

export function LearningBadge({
  rawPct,
  learningPct,
}: {
  rawPct: number;
  learningPct: number;
}) {
  const rawPositive = rawPct >= 0;
  const learningPositive = learningPct >= 0;
  return (
    <span className={styles.learningBadge}>
      <span
        className={cn(
          styles.learningBadgeItem,
          rawPositive ? styles.positivePill : styles.negativePill,
        )}
      >
        <span className={styles.learningBadgeLabel}>Mkt</span>
        {formatPercent(rawPct)}
      </span>
      <span
        className={cn(
          styles.learningBadgeItem,
          learningPositive ? styles.positivePill : styles.negativePill,
        )}
        title="Learning view: returns amplified ×10 (capped at ±8% daily) for educational effect"
      >
        <span className={styles.learningBadgeLabel}>Learning</span>
        {formatPercent(learningPct)}
      </span>
    </span>
  );
}

function useMeasuredWidth(): [RefObject<HTMLDivElement>, number] {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);

  useEffect(() => {
    if (!ref.current) return undefined;
    const observer = new ResizeObserver((entries) => {
      const measured = entries[0]?.contentRect.width;
      if (measured && measured > 0) setWidth(measured);
    });
    observer.observe(ref.current);
    return () => {
      observer.disconnect();
    };
  }, []);

  return [ref, width];
}
