'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BookOpenCheck,
  Bell,
  CalendarCheck,
  CalendarDays,
  ClipboardList,
  Home,
  Star,
  UsersRound,
} from 'lucide-react';

const navItems = [
  { href: '/supervisor', label: 'Dashboard', icon: Home, enabled: true },
  { href: '/supervisor/children', label: 'My Children', icon: UsersRound, enabled: true },
  { href: '/supervisor/attendance', label: 'Attendance', icon: CalendarCheck, enabled: true },
  { href: '/supervisor/behaviour', label: 'Behaviour', icon: Star, enabled: true },
  { href: '/supervisor/pace', label: 'PACE', icon: BookOpenCheck, enabled: true },
  { href: '/supervisor/rota', label: 'Rota', icon: CalendarDays, enabled: true },
  { href: '/supervisor/noticeboard', label: 'Noticeboard', icon: Bell, enabled: true },
  { href: '/supervisor/snapshot', label: 'Snapshot', icon: ClipboardList, enabled: true },
] as const;

type SupervisorNavProps = {
  hasLinkedChildren: boolean;
  unreadNoticeCount: number;
};

function isActiveRoute(pathname: string, href: string, label: string) {
  return label === 'Dashboard'
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);
}

function badgeForItem(item: (typeof navItems)[number], unreadNoticeCount: number): string | null {
  if (item.label !== 'Noticeboard' || unreadNoticeCount <= 0) return null;
  return unreadNoticeCount > 99 ? '99+' : String(unreadNoticeCount);
}

export function SupervisorSidebarNav({ hasLinkedChildren, unreadNoticeCount }: SupervisorNavProps) {
  const pathname = usePathname();
  const visibleNavItems = navItems.filter(
    (item) => item.label !== 'My Children' || hasLinkedChildren,
  );

  return (
    <nav className="admin-shell__nav">
      {visibleNavItems.map((item) => {
        const Icon = item.icon;
        const active = isActiveRoute(pathname, item.href, item.label);
        const badge = badgeForItem(item, unreadNoticeCount);
        const className = ['admin-shell__nav-item', active ? 'is-active' : undefined]
          .filter(Boolean)
          .join(' ');

        return (
          <Link
            aria-current={active ? 'page' : undefined}
            className={className}
            href={{ pathname: item.href }}
            key={item.label}
          >
            <Icon aria-hidden="true" size={18} />
            <span>{item.label}</span>
            {badge ? <b>{badge}</b> : null}
          </Link>
        );
      })}
    </nav>
  );
}

export function SupervisorBottomNav({ hasLinkedChildren, unreadNoticeCount }: SupervisorNavProps) {
  const pathname = usePathname();
  const visibleNavItems = navItems.filter(
    (item) => item.label !== 'My Children' || hasLinkedChildren,
  );

  return (
    <nav aria-label="Mobile supervisor sections" className="admin-shell__bottom-nav">
      {visibleNavItems.slice(0, 5).map((item) => {
        const Icon = item.icon;
        const active = isActiveRoute(pathname, item.href, item.label);
        const badge = badgeForItem(item, unreadNoticeCount);
        const className = ['admin-shell__bottom-item', active ? 'is-active' : undefined]
          .filter(Boolean)
          .join(' ');

        return (
          <Link
            aria-current={active ? 'page' : undefined}
            aria-disabled={!item.enabled}
            className={className}
            href={{ pathname: item.href }}
            key={item.label}
          >
            <Icon aria-hidden="true" size={18} />
            <span>{item.label}</span>
            {badge ? <b>{badge}</b> : null}
          </Link>
        );
      })}
    </nav>
  );
}
