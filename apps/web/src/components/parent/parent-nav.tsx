'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Bell,
  CalendarDays,
  ClipboardList,
  ClipboardCheck,
  Club,
  FileText,
  Home,
  Medal,
  MessageSquare,
  ReceiptText,
  Settings,
  ShieldAlert,
  ShoppingBag,
  Smartphone,
  UserRound,
} from 'lucide-react';

const parentNavItems = [
  { href: '/parent', label: 'Home', icon: Home },
  { href: '/parent/calendar', label: 'Calendar', icon: CalendarDays },
  { href: '/parent/permission-slips', label: 'Permission Slips', icon: ClipboardCheck },
  { href: '/parent/clubs', label: 'Clubs', icon: Club },
  { href: '/parent/fees', label: 'Fees/Invoices', icon: ReceiptText },
  { href: '/parent/shop', label: 'Shop', icon: ShoppingBag },
  { href: '/parent/ranks', label: 'Ranks', icon: Medal },
  { href: '/parent/reports', label: 'Reports', icon: FileText },
  { href: '/parent/incidents', label: 'Incidents', icon: ShieldAlert },
  { href: '/parent/settings', label: 'Settings', icon: Settings },
  { href: '/parent/profile', label: 'My Profile', icon: UserRound },
  { href: '/parent/registration', label: 'Registration', icon: ClipboardList },
  { href: '/parent/messages', label: 'Messages', icon: MessageSquare },
  { href: '/parent/noticeboard', label: 'Noticeboard', icon: Bell },
  { href: '/mobile-app', label: 'Mobile App', icon: Smartphone },
] as const;

const parentMobileNavHrefs = new Set([
  '/parent',
  '/parent/calendar',
  '/parent/permission-slips',
  '/parent/fees',
  '/parent/messages',
]);
const parentTopNavItems = parentNavItems.filter((item) => item.href !== '/parent/profile');
const parentMobileNavItems = parentNavItems.filter((item) => parentMobileNavHrefs.has(item.href));
const navIconSize = 15;

function isActiveRoute(pathname: string, href: string, label: string) {
  return label === 'Home'
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

function badgeForItem(
  label: string,
  unreadMessageCount: number,
  unreadNoticeCount: number,
): string | null {
  if (label === 'Noticeboard') return countBadge(unreadNoticeCount);
  if (label === 'Messages') return countBadge(unreadMessageCount);
  return null;
}

export function ParentSidebarNav({ unreadMessageCount, unreadNoticeCount }: ParentNavProps) {
  const pathname = usePathname() ?? '';

  return (
    <nav className="admin-shell__nav">
      {parentNavItems.map((item) => {
        const Icon = item.icon;
        const active = isActiveRoute(pathname, item.href, item.label);
        const badge = badgeForItem(item.label, unreadMessageCount, unreadNoticeCount);
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

export function ParentTopNav({ unreadMessageCount, unreadNoticeCount }: ParentNavProps) {
  const pathname = usePathname() ?? '';

  return (
    <nav aria-label="Parent portal sections" className="parent-top-nav">
      {parentTopNavItems.map((item) => {
        const active = isActiveRoute(pathname, item.href, item.label);
        const badge = badgeForItem(item.label, unreadMessageCount, unreadNoticeCount);

        return (
          <Link
            aria-current={active ? 'page' : undefined}
            className={active ? 'parent-top-nav__item is-active' : 'parent-top-nav__item'}
            href={{ pathname: item.href }}
            key={item.label}
          >
            <span>{item.label}</span>
            {badge ? <b>{badge}</b> : null}
          </Link>
        );
      })}
    </nav>
  );
}

export function ParentBottomNav({ unreadMessageCount, unreadNoticeCount }: ParentNavProps) {
  const pathname = usePathname() ?? '';

  return (
    <nav aria-label="Mobile parent sections" className="admin-shell__bottom-nav">
      {parentMobileNavItems.map((item) => {
        const Icon = item.icon;
        const active = isActiveRoute(pathname, item.href, item.label);
        const badge = badgeForItem(item.label, unreadMessageCount, unreadNoticeCount);
        const mobileLabel =
          item.label === 'Permission Slips'
            ? 'Slips'
            : item.label === 'Fees/Invoices'
              ? 'Fees'
              : item.label;
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
            <span>{mobileLabel}</span>
            {badge ? <b>{badge}</b> : null}
          </Link>
        );
      })}
    </nav>
  );
}
