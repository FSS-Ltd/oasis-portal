'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BookOpenCheck,
  Bell,
  CalendarCheck,
  CalendarDays,
  Club,
  ClipboardList,
  FileText,
  Home,
  MessageSquare,
  ShoppingBag,
  Star,
  UsersRound,
} from 'lucide-react';

const navItems = [
  { href: '/supervisor', label: 'Dashboard', icon: Home, enabled: true },
  { href: '/admin/clubs', label: 'Club Admin', icon: Club, enabled: true },
  { href: '/supervisor/children', label: 'My Children', icon: UsersRound, enabled: true },
  { href: '/supervisor/clubs', label: 'Clubs', icon: Club, enabled: true },
  { href: '/supervisor/attendance', label: 'Attendance', icon: CalendarCheck, enabled: true },
  { href: '/supervisor/behaviour', label: 'Behaviour', icon: Star, enabled: true },
  { href: '/supervisor/pace', label: 'PACE', icon: BookOpenCheck, enabled: true },
  { href: '/supervisor/rota', label: 'Rota', icon: CalendarDays, enabled: true },
  { href: '/supervisor/calendar', label: 'Calendar', icon: CalendarDays, enabled: true },
  { href: '/supervisor/shop', label: 'Merit Shop', icon: ShoppingBag, enabled: true },
  { href: '/supervisor/messages', label: 'Messages', icon: MessageSquare, enabled: true },
  { href: '/supervisor/noticeboard', label: 'Noticeboard', icon: Bell, enabled: true },
  { href: '/supervisor/snapshot', label: 'Snapshot', icon: ClipboardList, enabled: true },
  { href: '/supervisor/notes-history', label: 'Notes History', icon: FileText, enabled: true },
] as const;

const preferredMobileLabels = [
  'Dashboard',
  'Attendance',
  'Behaviour',
  'Merit Shop',
  'Messages',
] as const;
const navIconSize = 15;

type SupervisorNavProps = {
  canManageClubs: boolean;
  canUseShop: boolean;
  hasLinkedChildren: boolean;
  unreadMessageCount: number;
  unreadNoticeCount: number;
};

function isActiveRoute(pathname: string, href: string, label: string) {
  return label === 'Dashboard'
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);
}

function countBadge(count: number): string | null {
  if (count <= 0) return null;
  return count > 99 ? '99+' : String(count);
}

function isPreferredMobileLabel(label: string): boolean {
  return preferredMobileLabels.includes(label as (typeof preferredMobileLabels)[number]);
}

function badgeForItem(
  item: (typeof navItems)[number],
  unreadMessageCount: number,
  unreadNoticeCount: number,
): string | null {
  if (item.label === 'Messages') return countBadge(unreadMessageCount);
  if (item.label === 'Noticeboard') return countBadge(unreadNoticeCount);
  return null;
}

export function SupervisorSidebarNav({
  canManageClubs,
  canUseShop,
  hasLinkedChildren,
  unreadMessageCount,
  unreadNoticeCount,
}: SupervisorNavProps) {
  const pathname = usePathname() ?? '';
  const visibleNavItems = navItems.filter(
    (item) =>
      (item.label !== 'Club Admin' || canManageClubs) &&
      (item.label !== 'Merit Shop' || canUseShop) &&
      (!['My Children', 'Clubs'].includes(item.label) || hasLinkedChildren),
  );

  return (
    <nav className="admin-shell__nav">
      {visibleNavItems.map((item) => {
        const Icon = item.icon;
        const active = isActiveRoute(pathname, item.href, item.label);
        const badge = badgeForItem(item, unreadMessageCount, unreadNoticeCount);
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
            <Icon aria-hidden="true" size={navIconSize} />
            <span>{item.label}</span>
            {badge ? <b>{badge}</b> : null}
          </Link>
        );
      })}
    </nav>
  );
}

export function SupervisorBottomNav({
  canManageClubs,
  canUseShop,
  hasLinkedChildren,
  unreadMessageCount,
  unreadNoticeCount,
}: SupervisorNavProps) {
  const pathname = usePathname() ?? '';
  const visibleNavItems = navItems.filter(
    (item) =>
      (item.label !== 'Club Admin' || canManageClubs) &&
      (item.label !== 'Merit Shop' || canUseShop) &&
      (!['My Children', 'Clubs'].includes(item.label) || hasLinkedChildren),
  );

  return (
    <nav aria-label="Mobile supervisor sections" className="admin-shell__bottom-nav">
      {[
        ...preferredMobileLabels.flatMap((label) =>
          visibleNavItems.filter((item) => item.label === label),
        ),
        ...visibleNavItems.filter((item) => !isPreferredMobileLabel(item.label)),
      ]
        .slice(0, 5)
        .map((item) => {
          const Icon = item.icon;
          const active = isActiveRoute(pathname, item.href, item.label);
          const badge = badgeForItem(item, unreadMessageCount, unreadNoticeCount);
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
              <Icon aria-hidden="true" size={navIconSize} />
              <span>{item.label}</span>
              {badge ? <b>{badge}</b> : null}
            </Link>
          );
        })}
    </nav>
  );
}
