'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Bell,
  BookOpenCheck,
  BookOpen,
  CalendarDays,
  CalendarCheck,
  ClipboardList,
  ClipboardCheck,
  Club,
  FileText,
  GraduationCap,
  Home,
  MessageSquare,
  ReceiptText,
  ShoppingBag,
  Star,
  UserCog,
  UsersRound,
} from 'lucide-react';

const navItems = [
  { href: '/admin', label: 'Dashboard', icon: Home },
  { href: '/admin/children', label: 'My Children', icon: UsersRound },
  { href: '/admin/my-clubs', label: 'My Clubs', icon: Club },
  { href: '/supervisor', label: 'Supervisor', icon: ClipboardList },
  { href: '/admin/students', label: 'Students', icon: GraduationCap },
  { href: '/admin/attendance', label: 'Attendance', icon: CalendarCheck },
  { href: '/admin/rota', label: 'Rota', icon: CalendarDays },
  { href: '/admin/calendar', label: 'Calendar', icon: CalendarDays },
  { href: '/admin/clubs', label: 'Clubs', icon: Club },
  { href: '/admin/access', label: 'User Access', icon: UserCog },
  { href: '/admin/staff', label: 'People & Profiles', icon: UsersRound },
  { href: '/admin/audit', label: 'Audit', icon: ClipboardList },
  { href: '/admin/sensitive-review', label: 'Sensitive Review', icon: ClipboardList },
  { href: '/admin/behaviour', label: 'Behaviour', icon: Star },
  { href: '/admin/pace', label: 'PACE', icon: BookOpenCheck },
  { href: '/admin/snapshot', label: 'Snapshot', icon: ClipboardList },
  { href: '/admin/academic', label: 'Academics', icon: BookOpen },
  { href: '/admin/permission-slips', label: 'Permission Slips', icon: ClipboardCheck },
  { href: '/admin/invoices', label: 'Invoices', icon: ReceiptText },
  { href: '/admin/shop', label: 'Merit Shop', icon: ShoppingBag },
  { href: '/admin/reports', label: 'Reports', icon: FileText },
  { href: '/admin/messages', label: 'Messages', icon: MessageSquare },
  { href: '/admin/noticeboard', label: 'Noticeboard', icon: Bell },
] as const;

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
  canManageCalendar: boolean;
  canManageClubs: boolean;
  canManageInvoices: boolean;
  canManagePermissionSlips: boolean;
  canUseShop: boolean;
  clubsOnly: boolean;
  canExportAttendance: boolean;
  fullAdmin: boolean;
  hasLinkedChildren: boolean;
  canUseMessages: boolean;
  unreadMessageCount: number;
};

