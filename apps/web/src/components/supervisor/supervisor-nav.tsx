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
  Medal,
  MessageSquare,
  ReceiptText,
  ShieldAlert,
  ShoppingBag,
  Star,
} from 'lucide-react';

const navItems = [
  { href: '/supervisor', label: 'Dashboard', icon: Home },
  { href: '/admin/clubs', label: 'Club Admin', icon: Club },
  { href: '/admin/invoices', label: 'Invoices', icon: ReceiptText },
  { href: '/supervisor/attendance', label: 'Attendance', icon: CalendarCheck },
  { href: '/supervisor/behaviour', label: 'Behaviour', icon: Star },
  { href: '/supervisor/leaderboard', label: 'Leaderboard', icon: Medal },
  { href: '/supervisor/incidents', label: 'Incidents', icon: ShieldAlert },
  { href: '/supervisor/pace', label: 'PACE', icon: BookOpenCheck },
  { href: '/supervisor/rota', label: 'Rota', icon: CalendarDays },
  { href: '/supervisor/calendar', label: 'Calendar', icon: CalendarDays },
  { href: '/supervisor/shop', label: 'Merit Shop', icon: ShoppingBag },
  { href: '/supervisor/messages', label: 'Messages', icon: MessageSquare },
  { href: '/supervisor/noticeboard', label: 'Noticeboard', icon: Bell },
  { href: '/supervisor/snapshot', label: 'Snapshot', icon: ClipboardList },
  { href: '/supervisor/notes-history', label: 'Notes History', icon: FileText },
] as const;

const preferredMobileLabels = [
  'Dashboard',
  'Attendance',
  'Behaviour',
  'Invoices',
  'Merit Shop',
  'Messages',
] as const;
const navIconSize = 15;

type SupervisorNavProps = {
  canManageClubs: boolean;
  canManageInvoices: boolean;
  canUseShop: boolean;
  unreadMessageCount: number;
  unreadNoticeCount: number;
};

type SupervisorNavAccess = Pick<
  SupervisorNavProps,
  'canManageClubs' | 'canManageInvoices' | 'canUseShop'
>;

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

function visibleNavItemsFor(access: SupervisorNavAccess) {
  return navItems.filter(
    (item) =>
      (item.label !== 'Club Admin' || access.canManageClubs) &&
      (item.label !== 'Invoices' || access.canManageInvoices) &&
      (item.label !== 'Merit Shop' || access.canUseShop),
  );
}

export function SupervisorSidebarNav({
  canManageClubs,
  canManageInvoices,
  canUseShop,
  unreadMessageCount,
  unreadNoticeCount,
}: SupervisorNavProps) {
  const pathname = usePathname() ?? '';
  const visibleNavItems = visibleNavItemsFor({ canManageClubs, canManageInvoices, canUseShop });

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
  canManageInvoices,
  canUseShop,
  unreadMessageCount,
  unreadNoticeCount,
}: SupervisorNavProps) {
  const pathname = usePathname() ?? '';
  const visibleNavItems = visibleNavItemsFor({ canManageClubs, canManageInvoices, canUseShop });

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
