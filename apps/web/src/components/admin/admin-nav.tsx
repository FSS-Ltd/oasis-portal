'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  Bell,
  BookOpen,
  CalendarCheck,
  ClipboardList,
  GraduationCap,
  Home,
  MessageSquare,
  ShoppingBag,
  Star,
  UsersRound,
} from 'lucide-react';

const navItems = [
  { href: '/admin', label: 'Dashboard', icon: Home, badge: undefined },
  { href: '/admin/students', label: 'Students', icon: GraduationCap, badge: undefined },
  { href: '/admin/attendance', label: 'Attendance', icon: CalendarCheck, badge: undefined },
  { href: '/admin/staff', label: 'Staff and parents', icon: UsersRound, badge: undefined },
  { href: '/admin/audit', label: 'Audit', icon: ClipboardList, badge: undefined },
  { href: '/admin', label: 'Behaviour', icon: Star, badge: undefined },
  { href: '/admin', label: 'PACE', icon: BookOpen, badge: undefined },
  { href: '/admin', label: 'Merit Shop', icon: ShoppingBag, badge: undefined },
  { href: '/admin', label: 'Reports', icon: BarChart3, badge: undefined },
  { href: '/admin', label: 'Messages', icon: MessageSquare, badge: '2' },
  { href: '/admin', label: 'Noticeboard', icon: Bell, badge: undefined },
] as const;

type AdminNavProps = {
  canViewAudit: boolean;
};

function isActiveRoute(pathname: string, href: string, label: string) {
  if (href === '/admin') {
    return label === 'Dashboard' && pathname === '/admin';
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminSidebarNav({ canViewAudit }: AdminNavProps) {
  const pathname = usePathname();
  const visibleNavItems = navItems.filter((item) => item.label !== 'Audit' || canViewAudit);

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
            href={item.href}
            key={`${item.label}-${index}`}
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

export function AdminBottomNav({ canViewAudit }: AdminNavProps) {
  const pathname = usePathname();
  const mobileNavItems = navItems.filter((item) => item.label !== 'Audit' || canViewAudit).slice(0, 5);

  return (
    <nav aria-label="Mobile admin sections" className="admin-shell__bottom-nav">
      {mobileNavItems.map((item, index) => {
        const Icon = item.icon;
        const active = isActiveRoute(pathname, item.href, item.label);
        const className = ['admin-shell__bottom-item', active ? 'is-active' : undefined].filter(Boolean).join(' ');

        return (
          <Link
            aria-current={active ? 'page' : undefined}
            className={className}
            href={item.href}
            key={`${item.label}-${index}`}
          >
            <Icon aria-hidden="true" size={18} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
