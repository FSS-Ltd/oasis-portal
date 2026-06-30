'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Bell,
  BookOpenCheck,
  BookOpen,
  BookOpenText,
  CalendarDays,
  CalendarCheck,
  ClipboardList,
  ClipboardCheck,
  Club,
  FileText,
  GraduationCap,
  Home,
  Medal,
  MessageCircle,
  ShieldAlert,
  MessageSquare,
  MonitorCheck,
  ReceiptText,
  ShoppingBag,
  Smartphone,
  Star,
  UserCog,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';
import { SidebarNavGroup } from '@/components/navigation/sidebar-nav-group';

type NavItem = {
  href: string;
  icon: LucideIcon;
  label: string;
};

type NavGroup = {
  icon: LucideIcon;
  items: NavItem[];
  label: string;
};

const dashboardItem: NavItem = { href: '/admin', label: 'Dashboard', icon: Home };
const supervisorItem: NavItem = { href: '/supervisor', label: 'Supervisor', icon: ClipboardList };
const mobileAppItem: NavItem = { href: '/mobile-app', label: 'Mobile App', icon: Smartphone };

const navGroups: NavGroup[] = [
  {
    label: 'Daily Ops',
    icon: CalendarCheck,
    items: [
      { href: '/admin/attendance', label: 'Attendance', icon: CalendarCheck },
      { href: '/admin/behaviour', label: 'Behaviour', icon: Star },
      { href: '/admin/incidents', label: 'Incidents', icon: ShieldAlert },
      { href: '/admin/rota', label: 'Rota', icon: CalendarDays },
      { href: '/admin/calendar', label: 'Calendar', icon: CalendarDays },
      { href: '/admin/snapshot', label: 'Snapshot', icon: ClipboardList },
    ],
  },
  {
    label: 'Learning & Progress',
    icon: GraduationCap,
    items: [
      { href: '/admin/students', label: 'Students', icon: GraduationCap },
      { href: '/admin/pace', label: 'PACE', icon: BookOpenCheck },
      { href: '/admin/homework', label: 'Homework', icon: ClipboardList },
      { href: '/admin/academic', label: 'Academics', icon: BookOpen },
      { href: '/admin/faith-corner', label: 'Faith Corner', icon: BookOpenText },
      { href: '/admin/leaderboard', label: 'Leaderboard', icon: Medal },
      { href: '/admin/student-portal', label: 'Student Portal', icon: MonitorCheck },
    ],
  },
  {
    label: 'Communication & Consent',
    icon: MessageSquare,
    items: [
      { href: '/admin/messages', label: 'Messages', icon: MessageSquare },
      { href: '/admin/noticeboard', label: 'Noticeboard', icon: Bell },
      { href: '/admin/student-notifications', label: 'Student Alerts', icon: Bell },
      { href: '/admin/community', label: 'Community', icon: MessageCircle },
      { href: '/admin/permission-slips', label: 'Permission Slips', icon: ClipboardCheck },
    ],
  },
  {
    label: 'People & Access',
    icon: UsersRound,
    items: [
      { href: '/admin/staff', label: 'People & Profiles', icon: UsersRound },
      { href: '/admin/access', label: 'User Access', icon: UserCog },
      { href: '/admin/clubs', label: 'Clubs', icon: Club },
    ],
  },
  {
    label: 'Finance & Shop',
    icon: ReceiptText,
    items: [
      { href: '/admin/invoices', label: 'Invoices', icon: ReceiptText },
      { href: '/admin/shop', label: 'Merit Shop', icon: ShoppingBag },
    ],
  },
  {
    label: 'Governance',
    icon: FileText,
    items: [
      { href: '/admin/reports', label: 'Reports', icon: FileText },
      { href: '/admin/audit', label: 'Audit', icon: ClipboardList },
      { href: '/admin/sensitive-review', label: 'Sensitive Review', icon: ClipboardList },
    ],
  },
];

