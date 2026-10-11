import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { getComplianceUser } from '@/components/admin/require-full-admin';
import { LogoutButton } from '@/components/auth/logout-button';
import { roleLabel } from '@/lib/profile-display';
import { ComplianceNav } from './compliance-nav';
import '../(admin)/admin/admin.css';
import './compliance.css';

export const dynamic = 'force-dynamic';

export default async function ComplianceLayout({ children }: { children: ReactNode }) {
  const user = await getComplianceUser();

  return (
    <div className="admin-shell compliance-shell">
      <aside
        className="admin-shell__sidebar compliance-shell__sidebar"
        aria-label="Compliance navigation"
      >
        <div className="admin-shell__profile">
          <div className="admin-shell__logo-frame">
            <Image
              alt="Oasis Learning Centre"
              height={88}
              priority
              src="/oasis-logo.svg"
              width={180}
            />
          </div>
          <p>Compliance</p>
          <strong>{roleLabel(user.role)}</strong>
          <span>Safeguarding records</span>
        </div>
        <ComplianceNav />
        <div className="admin-shell__foot">
          {user.role === 'Supervisor' ? <Link href="/supervisor">Back to portal</Link> : null}
          {user.role === 'Head' || user.role === 'Pastor' ? (
            <Link href="/admin">Back to portal</Link>
          ) : null}
          <LogoutButton />
        </div>
      </aside>
      <div className="admin-shell__content">
        <header className="compliance-shell__mobile-header">
          <Image alt="Oasis Learning Centre" height={36} src="/oasis-logo.svg" width={90} />
          <strong>Compliance</strong>
          {user.role === 'Supervisor' ? <Link href="/supervisor">Portal</Link> : null}
          {user.role === 'Head' || user.role === 'Pastor' ? (
            <Link href="/admin">Portal</Link>
          ) : null}
          <LogoutButton />
        </header>
        <div className="compliance-shell__mobile-nav">
          <ComplianceNav />
        </div>
        <main className="admin-shell__main">{children}</main>
      </div>
    </div>
  );
}
