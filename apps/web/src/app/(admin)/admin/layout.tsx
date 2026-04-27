import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  BarChart3,
  Bell,
  BookOpen,
  ClipboardList,
  GraduationCap,
  Home,
  MessageSquare,
  ShoppingBag,
  Star,
  UsersRound,
} from 'lucide-react';
import { assertFullAdmin } from '@/components/admin/require-full-admin';
import './admin.css';

export const dynamic = 'force-dynamic';

const navItems = [
  { href: '/admin', label: 'Dashboard', icon: Home, badge: undefined },
  { href: '/admin/students', label: 'Students', icon: GraduationCap, badge: undefined },
  { href: '/admin/staff', label: 'Staff and parents', icon: UsersRound, badge: undefined },
  { href: '/admin/audit', label: 'Audit', icon: ClipboardList, badge: undefined },
  { href: '/admin', label: 'Behaviour', icon: Star, badge: undefined },
  { href: '/admin', label: 'PACE', icon: BookOpen, badge: undefined },
  { href: '/admin', label: 'Merit Shop', icon: ShoppingBag, badge: undefined },
  { href: '/admin', label: 'Reports', icon: BarChart3, badge: undefined },
  { href: '/admin', label: 'Messages', icon: MessageSquare, badge: '2' },
  { href: '/admin', label: 'Noticeboard', icon: Bell, badge: undefined },
] as const;

const mobileNavItems = navItems.slice(0, 5);

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await assertFullAdmin();

  return (
    <div className="admin-shell">
      <aside className="admin-shell__sidebar" aria-label="Staff portal navigation">
        <div className="admin-shell__profile">
          <Image
            alt="Oasis Learning Centre"
            className="admin-shell__logo"
            height={88}
            priority
            src="/oasis-logo.svg"
            width={180}
          />
          <p>Staff Portal</p>
          <strong>Head of Centre</strong>
          <span>Phase 1 onboarding</span>
        </div>
        <nav className="admin-shell__nav">
          {navItems.map((item, index) => {
            const Icon = item.icon;
            const enabled = item.href !== '/admin' || item.label === 'Dashboard';
            return (
              <Link
                aria-disabled={!enabled}
                className={index < 3 ? 'admin-shell__nav-item' : 'admin-shell__nav-item is-disabled'}
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
        <div className="admin-shell__foot">Oasis Learning Centre</div>
      </aside>

      <div className="admin-shell__content">
        <header className="admin-shell__mobile-header">
          <Link className="admin-shell__mobile-brand" href="/admin/students">
            <Image alt="Oasis Learning Centre" height={32} src="/oasis-logo.svg" width={84} />
            <span>
              <small>Staff Portal</small>
              <strong>Head of Centre</strong>
            </span>
          </Link>
        </header>
        <main className="admin-shell__main">{children}</main>
        <nav aria-label="Mobile admin sections" className="admin-shell__bottom-nav">
          {mobileNavItems.map((item, index) => {
            const Icon = item.icon;
            return (
              <Link className="admin-shell__bottom-item" href={item.href} key={`${item.label}-${index}`}>
                <Icon aria-hidden="true" size={18} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
