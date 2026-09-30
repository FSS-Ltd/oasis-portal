'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BookOpenCheck,
  BookOpen,
  Bell,
  CalendarCheck,
  CalendarDays,
  ClipboardCheck,
  Club,
  ClipboardList,
  FileText,
  Home,
  Medal,
  MessageSquare,
  ReceiptText,
  ShieldAlert,
  ShoppingBag,
  Smartphone,
  Star,
  type LucideIcon,
} from 'lucide-react';
import { SidebarNavGroup } from '@/components/navigation/sidebar-nav-group';

type NavPermission = 'canManageClubs' | 'canManageInvoices' | 'canUseLibrary' | 'canUseShop';

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  permission?: NavPermission;
};

type NavGroup = {
  label: string;
  icon: LucideIcon;
  items: NavItem[];
};

const dashboardItem: NavItem = { href: '/supervisor', label: 'Dashboard', icon: Home };
const mobileAppItem: NavItem = { href: '/mobile-app', label: 'Mobile App', icon: Smartphone };

const navGroups: NavGroup[] = [
  {
    label: 'Daily Ops',
    icon: CalendarCheck,
    items: [
      { href: '/supervisor/attendance', label: 'Attendance', icon: CalendarCheck },
      { href: '/supervisor/behaviour', label: 'Behaviour', icon: Star },
      { href: '/supervisor/incidents', label: 'Incidents', icon: ShieldAlert },
      { href: '/supervisor/snapshot', label: 'Snapshot', icon: ClipboardList },
      { href: '/supervisor/tasks', label: 'My tasks', icon: ClipboardCheck },
    ],
  },
  {
    label: 'Planning & Scheduling',
    icon: CalendarDays,
    items: [
      { href: '/supervisor/rota', label: 'Rota', icon: CalendarDays },
      { href: '/supervisor/calendar', label: 'Calendar', icon: CalendarDays },
      { href: '/supervisor/pace', label: 'PACE', icon: BookOpenCheck },
      {
        href: '/supervisor/library',
        label: 'Library',
        icon: BookOpen,
        permission: 'canUseLibrary',
      },
    ],
  },
  {
    label: 'Student Progress',
    icon: Medal,
    items: [
      { href: '/supervisor/leaderboard', label: 'Leaderboard', icon: Medal },
      { href: '/supervisor/notes-history', label: 'Notes History', icon: FileText },
      { href: '/supervisor/reports', label: 'Reports', icon: FileText },
      {
        href: '/supervisor/shop',
        label: 'Merit Shop',
        icon: ShoppingBag,
        permission: 'canUseShop',
      },
    ],
  },
  {
    label: 'Communication',
    icon: MessageSquare,
    items: [
      { href: '/supervisor/messages', label: 'Messages', icon: MessageSquare },
      { href: '/supervisor/noticeboard', label: 'Noticeboard', icon: Bell },
    ],
  },
  {
    label: 'Administration',
    icon: Club,
    items: [
      { href: '/admin/clubs', label: 'Club Admin', icon: Club, permission: 'canManageClubs' },
      {
        href: '/admin/invoices',
        label: 'Invoices',
        icon: ReceiptText,
        permission: 'canManageInvoices',
      },
    ],
  },
];

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
  canUseLibrary: boolean;
  canUseShop: boolean;
  unreadMessageCount: number;
  unreadNoticeCount: number;
};

type SupervisorNavAccess = Pick<
  SupervisorNavProps,
  'canManageClubs' | 'canManageInvoices' | 'canUseLibrary' | 'canUseShop'
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

function badgeForLabel(
  label: string,
  unreadMessageCount: number,
  unreadNoticeCount: number,
): string | null {
  if (label === 'Messages') return countBadge(unreadMessageCount);
  if (label === 'Noticeboard') return countBadge(unreadNoticeCount);
  return null;
}

function itemVisible(item: NavItem, access: SupervisorNavAccess): boolean {
  if (!item.permission) return true;
  return access[item.permission];
}

function visibleGroupsFor(access: SupervisorNavAccess): NavGroup[] {
  return navGroups.flatMap((group) => {
    const items = group.items.filter((item) => itemVisible(item, access));
    return items.length > 0 ? [{ ...group, items }] : [];
  });
}

