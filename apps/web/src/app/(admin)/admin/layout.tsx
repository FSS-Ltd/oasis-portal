import type { ReactNode } from 'react';
import Link from 'next/link';
import { GraduationCap, UsersRound } from 'lucide-react';
import { assertFullAdmin } from '@/components/admin/require-full-admin';
import './admin.css';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await assertFullAdmin();

  return (
    <div className="admin-shell">
      <header className="admin-shell__topbar">
        <div className="admin-shell__topbar-inner">
          <Link className="admin-shell__brand" href="/admin/students">
            <strong>Oasis Admin</strong>
            <span>Head onboarding</span>
          </Link>
          <nav aria-label="Admin sections" className="admin-shell__nav">
            <Link href="/admin/students">
              <GraduationCap aria-hidden="true" size={17} />
              Students
            </Link>
            <Link href="/admin/staff">
              <UsersRound aria-hidden="true" size={17} />
              Staff and parents
            </Link>
          </nav>
        </div>
      </header>
      <main className="admin-shell__main">{children}</main>
    </div>
  );
}
