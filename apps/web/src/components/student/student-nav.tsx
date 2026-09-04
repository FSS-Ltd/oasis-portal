'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BookOpenCheck,
  BookOpenText,
  CalendarCheck,
  Bell,
  ClipboardList,
  Home,
  Medal,
  MessageCircle,
  ShoppingBag,
  Smartphone,
  TrendingUp,
  Table2,
  UsersRound,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { api } from '@/lib/trpc';

const studentNavItems = [
  { href: '/student', label: 'Home', icon: Home },
  { href: '/student/notifications', label: 'Updates', icon: Bell, badge: true },
  { href: '/student/wallet', label: 'Wallet', icon: Wallet },
  { href: '/student/invest', label: 'Merit Markets', icon: TrendingUp },
  { href: '/student/pace', label: 'PACE', icon: BookOpenCheck },
  { href: '/student/homework', label: 'Homework', icon: ClipboardList },
  { href: '/student/timetable', label: 'Timetable', icon: Table2 },
  { href: '/student/community', label: 'Community', icon: MessageCircle },
  { href: '/student/attendance', label: 'Attendance', icon: CalendarCheck },
  { href: '/student/clubs', label: 'Clubs', icon: UsersRound },
  { href: '/student/faith', label: 'Faith', icon: BookOpenText },
  { href: '/student/ranks', label: 'Ranks', icon: Medal },
  { href: '/student/shop', label: 'Shop', icon: ShoppingBag },
  { href: '/mobile-app', label: 'Mobile App', icon: Smartphone },
] as const;

type StudentNavItem = (typeof studentNavItems)[number];
type StudentNavLinkVariant = 'bottom' | 'side' | 'top';

const studentBottomNavHrefs = [
  '/student',
  '/student/community',
  '/student/faith',
  '/student/wallet',
  '/student/shop',
] as const;

const navIconSize = 16;

function useVisibleStudentNavItems() {
  const profile = api.student.me.useQuery(undefined, { retry: false });
  const academicScreensEnabled = profile.data?.academicScreensEnabled ?? false;

  return studentNavItems.filter(
    (item) =>
      (item.href !== '/student/pace' && item.href !== '/student/attendance') ||
      academicScreensEnabled,
  );
}

function isActiveRoute(pathname: string, href: string) {
  return href === '/student'
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);
}

function countBadge(count: number | undefined): string | null {
  if (!count || count <= 0) return null;
  return count > 99 ? '99+' : String(count);
}

function useStudentNotificationBadge(): string | null {
  const unread = api.studentNotification.unreadCount.useQuery(undefined, { retry: false });
  return countBadge(unread.data?.count);
}

function badgeForItem(item: (typeof studentNavItems)[number], unreadBadge: string | null) {
  return 'badge' in item ? unreadBadge : null;
}

function navItemClassName(variant: StudentNavLinkVariant, active: boolean): string {
  const baseClassName =
    variant === 'top'
      ? 'student-top-nav__item'
      : variant === 'bottom'
        ? 'admin-shell__bottom-item'
        : 'admin-shell__nav-item';

  return [baseClassName, active ? 'is-active' : undefined].filter(Boolean).join(' ');
}

function StudentNavLink({
  active,
  badge,
  icon: Icon,
  href,
  label,
  variant,
}: {
  active: boolean;
  badge?: string | null;
  href: string;
  icon: LucideIcon;
  label: string;
  variant: StudentNavLinkVariant;
}) {
  return (
    <Link
      aria-current={active ? 'page' : undefined}
      className={navItemClassName(variant, active)}
      href={{ pathname: href }}
    >
      <Icon aria-hidden="true" size={navIconSize} />
      <span>{label}</span>
      {badge ? <b>{badge}</b> : null}
    </Link>
  );
}

export function StudentTopNav() {
  const pathname = usePathname() ?? '';
  const unreadBadge = useStudentNotificationBadge();
  const navItems = useVisibleStudentNavItems();

  return (
    <nav aria-label="Student portal sections" className="student-top-nav">
      {navItems.map((item) => {
        const active = isActiveRoute(pathname, item.href);
        return (
          <StudentNavLink
            active={active}
            badge={badgeForItem(item, unreadBadge)}
            href={item.href}
            icon={item.icon}
            key={item.href}
            label={item.label}
            variant="top"
          />
        );
      })}
    </nav>
  );
}

export function StudentSidebarNav() {
  const pathname = usePathname() ?? '';
  const unreadBadge = useStudentNotificationBadge();
  const navItems = useVisibleStudentNavItems();

  return (
    <nav className="admin-shell__nav">
      {navItems.map((item) => {
        const active = isActiveRoute(pathname, item.href);

        return (
          <StudentNavLink
            active={active}
            badge={badgeForItem(item, unreadBadge)}
            href={item.href}
            icon={item.icon}
            key={item.href}
            label={item.label}
            variant="side"
          />
        );
      })}
    </nav>
  );
}

export function StudentBottomNav() {
  const pathname = usePathname() ?? '';
  const visibleItems = useVisibleStudentNavItems();
  const navItems = studentBottomNavHrefs
    .map((href) => visibleItems.find((item) => item.href === href))
    .filter((item): item is StudentNavItem => Boolean(item));

  return (
    <nav aria-label="Mobile student sections" className="admin-shell__bottom-nav">
      {navItems.map((item) => {
        const active = isActiveRoute(pathname, item.href);

        return (
          <StudentNavLink
            active={active}
            href={item.href}
            icon={item.icon}
            key={item.href}
            label={item.label}
            variant="bottom"
          />
        );
      })}
    </nav>
  );
}