function isActiveRoute(pathname: string, href: string, label: string) {
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

function visibleForUser(
  item: (typeof navItems)[number],
  access: Pick<
    AdminNavProps,
    | 'canManageUserAccounts'
    | 'canManageCalendar'
    | 'canManageClubs'
    | 'canManageInvoices'
    | 'canManagePermissionSlips'
    | 'canUseShop'
    | 'clubsOnly'
    | 'canViewAudit'
    | 'canViewBehaviour'
    | 'canExportAttendance'
    | 'canViewPace'
    | 'canViewStudents'
    | 'fullAdmin'
    | 'hasLinkedChildren'
    | 'canUseMessages'
  >,
) {
  if (item.label === 'My Children') return access.hasLinkedChildren;
  if (item.label === 'My Clubs') return access.hasLinkedChildren;
  if (item.label === 'Supervisor') return access.clubsOnly;
  if (item.label === 'Messages') return access.canUseMessages;
  if (item.label === 'Clubs') return access.canManageClubs;
  if (item.label === 'Permission Slips') return access.canManagePermissionSlips;
  if (item.label === 'Invoices') return access.fullAdmin || access.canManageInvoices;
  if (item.label === 'Merit Shop') return access.fullAdmin || access.canUseShop;
  if (item.label === 'Calendar') return true;
  if (access.fullAdmin) {
    if (item.label === 'User Access') return false;
    return item.label !== 'Audit' || access.canViewAudit;
  }
  if (item.label === 'Attendance') return access.canExportAttendance;
  if (item.label === 'User Access') return access.canManageUserAccounts;
  if (item.label === 'Students') return access.canViewStudents;
  if (item.label === 'Behaviour') return access.canViewBehaviour;
  if (item.label === 'PACE') return access.canViewPace;
  return false;
}

export function AdminSidebarNav({
  canViewAudit,
  canViewBehaviour,
  canViewPace,
  canViewStudents,
  canManageUserAccounts,
  canManageCalendar,
  canManageClubs,
  canManageInvoices,
  canManagePermissionSlips,
  canUseShop,
  clubsOnly,
  canExportAttendance,
  fullAdmin,
  hasLinkedChildren,
  canUseMessages,
  unreadMessageCount,
}: AdminNavProps) {
  const pathname = usePathname() ?? '';
  const visibleNavItems = navItems.filter((item) =>
    visibleForUser(item, {
      canManageUserAccounts,
      canManageCalendar,
      canManageClubs,
      canManageInvoices,
      canManagePermissionSlips,
      canUseShop,
      clubsOnly,
      canViewAudit,
      canViewBehaviour,
      canExportAttendance,
      canViewPace,
      canViewStudents,
      fullAdmin,
      hasLinkedChildren,
      canUseMessages,
    }),
  );

  return (
    <nav className="admin-shell__nav">
      {visibleNavItems.map((item, index) => {
        const Icon = item.icon;
        const active = isActiveRoute(pathname, item.href, item.label);
        const badge = item.label === 'Messages' ? countBadge(unreadMessageCount) : null;
        const className = ['admin-shell__nav-item', active ? 'is-active' : undefined]
          .filter(Boolean)
          .join(' ');

        return (
          <Link
            aria-current={active ? 'page' : undefined}
            className={className}
            href={{ pathname: item.href }}
            key={`${item.label}-${String(index)}`}
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

export function AdminBottomNav({
  canViewAudit,
  canViewBehaviour,
  canViewPace,
  canViewStudents,
  canManageUserAccounts,
  canManageCalendar,
  canManageClubs,
  canManageInvoices,
  canManagePermissionSlips,
  canUseShop,
  clubsOnly,
  canExportAttendance,
  fullAdmin,
  hasLinkedChildren,
  canUseMessages,
  unreadMessageCount,
}: AdminNavProps) {
  const pathname = usePathname() ?? '';
  const visibleNavItems = navItems.filter((item) =>
    visibleForUser(item, {
      canManageUserAccounts,
      canManageCalendar,
      canManageClubs,
      canManageInvoices,
      canManagePermissionSlips,
      canUseShop,
      clubsOnly,
      canViewAudit,
      canViewBehaviour,
      canExportAttendance,
      canViewPace,
      canViewStudents,
      fullAdmin,
      hasLinkedChildren,
      canUseMessages,
    }),
  );
  const mobileNavItems = [
    ...preferredMobileLabels.flatMap((label) =>
      visibleNavItems.filter((item) => item.label === label),
    ),
    ...visibleNavItems.filter((item) => !isPreferredMobileLabel(item.label)),
  ].slice(0, 5);

  return (
    <nav aria-label="Mobile admin sections" className="admin-shell__bottom-nav">
      {mobileNavItems.map((item, index) => {
        const Icon = item.icon;
        const active = isActiveRoute(pathname, item.href, item.label);
        const badge = item.label === 'Messages' ? countBadge(unreadMessageCount) : null;
        const className = ['admin-shell__bottom-item', active ? 'is-active' : undefined]
          .filter(Boolean)
          .join(' ');

        return (
          <Link
            aria-current={active ? 'page' : undefined}
            className={className}
            href={{ pathname: item.href }}
            key={`${item.label}-${String(index)}`}
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
