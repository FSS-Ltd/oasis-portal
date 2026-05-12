import type { ReactNode } from 'react';
import { formatShortDate, scoreTone } from './snapshot-utils';

export function AttendanceRing({
  absent,
  late,
  present,
}: {
  absent: number;
  late: number;
  present: number;
}) {
  const total = Math.max(1, absent + late + present);
  const presentDeg = (present / total) * 360;
  const lateDeg = presentDeg + (late / total) * 360;
  return (
    <div
      className="snapshot-attendance-ring"
      style={{
        background: `conic-gradient(#166534 0deg ${String(presentDeg)}deg, #92400e ${String(presentDeg)}deg ${String(lateDeg)}deg, #991b1b ${String(lateDeg)}deg 360deg)`,
      }}
    >
      <span>
        <strong>{total === 1 && present + late + absent === 0 ? 0 : total}</strong>
        days
      </span>
    </div>
  );
}

export function LegendRow({
  label,
  tone,
  value,
}: {
  label: string;
  tone: 'amber' | 'green' | 'red';
  value: number;
}) {
  return (
    <div className={`snapshot-legend-row is-${tone}`}>
      <span />
      <p>{label}</p>
      <strong>{value}</strong>
    </div>
  );
}

export function SnapshotStatCard({
  accent,
  label,
  sub,
  value,
}: {
  accent: 'amber' | 'blue' | 'green' | 'red';
  label: string;
  sub: string;
  value: string;
}) {
  return (
    <section className={`panel panel__body snapshot-stat-card is-${accent}`}>
      <h3>{label}</h3>
      <strong>{value}</strong>
      <p>{sub}</p>
    </section>
  );
}

export function MeritSparkline({
  entries,
}: {
  entries: Array<{ createdAt: Date | string; meritDelta: number }>;
}) {
  const buckets = new Map<string, number>();
  for (const entry of entries) {
    if (entry.meritDelta === 0) continue;
    const key = formatShortDate(entry.createdAt);
    buckets.set(key, (buckets.get(key) ?? 0) + entry.meritDelta);
  }
  const rows = [...buckets.entries()].slice(-7);
  const max = Math.max(5, ...rows.map(([, value]) => Math.abs(value)));
  return (
    <div className="snapshot-sparkline">
      {rows.length === 0 ? <span>No behaviour activity in this range.</span> : null}
      {rows.map(([label, value]) => (
        <div key={label}>
          <i
            className={value >= 0 ? 'is-positive' : 'is-negative'}
            style={{ height: `${String(Math.max(12, (Math.abs(value) / max) * 64))}px` }}
          />
          <span>{label.split(' ')[0]}</span>
        </div>
      ))}
    </div>
  );
}

export function SummaryTotal({
  label,
  tone,
  value,
}: {
  label: string;
  tone: 'blue' | 'green' | 'navy' | 'red';
  value: string;
}) {
  return (
    <div className={`snapshot-summary-total is-${tone}`}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

export function SnapshotBadge({
  children,
  tone,
}: {
  children: ReactNode;
  tone: 'amber' | 'blue' | 'green' | 'red';
}) {
  return <span className={`snapshot-badge is-${tone}`}>{children}</span>;
}

export function EmptyCard({ children }: { children: ReactNode }) {
  return (
    <div className="panel panel__body snapshot-empty-card">
      <p>{children}</p>
    </div>
  );
}

export function ScoreDonut({ score }: { score: number }) {
  return (
    <div className={`snapshot-score-donut is-${scoreTone(score)}`}>
      <svg viewBox="0 0 64 64">
        <circle cx="32" cy="32" r="26" />
        <circle
          cx="32"
          cy="32"
          r="26"
          style={{ strokeDasharray: `${String((score / 100) * 163.4)} 163.4` }}
        />
      </svg>
      <strong>{score}</strong>
    </div>
  );
}
