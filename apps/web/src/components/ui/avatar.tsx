import type { HTMLAttributes } from 'react';
import { avatarColour, getInitials } from '@/lib/display';
import { cn } from '@/lib/utils';

interface AvatarProps extends HTMLAttributes<HTMLSpanElement> {
  colour?: string;
  index?: number;
  name: string;
  palette?: readonly string[];
}

export function Avatar({ className, colour, index, name, palette, style, ...props }: AvatarProps) {
  const backgroundColor = colour ?? (index === undefined ? undefined : avatarColour(index, palette));

  return (
    <span
      aria-hidden="true"
      className={cn('avatar', className)}
      style={{ ...(backgroundColor ? { backgroundColor } : {}), ...style }}
      {...props}
    >
      {getInitials(name)}
    </span>
  );
}
