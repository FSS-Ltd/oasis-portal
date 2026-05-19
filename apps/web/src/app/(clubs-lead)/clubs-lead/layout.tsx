import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Bell, ClipboardList, Home, Star } from 'lucide-react';
import { getClubsLeadUser } from '@/components/admin/require-full-admin';
import { LogoutButton } from '@/components/auth/logout-button';
import { MobileSideMenu } from '@/components/navigation/mobile-side-menu';
import { roleLabel } from '@/lib/profile-display';
import '../../(admin)/admin/admin.css';

export const dynamic = 'force-dynamic';

const navItems = [
  { href: '/clubs-lead', label: 'Overview', icon: Home },
  { href: '/clubs-lead?tab=behaviour', label: 'Behaviour', icon: Star },
  { href: '/clubs-lead?tab=attendance', label: 'Attendance', icon: ClipboardList },
  { href: '/clubs-lead?tab=noticeboard', label: 'Noticeboard', icon: Bell },
] as const;

function ClubsLeadNav() {
  return (
    <nav className="admin-shell__nav clubs-lead-shell__nav">
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <Link className="admin-shell__nav-item" href={item.href} key={item.label}>
            <Icon aria-hidden="true" size={15} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export default async function ClubsLeadLayout({ children }: { children: ReactNode }) {
  const user = await getClubsLeadUser();
  const userRoleLabel = roleLabel(user.role);

  return (
    <div className="admin-shell clubs-lead-shell">
      <aside
        className="admin-shell__sidebar clubs-lead-shell__sidebar"
        aria-label="Clubs Lead portal navigation"
      >
        <div className="admin-shell__profile">
          <div className="admin-shell__logo-frame">
            <Image
              alt="Oasis Learning Centre"
              className="admin-shell__logo"
              height={88}
              priority
              src="/oasis-logo.svg"
              width={180}
            />
          </div>
          <p>Clubs Lead Portal</p>
          <strong>{userRoleLabel}</strong>
          <span>Assigned clubs</span>
        </div>
        <ClubsLeadNav />
        <div className="admin-shell__foot">
          <span>Oasis Learning Centre</span>
          <LogoutButton />
        </div>
      </aside>

      <div className="admin-shell__content">
        <header className="admin-shell__mobile-header clubs-lead-shell__mobile-header">
          <MobileSideMenu
            menuLabel="Open Clubs Lead navigation menu"
            subtitle={userRoleLabel}
            title="Clubs Lead Portal"
          >
            <ClubsLeadNav />
          </MobileSideMenu>
          <Link className="admin-shell__mobile-brand" href="/clubs-lead">
            <Image alt="Oasis Learning Centre" height={32} src="/oasis-logo.svg" width={84} />
            <span>
              <small>Clubs Lead Portal</small>
              <strong>{userRoleLabel}</strong>
            </span>
          </Link>
          <LogoutButton className="logout-button logout-button--mobile" />
        </header>
        <main className="admin-shell__main">{children}</main>
      </div>
    </div>
  );
}
