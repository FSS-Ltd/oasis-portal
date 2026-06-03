'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { usePathname } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { PortalProfileHref, PortalViewLink } from '@/lib/portal-view-routing';
import { api } from '@/lib/trpc';
import { cn } from '@/lib/utils';
import { roleLabel } from '@/lib/profile-display';
import { Avatar } from '@/components/ui/avatar';

type ProfilePortalMenuVariant = 'mobile' | 'sidebar' | 'topbar';

interface ProfilePortalMenuProps {
  className?: string;
  profileHref: PortalProfileHref;
  variant?: ProfilePortalMenuVariant;
  views: readonly PortalViewLink[];
}

export function ProfilePortalMenu({
  className,
  profileHref,
  variant = 'sidebar',
  views,
}: ProfilePortalMenuProps) {
  const pathname = usePathname() ?? '';
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const profileQuery = api.profile.me.useQuery(undefined, { retry: false });
  const profile = profileQuery.data;
  const name = profile?.fullName ?? 'My Profile';
  const subtitle = profile ? `${roleLabel(profile.role)} · My Profile` : 'My Profile';
  const active = pathname === profileHref || views.some((view) => pathname === view.href);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (event.target instanceof Node && !menuRef.current?.contains(event.target)) {
        setOpen(false);
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [open]);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
    }
  }

  return (
    <div
      className={cn(
        'profile-portal-menu',
        variant === 'mobile' ? 'profile-portal-menu--mobile' : undefined,
        variant === 'topbar' ? 'profile-portal-menu--topbar' : undefined,
        className,
      )}
      onKeyDown={handleKeyDown}
      ref={menuRef}
    >
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        className={cn(
          'profile-badge',
          active ? 'is-active' : undefined,
          variant === 'mobile' ? 'profile-badge--mobile' : undefined,
          variant === 'topbar' ? 'profile-badge--topbar' : undefined,
        )}
        onClick={() => {
          setOpen((current) => !current);
        }}
        type="button"
      >
        <Avatar className="profile-badge__avatar" name={name} />
        <span className="profile-badge__text">
          <strong>{name}</strong>
          {variant !== 'mobile' ? <small>{subtitle}</small> : null}
        </span>
        {variant === 'mobile' ? null : <ChevronDown aria-hidden="true" size={14} />}
      </button>
      {open ? (
        <div className="profile-portal-menu__content" role="menu">
          <Link
            className="profile-portal-menu__item"
            href={profileHref}
            onClick={() => {
              setOpen(false);
            }}
            role="menuitem"
          >
            Open profile
          </Link>
          {views.map((view) => (
            <Link
              className="profile-portal-menu__item"
              href={view.href as Route}
              key={view.id}
              onClick={() => {
                setOpen(false);
              }}
              role="menuitem"
            >
              {view.id === 'club'
                ? 'Open club view'
                : view.id === 'parent'
                  ? 'Open parent view'
                  : 'Open supervisor view'}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
