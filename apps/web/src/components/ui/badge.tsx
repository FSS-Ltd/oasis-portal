import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type BadgeTone = 'amber' | 'blue' | 'green' | 'grey' | 'red';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

export function Badge({ className, tone = 'blue', ...props }: BadgeProps) {
  return (
    <span
      className={cn('badge', tone === 'blue' ? undefined : `badge--${tone}`, className)}
      {...props}
    />
  );
}