const leadingStandaloneItems = [dashboardItem, supervisorItem] as const;
const trailingStandaloneItems = [mobileAppItem] as const;

const preferredMobileLabels = [
  'Dashboard',
  'Students',
  'Attendance',
  'Invoices',
  'Merit Shop',
  'Messages',
] as const;
const navIconSize = 15;

type AdminNavProps = {
  canViewAudit: boolean;
  canViewBehaviour: boolean;
  canViewPace: boolean;
  canViewStudents: boolean;
  canManageUserAccounts: boolean;
  canManageClubs: boolean;
  canManageInvoices: boolean;
  canManagePermissionSlips: boolean;
  canUseShop: boolean;
  canUseAdminOperations: boolean;
  clubsOnly: boolean;
  canExportAttendance: boolean;
  fullAdmin: boolean;
  canUseMessages: boolean;
  unreadMessageCount: number;
};

type AdminNavAccess = Omit<AdminNavProps, 'unreadMessageCount'>;

function isActiveRoute(pathname: string, href: string, label: string): boolean {
  if (href === '/admin') {
    return label === 'Dashboard' && pathname === '/admin';
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function countBadge(count: number): string | null {
  if (count <= 0) return null;
  return count > 99 ? '99+' : String(count);
}

function isPreferredMobileLabel(label: string): boolean {
  return preferredMobileLabels.includes(label as (typeof preferredMobileLabels)[number]);
}

function badgeForLabel(label: string, unreadMessageCount: number): string | null {
  if (label === 'Messages') return countBadge(unreadMessageCount);
  return null;
}

function visibleForUser(item: NavItem, access: AdminNavAccess): boolean {
  if (item.label === 'Supervisor') return access.clubsOnly;
  if (item.label === 'Messages') return access.canUseMessages;
  if (item.label === 'Community') return access.fullAdmin;
  if (item.label === 'Leaderboard') return access.canUseAdminOperations;
  if (item.label === 'Clubs') return access.canManageClubs;
  if (item.label === 'Homework') return access.fullAdmin;
  if (item.label === 'Permission Slips') return access.canManagePermissionSlips;
  if (item.label === 'Invoices') return access.fullAdmin || access.canManageInvoices;
  if (item.label === 'Merit Shop') return access.fullAdmin || access.canUseShop;
  if (item.label === 'Calendar') return true;
  if (item.label === 'Mobile App') return true;
  if (access.fullAdmin) {
    if (item.label === 'User Access') return false;
    return item.label !== 'Audit' || access.canViewAudit;
  }
  if (access.canUseAdminOperations) {
    return !['Supervisor', 'Invoices', 'Sensitive Review', 'Audit'].includes(item.label);
  }
  if (item.label === 'Attendance') return access.canExportAttendance;
  if (item.label === 'User Access') return access.canManageUserAccounts;
  if (item.label === 'Students') return access.canViewStudents;
  if (item.label === 'Behaviour') return access.canViewBehaviour;
  if (item.label === 'PACE') return access.canViewPace;
  return false;
}

function visibleGroupsFor(access: AdminNavAccess): NavGroup[] {
  return navGroups.flatMap((group) => {
    const items = group.items.filter((item) => visibleForUser(item, access));
    return items.length > 0 ? [{ ...group, items }] : [];
  });
}

function visibleStandaloneItemsFor(items: readonly NavItem[], access: AdminNavAccess): NavItem[] {
  return items.filter((item) => visibleForUser(item, access));
}

function allVisibleFlatItemsFor(access: AdminNavAccess): NavItem[] {
  return [
    ...leadingStandaloneItems,
    ...navGroups.flatMap((group) => group.items),
    ...trailingStandaloneItems,
  ].filter((item) => visibleForUser(item, access));
}

function groupTotalBadge(group: NavGroup, unreadMessageCount: number): string | null {
  let total = 0;
  for (const item of group.items) {
    if (item.label === 'Messages') total += unreadMessageCount;
  }
  return countBadge(total);
}

function navItemClassName(baseClassName: string, active: boolean): string {
  return [baseClassName, active ? 'is-active' : undefined].filter(Boolean).join(' ');
}

type NavItemLinkProps = {
  baseClassName: string;
  badge: string | null;
  item: NavItem;
  pathname: string;
};

function NavItemLink({ baseClassName, badge, item, pathname }: NavItemLinkProps) {
  const Icon = item.icon;
  const active = isActiveRoute(pathname, item.href, item.label);

  return (
    <Link
      aria-current={active ? 'page' : undefined}
      className={navItemClassName(baseClassName, active)}
      href={{ pathname: item.href }}
    >
      <Icon aria-hidden="true" size={navIconSize} />
      <span>{item.label}</span>
      {badge ? <b>{badge}</b> : null}
    </Link>
  );
}

export function AdminSidebarNav({ unreadMessageCount, ...access }: AdminNavProps) {
  const pathname = usePathname() ?? '';
  const groups = visibleGroupsFor(access);
  const activeGroupLabel =
    groups.find((group) =>
      group.items.some((item) => isActiveRoute(pathname, item.href, item.label)),
    )?.label ?? null;
  const [openGroupLabel, setOpenGroupLabel] = useState<string | null>(activeGroupLabel);
  const [hoverGroupLabel, setHoverGroupLabel] = useState<string | null>(null);
  const activeOpenGroupLabel = hoverGroupLabel ?? openGroupLabel;

  useEffect(() => {
    setOpenGroupLabel(activeGroupLabel);
  }, [activeGroupLabel]);

  return (
    <nav className="admin-shell__nav">
      {visibleStandaloneItemsFor(leadingStandaloneItems, access).map((item) => (
        <NavItemLink
          badge={badgeForLabel(item.label, unreadMessageCount)}
          baseClassName="admin-shell__nav-item"
          item={item}
          key={item.label}
          pathname={pathname}
        />
      ))}

      {groups.map((group) => (
        <SidebarNavGroup
          badge={groupTotalBadge(group, unreadMessageCount)}
          icon={group.icon}
          key={group.label}
          label={group.label}
          navIconSize={navIconSize}
          onHoverEnd={() => {
            setHoverGroupLabel((current) => (current === group.label ? null : current));
          }}
          onHoverStart={() => {
            setHoverGroupLabel(group.label);
          }}
          onOpenChange={(open) => {
            setOpenGroupLabel(open ? group.label : null);
          }}
          open={activeOpenGroupLabel === group.label}
        >
          {group.items.map((item) => (
            <NavItemLink
              badge={badgeForLabel(item.label, unreadMessageCount)}
              baseClassName="admin-shell__nav-item"
              item={item}
              key={item.label}
              pathname={pathname}
            />
          ))}
        </SidebarNavGroup>
      ))}

      {visibleStandaloneItemsFor(trailingStandaloneItems, access).map((item) => (
        <NavItemLink
          badge={badgeForLabel(item.label, unreadMessageCount)}
          baseClassName="admin-shell__nav-item"
          item={item}
          key={item.label}
          pathname={pathname}
        />
      ))}
    </nav>
  );
}

export function AdminBottomNav({ unreadMessageCount, ...access }: AdminNavProps) {
  const pathname = usePathname() ?? '';
  const visibleNavItems = allVisibleFlatItemsFor(access);
  const mobileNavItems = [
    ...preferredMobileLabels.flatMap((label) =>
      visibleNavItems.filter((item) => item.label === label),
    ),
    ...visibleNavItems.filter((item) => !isPreferredMobileLabel(item.label)),
  ].slice(0, 5);

  return (
    <nav aria-label="Mobile admin sections" className="admin-shell__bottom-nav">
      {mobileNavItems.map((item) => (
        <NavItemLink
          badge={badgeForLabel(item.label, unreadMessageCount)}
          baseClassName="admin-shell__bottom-item"
          item={item}
          key={item.label}
          pathname={pathname}
        />
      ))}
    </nav>
  );
}
