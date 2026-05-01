import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface PanelProps extends HTMLAttributes<HTMLElement> {
  as?: 'article' | 'aside' | 'div' | 'section';
  body?: boolean;
  scroll?: boolean;
}

export function Panel({
  as: Component = 'section',
  body = false,
  className,
  scroll = false,
  ...props
}: PanelProps) {
  return (
    <Component
      className={cn('panel', body ? 'panel__body' : undefined, scroll ? 'panel--scroll' : undefined, className)}
      {...props}
    />
  );
}
