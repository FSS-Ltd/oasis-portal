'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  Bell,
  BookOpenCheck,
  BookOpen,
  CalendarDays,
  CalendarCheck,
  ClipboardList,
  GraduationCap,
  Home,
  MessageSquare,
  ShoppingBag,
  Star,
  UserCog,
  UsersRound,
} from 'lucide-react';

const navItems = [
  { href: '/admin', label: 'Dashboard', icon: Home, badge: undefined },
  { href: '/admin/children', label: 'My Children', icon: UsersRound, badge: undefined },
  { href: '/admin/students', label: 'Students', icon: GraduationCap, badge: undefined },
  { href: '/admin/attendance', label: 'Attendance', icon: CalendarCheck, badge: undefined },
  { href: '/admin/rota', label: 'Rota', icon: CalendarDays, badge: undefined },
  { href: '/admin/access', label: 'User Access', icon: UserCog, badge: undefined },
  { href: '/admin/staff', label: 'People & Profiles', icon: UsersRound, badge: undefined },
  { href: '/admin/audit', label: 'Audit', icon: ClipboardList, badge: undefined },
  { href: '/admin/behaviour', label: 'Behaviour', icon: Star, badge: undefined },
  { href: '/admin/pace', label: 'PACE', icon: BookOpenCheck, badge: undefined },
  { href: '/admin/snapshot', label: 'Snapshot', icon: ClipboardList, badge: undefined },
  { href: '/admin/academic', label: 'Academics', icon: BookOpen, badge: undefined },
  { href: '/admin', label: 'Merit Shop', icon: ShoppingBag, badge: undefined },
  { href: '/admin', label: 'Reports', icon: BarChart3, badge: undefined },
  { href: '/admin', label: 'Messages', icon: MessageSquare, badge: '2' },
  { href: '/admin/noticeboard', label: 'Noticeboard', icon: Bell, badge: undefined },
] as const;

type AdminNavProps = {
  canViewAudit: boolean;
  canViewBehaviour: boolean;
  canViewPace: boolean;
  canViewStudents: boolean;
  canManageUserAccounts: boolean;
  canExportAttendance: boolean;
  fullAdmin: boolean;
  hasLinkedChildren: boolean;
};

function isActiveRoute(pathname: string, href: string, label: string) {
  if (href === '/admin') {
    return label === 'Dashboard' && pathname === '/admin';
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function visibleForUser(
  item: (typeof navItems)[number],
  access: Pick<
    AdminNavProps,
    | 'canManageUserAccounts'
    | 'canViewAudit'
    | 'canViewBehaviour'
    | 'canExportAttendance'
    | 'canViewPace'
    | 'canViewStudents'
    | 'fullAdmin'
    | 'hasLinkedChildren'
  >,
) {
  if (item.label === 'My Children') return access.hasLinkedChildren;
  if (access.fullAdmin) return item.label !== 'Audit' || access.canViewAudit;
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
  canExportAttendance,
  fullAdmin,
  hasLinkedChildren,
}: AdminNavProps) {
  const pathname = usePathname();
  const visibleNavItems = navItems.filter((item) =>
    visibleForUser(item, {
      canManageUserAccounts,
      canViewAudit,
      canViewBehaviour,
      canExportAttendance,
      canViewPace,
      canViewStudents,
      fullAdmin,
      hasLinkedChildren,
    }),
  );

  return (
    <nav className="admin-shell__nav">
      {visibleNavItems.map((item, index) => {
        const Icon = item.icon;
        const enabled = item.href !== '/admin' || item.label === 'Dashboard';
        const active = enabled && isActiveRoute(pathname, item.href, item.label);
        const className = [
          'admin-shell__nav-item',
          enabled ? undefined : 'is-disabled',
          active ? 'is-active' : undefined,
        ]
          .filter(Boolean)
          .join(' ');

        return (
          <Link
            aria-current={active ? 'page' : undefined}
            aria-disabled={!enabled}
            className={className}
            href={{ pathname: item.href }}
            key={`${item.label}-${String(index)}`}
          >
            <Icon aria-hidden="true" size={18} />
            <span>{item.label}</span>
            {item.badge ? <b>{item.badge}</b> : null}
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
  canExportAttendance,
  fullAdmin,
  hasLinkedChildren,
}: AdminNavProps) {
  const pathname = usePathname();
  const mobileNavItems = navItems
    .filter((item) =>
      visibleForUser(item, {
        canManageUserAccounts,
        canViewAudit,
        canViewBehaviour,
        canExportAttendance,
        canViewPace,
        canViewStudents,
        fullAdmin,
        hasLinkedChildren,
      }),
    )
    .slice(0, 5);

  return (
    <nav aria-label="Mobile admin sections" className="admin-shell__bottom-nav">
      {mobileNavItems.map((item, index) => {
        const Icon = item.icon;
        const active = isActiveRoute(pathname, item.href, item.label);
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
            <Icon aria-hidden="true" size={18} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
