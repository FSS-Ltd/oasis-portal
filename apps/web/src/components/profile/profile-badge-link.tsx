'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import type { Route } from 'next';
import { api } from '@/lib/trpc';
import { roleLabel } from '@/lib/profile-display';
import { cn } from '@/lib/utils';
import { Avatar } from '@/components/ui/avatar';

interface ProfileBadgeLinkProps {
  className?: string;
  href: Route;
  variant?: 'mobile' | 'sidebar' | 'topbar';
}

export function ProfileBadgeLink({ className, href, variant = 'sidebar' }: ProfileBadgeLinkProps) {
  const pathname = usePathname() ?? '';
  const profileQuery = api.profile.me.useQuery(undefined, { retry: false });
  const profile = profileQuery.data;
  const active = pathname === href;
  const name = profile?.fullName ?? 'My Profile';
  const subtitle = profile ? `${roleLabel(profile.role)} · My Profile` : 'My Profile';

  return (
    <Link
      aria-label={variant === 'mobile' ? `${name} profile` : undefined}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'profile-badge',
        active ? 'is-active' : undefined,
        variant === 'mobile' ? 'profile-badge--mobile' : undefined,
        variant === 'topbar' ? 'profile-badge--topbar' : undefined,
        className,
      )}
      href={href}
    >
      <Avatar className="profile-badge__avatar" name={name} />
      <span className="profile-badge__text">
        <strong>{name}</strong>
        {variant !== 'mobile' ? <small>{subtitle}</small> : null}
      </span>
      {variant === 'mobile' ? null : <ChevronRight aria-hidden="true" size={14} />}
    </Link>
  );
}
