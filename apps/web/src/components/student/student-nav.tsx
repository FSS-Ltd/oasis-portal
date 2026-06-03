'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpenCheck, Home, Medal, ShoppingBag, Wallet } from 'lucide-react';

const studentNavItems = [
  { href: '/student', label: 'Home', icon: Home },
  { href: '/student/wallet', label: 'Wallet', icon: Wallet },
  { href: '/student/pace', label: 'PACE', icon: BookOpenCheck },
  { href: '/student/ranks', label: 'Ranks', icon: Medal },
  { href: '/student/shop', label: 'Shop', icon: ShoppingBag },
] as const;

const navIconSize = 16;

function isActiveRoute(pathname: string, href: string) {
  return href === '/student'
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);
}

export function StudentTopNav() {
  const pathname = usePathname() ?? '';

  return (
    <nav aria-label="Student portal sections" className="student-top-nav">
      {studentNavItems.map((item) => {
        const active = isActiveRoute(pathname, item.href);
        const Icon = item.icon;

        return (
          <Link
            aria-current={active ? 'page' : undefined}
            className={active ? 'student-top-nav__item is-active' : 'student-top-nav__item'}
            href={item.href}
            key={item.href}
          >
            <Icon aria-hidden="true" size={navIconSize} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function StudentSidebarNav() {
  const pathname = usePathname() ?? '';

  return (
    <nav className="admin-shell__nav">
      {studentNavItems.map((item) => {
        const Icon = item.icon;
        const active = isActiveRoute(pathname, item.href);
        const className = ['admin-shell__nav-item', active ? 'is-active' : undefined]
          .filter(Boolean)
          .join(' ');

        return (
          <Link
            aria-current={active ? 'page' : undefined}
            className={className}
            href={item.href}
            key={item.href}
          >
            <Icon aria-hidden="true" size={navIconSize} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function StudentBottomNav() {
  const pathname = usePathname() ?? '';

  return (
    <nav aria-label="Mobile student sections" className="admin-shell__bottom-nav">
      {studentNavItems.map((item) => {
        const Icon = item.icon;
        const active = isActiveRoute(pathname, item.href);
        const className = ['admin-shell__bottom-item', active ? 'is-active' : undefined]
          .filter(Boolean)
          .join(' ');

        return (
          <Link
            aria-current={active ? 'page' : undefined}
            className={className}
            href={item.href}
            key={item.href}
          >
            <Icon aria-hidden="true" size={navIconSize} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