function allVisibleFlatItemsFor(access: SupervisorNavAccess): NavItem[] {
  return [
    dashboardItem,
    ...navGroups.flatMap((g) => g.items.filter((item) => itemVisible(item, access))),
    mobileAppItem,
  ];
}

function groupTotalBadge(
  group: NavGroup,
  unreadMessageCount: number,
  unreadNoticeCount: number,
): string | null {
  let total = 0;
  for (const item of group.items) {
    if (item.label === 'Messages') total += unreadMessageCount;
    if (item.label === 'Noticeboard') total += unreadNoticeCount;
  }
  return countBadge(total);
}

export function SupervisorSidebarNav({
  canManageClubs,
  canManageInvoices,
  canUseLibrary,
  canUseShop,
  unreadMessageCount,
  unreadNoticeCount,
}: SupervisorNavProps) {
  const pathname = usePathname() ?? '';
  const access = { canManageClubs, canManageInvoices, canUseLibrary, canUseShop };
  const groups = visibleGroupsFor(access);
  const activeGroupLabel =
    groups.find((group) =>
      group.items.some((item) => isActiveRoute(pathname, item.href, item.label)),
    )?.label ?? null;
  const [openGroupLabel, setOpenGroupLabel] = useState<string | null>(activeGroupLabel);

  const dashboardActive = isActiveRoute(pathname, '/supervisor', 'Dashboard');
  const mobileAppActive = isActiveRoute(pathname, '/mobile-app', 'Mobile App');

  useEffect(() => {
    setOpenGroupLabel(activeGroupLabel);
  }, [activeGroupLabel]);

  return (
    <nav className="admin-shell__nav">
      <Link
        aria-current={dashboardActive ? 'page' : undefined}
        className={['admin-shell__nav-item', dashboardActive ? 'is-active' : undefined]
          .filter(Boolean)
          .join(' ')}
        href={{ pathname: '/supervisor' }}
      >
        <Home aria-hidden="true" size={navIconSize} />
        <span>Dashboard</span>
      </Link>

      {groups.map((group) => (
        <SidebarNavGroup
          badge={groupTotalBadge(group, unreadMessageCount, unreadNoticeCount)}
          icon={group.icon}
          key={group.label}
          label={group.label}
          navIconSize={navIconSize}
          onOpenChange={(open) => {
            setOpenGroupLabel(open ? group.label : null);
          }}
          open={openGroupLabel === group.label}
        >
          {group.items.map((item) => {
            const Icon = item.icon;
            const active = isActiveRoute(pathname, item.href, item.label);
            const badge = badgeForLabel(item.label, unreadMessageCount, unreadNoticeCount);
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
        </SidebarNavGroup>
      ))}

      <Link
        aria-current={mobileAppActive ? 'page' : undefined}
        className={['admin-shell__nav-item', mobileAppActive ? 'is-active' : undefined]
          .filter(Boolean)
          .join(' ')}
        href={{ pathname: '/mobile-app' }}
      >
        <Smartphone aria-hidden="true" size={navIconSize} />
        <span>Mobile App</span>
      </Link>
    </nav>
  );
}

export function SupervisorBottomNav({
  canManageClubs,
  canManageInvoices,
  canUseLibrary,
  canUseShop,
  unreadMessageCount,
  unreadNoticeCount,
}: SupervisorNavProps) {
  const pathname = usePathname() ?? '';
  const access = { canManageClubs, canManageInvoices, canUseLibrary, canUseShop };
  const allItems = allVisibleFlatItemsFor(access);

  return (
    <nav aria-label="Mobile supervisor sections" className="admin-shell__bottom-nav">
      {[
        ...preferredMobileLabels.flatMap((label) =>
          allItems.filter((item) => item.label === label),
        ),
        ...allItems.filter((item) => !isPreferredMobileLabel(item.label)),
      ]
        .slice(0, 5)
        .map((item) => {
          const Icon = item.icon;
          const active = isActiveRoute(pathname, item.href, item.label);
          const badge = badgeForLabel(item.label, unreadMessageCount, unreadNoticeCount);
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
