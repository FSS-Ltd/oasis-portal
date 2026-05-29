import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface StatCardProps extends HTMLAttributes<HTMLDivElement> {
  accent: string;
  icon?: ReactNode;
  label: ReactNode;
  sub?: ReactNode;
  value: ReactNode;
}

export function StatCard({ accent, className, icon, label, style, sub, value, ...props }: StatCardProps) {
  return (
    <div
      className={cn('panel panel__body stat-card', icon ? 'stat-card--with-icon' : null, className)}
      style={{ '--accent': accent, ...style } as CSSProperties}
      {...props}
    >
      {icon ? <span className="stat-card__icon">{icon}</span> : null}
      <div className="stat-card__copy">
        <p className="stat-card__label">{label}</p>
        <p className="stat-card__value">{value}</p>
        {sub ? <p className="stat-card__sub">{sub}</p> : null}
      </div>
    </div>
  );
}
