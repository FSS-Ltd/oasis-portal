import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { SupervisorBottomNav, SupervisorSidebarNav } from '@/components/supervisor/supervisor-nav';
import { getStaffUser, linkedChildCount } from '@/components/admin/require-full-admin';
import { LogoutButton } from '@/components/auth/logout-button';
import { ProfileBadgeLink } from '@/components/profile/profile-badge-link';
import { roleLabel } from '@/lib/profile-display';
import '../../(admin)/admin/admin.css';

export const dynamic = 'force-dynamic';

export default async function SupervisorLayout({ children }: { children: ReactNode }) {
  const user = await getStaffUser();
  const userRoleLabel = user.role === 'Supervisor' ? 'Supervisor' : roleLabel(user.role);
  const hasLinkedChildren = (await linkedChildCount(user.id)) > 0;

  return (
    <div className="admin-shell supervisor-shell">
      <aside className="admin-shell__sidebar" aria-label="Supervisor portal navigation">
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
          <p>Supervisor Portal</p>
          <strong>{userRoleLabel}</strong>
          <span>Daily operations</span>
          <ProfileBadgeLink href="/supervisor/profile" />
        </div>
        <SupervisorSidebarNav hasLinkedChildren={hasLinkedChildren} />
        <div className="admin-shell__foot">
          <span>Oasis Learning Centre</span>
          <LogoutButton />
        </div>
      </aside>

      <div className="admin-shell__content">
        <header className="admin-shell__mobile-header">
          <Link className="admin-shell__mobile-brand" href="/supervisor">
            <Image alt="Oasis Learning Centre" height={32} src="/oasis-logo.svg" width={84} />
            <span>
              <small>Supervisor Portal</small>
              <strong>{userRoleLabel}</strong>
            </span>
          </Link>
          <div className="admin-shell__mobile-actions">
            <ProfileBadgeLink href="/supervisor/profile" variant="mobile" />
            <LogoutButton className="logout-button logout-button--mobile" />
          </div>
        </header>
        <main className="admin-shell__main">{children}</main>
        <SupervisorBottomNav hasLinkedChildren={hasLinkedChildren} />
      </div>
    </div>
  );
}
