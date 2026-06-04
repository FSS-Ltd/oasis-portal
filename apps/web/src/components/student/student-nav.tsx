'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BookOpenCheck,
  BookOpenText,
  CalendarCheck,
  Bell,
  Home,
  Medal,
  ShoppingBag,
  UsersRound,
  Wallet,
} from 'lucide-react';
import { api } from '@/lib/trpc';

const studentNavItems = [
  { href: '/student', label: 'Home', icon: Home },
  { href: '/student/notifications', label: 'Updates', icon: Bell, badge: true },
  { href: '/student/wallet', label: 'Wallet', icon: Wallet },
  { href: '/student/pace', label: 'PACE', icon: BookOpenCheck },
  { href: '/student/attendance', label: 'Attendance', icon: CalendarCheck },
  { href: '/student/clubs', label: 'Clubs', icon: UsersRound },
  { href: '/student/faith', label: 'Faith', icon: BookOpenText },
  { href: '/student/ranks', label: 'Ranks', icon: Medal },
  { href: '/student/shop', label: 'Shop', icon: ShoppingBag },
] as const;

const navIconSize = 16;

function isActiveRoute(pathname: string, href: string) {
  return href === '/student'
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);
}

function countBadge(count: number | undefined): string | null {
  if (!count || count <= 0) return null;
  return count > 99 ? '99+' : String(count);
}

function useStudentNotificationBadge(): string | null {
  const unread = api.studentNotification.unreadCount.useQuery(undefined, { retry: false });
  return countBadge(unread.data?.count);
}

function badgeForItem(item: (typeof studentNavItems)[number], unreadBadge: string | null) {
  return 'badge' in item ? unreadBadge : null;
}

export function StudentTopNav() {
  const pathname = usePathname() ?? '';
  const unreadBadge = useStudentNotificationBadge();

  return (
    <nav aria-label="Student portal sections" className="student-top-nav">
      {studentNavItems.map((item) => {
        const active = isActiveRoute(pathname, item.href);
        const Icon = item.icon;
        const badge = badgeForItem(item, unreadBadge);

        return (
          <Link
            aria-current={active ? 'page' : undefined}
            className={active ? 'student-top-nav__item is-active' : 'student-top-nav__item'}
            href={{ pathname: item.href }}
            key={item.href}
          >
            <Icon aria-hidden="true" size={navIconSize} />
            <span>{item.label}</span>
            {badge ? <b>{badge}</b> : null}
          </Link>
        );
      })}
    </nav>
  );
}

export function StudentSidebarNav() {
  const pathname = usePathname() ?? '';
  const unreadBadge = useStudentNotificationBadge();

  return (
    <nav className="admin-shell__nav">
      {studentNavItems.map((item) => {
        const Icon = item.icon;
        const active = isActiveRoute(pathname, item.href);
        const badge = badgeForItem(item, unreadBadge);
        const className = ['admin-shell__nav-item', active ? 'is-active' : undefined]
          .filter(Boolean)
          .join(' ');

        return (
          <Link
            aria-current={active ? 'page' : undefined}
            className={className}
            href={{ pathname: item.href }}
            key={item.href}
          >
            <Icon aria-hidden="true" size={navIconSize} />
            <span>{item.label}</span>
            {badge ? <b>{badge}</b> : null}
          </Link>
        );
      })}
    </nav>
  );
}

export function StudentBottomNav() {
  const pathname = usePathname() ?? '';
  const unreadBadge = useStudentNotificationBadge();

  return (
    <nav aria-label="Mobile student sections" className="admin-shell__bottom-nav">
      {studentNavItems.map((item) => {
        const Icon = item.icon;
        const active = isActiveRoute(pathname, item.href);
        const badge = badgeForItem(item, unreadBadge);
        const className = ['admin-shell__bottom-item', active ? 'is-active' : undefined]
          .filter(Boolean)
          .join(' ');

        return (
          <Link
            aria-current={active ? 'page' : undefined}
            className={className}
            href={{ pathname: item.href }}
            key={item.href}
          >
            <Icon aria-hidden="true" size={navIconSize} />
            <span>{item.label}</span>
            {badge ? <b>{badge}</b> : null}
          </Link>
        );
      })}
    </nav>
  );
}
