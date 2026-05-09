'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, CalendarDays, ClipboardList, Home, MessageSquare, UserRound } from 'lucide-react';

const navItems = [
  { href: '/parent', label: 'Children', icon: Home },
  { href: '/parent/calendar', label: 'Calendar', icon: CalendarDays },
  { href: '/parent/profile', label: 'My Profile', icon: UserRound },
  { href: '/parent/registration', label: 'Registration', icon: ClipboardList },
  { href: '/parent/messages', label: 'Messages', icon: MessageSquare },
  { href: '/parent/noticeboard', label: 'Noticeboard', icon: Bell },
] as const;

function isActiveRoute(pathname: string, href: string, label: string) {
  return label === 'Children'
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);
}

function countBadge(count: number): string | null {
  if (count <= 0) return null;
  return count > 99 ? '99+' : String(count);
}

interface ParentNavProps {
  unreadMessageCount: number;
  unreadNoticeCount: number;
}

export function ParentSidebarNav({ unreadMessageCount, unreadNoticeCount }: ParentNavProps) {
  const pathname = usePathname();

  return (
    <nav className="admin-shell__nav">
      {navItems.map((item) => {
        const Icon = item.icon;
        const active = isActiveRoute(pathname, item.href, item.label);
        const badge =
          item.label === 'Noticeboard'
            ? countBadge(unreadNoticeCount)
            : item.label === 'Messages'
              ? countBadge(unreadMessageCount)
              : null;
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

export function ParentBottomNav({ unreadMessageCount, unreadNoticeCount }: ParentNavProps) {
  const pathname = usePathname();

  return (
    <nav aria-label="Mobile parent sections" className="admin-shell__bottom-nav">
      {navItems.map((item) => {
        const Icon = item.icon;
        const active = isActiveRoute(pathname, item.href, item.label);
        const badge =
          item.label === 'Noticeboard'
            ? countBadge(unreadNoticeCount)
            : item.label === 'Messages'
              ? countBadge(unreadMessageCount)
              : null;
        const className = ['admin-shell__bottom-item', active ? 'is-active' : undefined]
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
