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
  type LucideIcon,
} from 'lucide-react';

const parentNavItems = [
  { href: '/parent', label: 'Home', icon: Home },
  { href: '/parent/calendar', label: 'Calendar', icon: CalendarDays },
  { href: '/parent/volunteer', label: 'Volunteer', icon: CalendarDays },
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

type ParentNavItem = (typeof parentNavItems)[number];
type ParentNavLinkVariant = 'bottom' | 'side' | 'top';

const parentMobileNavHrefs = new Set([
  '/parent',
  '/parent/calendar',
  '/parent/permission-slips',
  '/parent/fees',
  '/parent/messages',
]);
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
  canUseParentVolunteer: boolean;
  unreadMessageCount: number;
  unreadNoticeCount: number;
}

function visibleParentNavItems(canUseParentVolunteer: boolean): readonly ParentNavItem[] {
  return canUseParentVolunteer
    ? parentNavItems
    : parentNavItems.filter((item) => item.href !== '/parent/volunteer');
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

function mobileLabelForItem(label: string): string {
  if (label === 'Permission Slips') return 'Slips';
  if (label === 'Fees/Invoices') return 'Fees';
  return label;
}

function navItemClassName(variant: ParentNavLinkVariant, active: boolean): string {
  const baseClassName =
    variant === 'top'
      ? 'parent-top-nav__item'
      : variant === 'bottom'
        ? 'admin-shell__bottom-item'
        : 'admin-shell__nav-item';

  return [baseClassName, active ? 'is-active' : undefined].filter(Boolean).join(' ');
}

function ParentNavLink({
  active,
  badge,
  icon: Icon,
  item,
  label,
  variant,
}: {
  active: boolean;
  badge: string | null;
  icon?: LucideIcon;
  item: ParentNavItem;
  label: string;
  variant: ParentNavLinkVariant;
}) {
  return (
    <Link
      aria-current={active ? 'page' : undefined}
      className={navItemClassName(variant, active)}
      href={{ pathname: item.href }}
    >
      {Icon ? <Icon aria-hidden="true" size={navIconSize} /> : null}
      <span>{label}</span>
      {badge ? <b>{badge}</b> : null}
    </Link>
  );
}

export function ParentSidebarNav({
  canUseParentVolunteer,
  unreadMessageCount,
  unreadNoticeCount,
}: ParentNavProps) {
  const pathname = usePathname() ?? '';
  const visibleItems = visibleParentNavItems(canUseParentVolunteer);

  return (
    <nav className="admin-shell__nav">
      {visibleItems.map((item) => {
        const active = isActiveRoute(pathname, item.href, item.label);

        return (
          <ParentNavLink
            active={active}
            badge={badgeForItem(item.label, unreadMessageCount, unreadNoticeCount)}
            icon={item.icon}
            item={item}
            key={item.label}
            label={item.label}
            variant="side"
          />
        );
      })}
    </nav>
  );
}

export function ParentTopNav({
  canUseParentVolunteer,
  unreadMessageCount,
  unreadNoticeCount,
}: ParentNavProps) {
  const pathname = usePathname() ?? '';
  const visibleItems = visibleParentNavItems(canUseParentVolunteer).filter(
    (item) => item.href !== '/parent/profile',
  );

  return (
    <nav aria-label="Parent portal sections" className="parent-top-nav">
      {visibleItems.map((item) => {
        const active = isActiveRoute(pathname, item.href, item.label);

        return (
          <ParentNavLink
            active={active}
            badge={badgeForItem(item.label, unreadMessageCount, unreadNoticeCount)}
            item={item}
            key={item.label}
            label={item.label}
            variant="top"
          />
        );
      })}
    </nav>
  );
}

export function ParentBottomNav({
  canUseParentVolunteer,
  unreadMessageCount,
  unreadNoticeCount,
}: ParentNavProps) {
  const pathname = usePathname() ?? '';
  const visibleItems = visibleParentNavItems(canUseParentVolunteer).filter((item) =>
    parentMobileNavHrefs.has(item.href),
  );

  return (
    <nav aria-label="Mobile parent sections" className="admin-shell__bottom-nav">
      {visibleItems.map((item) => {
        const active = isActiveRoute(pathname, item.href, item.label);

        return (
          <ParentNavLink
            active={active}
            badge={badgeForItem(item.label, unreadMessageCount, unreadNoticeCount)}
            icon={item.icon}
            item={item}
            key={item.label}
            label={mobileLabelForItem(item.label)}
            variant="bottom"
          />
        );
      })}
    </nav>
  );
}
