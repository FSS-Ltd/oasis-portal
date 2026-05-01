import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  canViewAnyStudentDrillThrough,
  canViewBehaviourReports,
  hasTag,
  isFullAdmin,
} from '@oasis/domain';
import { AdminBottomNav, AdminSidebarNav } from '@/components/admin/admin-nav';
import { getAdminShellUser } from '@/components/admin/require-full-admin';
import { LogoutButton } from '@/components/auth/logout-button';
import './admin.css';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await getAdminShellUser();
  const canViewAudit = hasTag(user, 'audit-viewer');
  const canViewBehaviour = canViewBehaviourReports(user);
  const fullAdmin = isFullAdmin(user);
  const canViewStudents = canViewAnyStudentDrillThrough(user);
  const roleLabel = user.role === 'Head' ? 'Head of Centre' : user.role;

  return (
    <div className="admin-shell">
      <aside className="admin-shell__sidebar" aria-label="Staff portal navigation">
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
          <p>Staff Portal</p>
          <strong>{roleLabel}</strong>
          <span>Phase 1 onboarding</span>
        </div>
        <AdminSidebarNav
          canViewAudit={canViewAudit}
          canViewBehaviour={canViewBehaviour}
          canViewStudents={canViewStudents}
          fullAdmin={fullAdmin}
        />
        <div className="admin-shell__foot">
          <span>Oasis Learning Centre</span>
          <LogoutButton />
        </div>
      </aside>

      <div className="admin-shell__content">
        <header className="admin-shell__mobile-header">
          <Link className="admin-shell__mobile-brand" href="/admin/students">
            <Image alt="Oasis Learning Centre" height={32} src="/oasis-logo.svg" width={84} />
            <span>
              <small>Staff Portal</small>
              <strong>{roleLabel}</strong>
            </span>
          </Link>
          <LogoutButton className="logout-button logout-button--mobile" />
        </header>
        <main className="admin-shell__main">{children}</main>
        <AdminBottomNav
          canViewAudit={canViewAudit}
          canViewBehaviour={canViewBehaviour}
          canViewStudents={canViewStudents}
          fullAdmin={fullAdmin}
        />
      </div>
    </div>
  );
}
