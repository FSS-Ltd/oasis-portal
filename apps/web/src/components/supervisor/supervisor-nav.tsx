'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BookOpenCheck,
  CalendarCheck,
  CalendarDays,
  ClipboardList,
  Home,
  Star,
} from 'lucide-react';

const navItems = [
  { href: '/supervisor', label: 'Dashboard', icon: Home, enabled: true },
  { href: '/supervisor/attendance', label: 'Attendance', icon: CalendarCheck, enabled: true },
  { href: '/supervisor/behaviour', label: 'Behaviour', icon: Star, enabled: true },
  { href: '/supervisor/pace', label: 'PACE', icon: BookOpenCheck, enabled: true },
  { href: '/supervisor/rota', label: 'Rota', icon: CalendarDays, enabled: true },
  { href: '/supervisor/snapshot', label: 'Snapshot', icon: ClipboardList, enabled: true },
] as const;

function isActiveRoute(pathname: string, href: string, label: string) {
  return label === 'Dashboard' ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

export function SupervisorSidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="admin-shell__nav">
      {navItems.map((item) => {
        const Icon = item.icon;
        const active = item.enabled && isActiveRoute(pathname, item.href, item.label);
        const className = [
          'admin-shell__nav-item',
          item.enabled ? undefined : 'is-disabled',
          active ? 'is-active' : undefined,
        ]
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
            <Icon aria-hidden="true" size={18} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function SupervisorBottomNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Mobile supervisor sections" className="admin-shell__bottom-nav">
      {navItems.slice(0, 5).map((item) => {
        const Icon = item.icon;
        const active = item.enabled && isActiveRoute(pathname, item.href, item.label);
        const className = ['admin-shell__bottom-item', active ? 'is-active' : undefined].filter(Boolean).join(' ');

        return (
          <Link
            aria-current={active ? 'page' : undefined}
            aria-disabled={!item.enabled}
            className={className}
            href={{ pathname: item.href }}
            key={item.label}
          >
            <Icon aria-hidden="true" size={18} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
