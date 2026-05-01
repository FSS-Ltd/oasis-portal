import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  children?: ReactNode;
  className?: string;
  detail?: ReactNode;
  title?: ReactNode;
}

export function EmptyState({ children, className, detail, title }: EmptyStateProps) {
  if (children) {
    return <div className={cn('empty-state', className)}>{children}</div>;
  }

  return (
    <div className={cn('empty-state', className)}>
      {title ? <strong>{title}</strong> : null}
      {detail ? <span>{detail}</span> : null}
    </div>
  );
}
