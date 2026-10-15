'use client';

import { CLUBS_VISIBLE, ROTA_VISIBLE } from '@oasis/domain/portal-visibility';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import {
  Bell,
  BookOpen,
  BookOpenCheck,
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
  Table2,
  UserRound,
  ChevronDown,
  type LucideIcon,
} from 'lucide-react';
import { SidebarNavGroup } from '@/components/navigation/sidebar-nav-group';
import { AgreementPendingBadge } from '@/components/agreements/my-agreements';

const parentNavItems = [
  { href: '/parent', label: 'Home', icon: Home },
  { href: '/parent/pace', label: 'PACE', icon: BookOpenCheck },
  { href: '/parent/library', label: 'Library', icon: BookOpen },
  { href: '/parent/calendar', label: 'Calendar', icon: CalendarDays },
  { href: '/parent/timetable', label: 'Timetable', icon: Table2 },
  { href: '/parent/volunteer', label: 'Volunteer', icon: CalendarDays },
  { href: '/parent/permission-slips', label: 'Permission Slips', icon: ClipboardCheck },
  { href: '/parent/compliance', label: 'User Agreements', icon: FileText },
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
const parentGroups = [
  {
    label: 'Learning & Progress',
    icon: BookOpenCheck,
    hrefs: ['/parent/pace', '/parent/library', '/parent/ranks', '/parent/reports'],
  },
  {
    label: 'Planning & Activities',
    icon: CalendarDays,
    hrefs: ['/parent/calendar', '/parent/timetable', '/parent/volunteer', '/parent/clubs'],
  },
  {
    label: 'Communication',
    icon: MessageSquare,
    hrefs: ['/parent/messages', '/parent/noticeboard'],
  },
  {
    label: 'Compliance',
    icon: ShieldAlert,
    hrefs: [
      '/parent/compliance',
      '/parent/permission-slips',
      '/parent/incidents',
      '/parent/registration',
    ],
  },
  { label: 'Finance & Shop', icon: ReceiptText, hrefs: ['/parent/fees', '/parent/shop'] },
  {
    label: 'Account',
    icon: UserRound,
    hrefs: ['/parent/profile', '/parent/settings', '/mobile-app'],
  },
] as const;
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

export function parentNavigationItems(canUseParentVolunteer: boolean): readonly ParentNavItem[] {
  return parentNavItems.filter(
    (item) =>
      (CLUBS_VISIBLE || item.href !== '/parent/clubs') &&
      (ROTA_VISIBLE || item.href !== '/parent/volunteer') &&
      (canUseParentVolunteer || item.href !== '/parent/volunteer'),
  );
}

export function parentBottomNavigationItems(
  canUseParentVolunteer: boolean,
): readonly ParentNavItem[] {
  return parentNavigationItems(canUseParentVolunteer).filter((item) =>
    parentMobileNavHrefs.has(item.href),
  );
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
  const visibleItems = parentNavigationItems(canUseParentVolunteer);
  const activeGroup =
    parentGroups.find((group) =>
      group.hrefs.some((href) => pathname === href || pathname.startsWith(`${href}/`)),
    )?.label ?? null;
  const [openGroup, setOpenGroup] = useState<string | null>(activeGroup);
  useEffect(() => {
    setOpenGroup(activeGroup);
  }, [activeGroup]);

  return (
    <nav className="admin-shell__nav">
      <ParentNavLink
        active={pathname === '/parent'}
        badge={null}
        icon={Home}
        item={parentNavItems[0]}
        label="Home"
        variant="side"
      />
      {parentGroups.map((group) => {
        const items = visibleItems.filter((item) =>
          (group.hrefs as readonly string[]).includes(item.href),
        );
        if (items.length === 0) return null;
        return (
          <SidebarNavGroup
            badge={group.label === 'Compliance' ? <AgreementPendingBadge /> : null}
            icon={group.icon}
            key={group.label}
            label={group.label}
            onOpenChange={(open) => {
              setOpenGroup(open ? group.label : null);
            }}
            open={openGroup === group.label}
          >
            {items.map((item) => (
              <ParentNavLink
                active={isActiveRoute(pathname, item.href, item.label)}
                badge={badgeForItem(item.label, unreadMessageCount, unreadNoticeCount)}
                icon={item.icon}
                item={item}
                key={item.href}
                label={item.label}
                variant="side"
              />
            ))}
          </SidebarNavGroup>
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
  const visibleItems = parentNavigationItems(canUseParentVolunteer);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const navRef = useRef<HTMLElement>(null);
  useEffect(() => {
    setOpenGroup(null);
  }, [pathname]);

  return (
    <nav
      aria-label="Parent portal sections"
      className="parent-top-nav"
      ref={navRef}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          navRef.current?.querySelector<HTMLButtonElement>('button[aria-expanded="true"]')?.focus();
          setOpenGroup(null);
        }
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpenGroup(null);
      }}
    >
      <ParentNavLink
        active={pathname === '/parent'}
        badge={null}
        item={parentNavItems[0]}
        label="Home"
        variant="top"
      />
      {parentGroups.map((group) => {
        const items = visibleItems.filter((item) =>
          (group.hrefs as readonly string[]).includes(item.href),
        );
        if (items.length === 0) return null;
        const active = items.some((item) => isActiveRoute(pathname, item.href, item.label));
        const open = openGroup === group.label;
        return (
          <div className="parent-top-nav__group" key={group.label}>
            <button
              aria-expanded={open}
              className={`parent-top-nav__item${active ? ' is-active' : ''}`}
              onClick={() => {
                setOpenGroup(open ? null : group.label);
              }}
              type="button"
            >
              {group.label}
              {group.label === 'Compliance' ? <AgreementPendingBadge /> : null}
              <ChevronDown aria-hidden="true" size={14} />
            </button>
            {open ? (
              <div className="parent-top-nav__dropdown">
                {items.map((item) => (
                  <ParentNavLink
                    active={isActiveRoute(pathname, item.href, item.label)}
                    badge={badgeForItem(item.label, unreadMessageCount, unreadNoticeCount)}
                    item={item}
                    key={item.href}
                    label={item.label}
                    variant="top"
                  />
                ))}
              </div>
            ) : null}
          </div>
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
  const visibleItems = parentBottomNavigationItems(canUseParentVolunteer);

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
