import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { getStudentUser } from '@/components/admin/require-full-admin';
import { LogoutButton } from '@/components/auth/logout-button';
import { MobileSideMenu } from '@/components/navigation/mobile-side-menu';
import {
  StudentBottomNav,
  StudentSidebarNav,
  StudentTopNav,
} from '@/components/student/student-nav';
import { StudentPortalGate } from '@/components/student/student-portal-gate';
import '../../(admin)/admin/admin.css';
import './student.css';

export const dynamic = 'force-dynamic';

export default async function StudentLayout({ children }: { children: ReactNode }) {
  await getStudentUser();

  return (
    <div className="admin-shell student-shell">
      <div className="student-shell__content">
        <header className="student-topbar">
          <Link className="student-topbar__brand" href="/student">
            <Image
              alt="Oasis Learning Centre"
              height={32}
              priority
              src="/oasis-logo.svg"
              width={128}
            />
          </Link>
          <StudentTopNav />
          <div className="student-topbar__actions">
            <LogoutButton className="student-topbar__logout" />
          </div>
        </header>

        <header className="admin-shell__mobile-header student-mobile-header">
          <MobileSideMenu
            menuLabel="Open student navigation menu"
            subtitle="Student account"
            title="Student Portal"
          >
            <StudentSidebarNav />
          </MobileSideMenu>
          <Link className="admin-shell__mobile-brand" href="/student">
            <Image alt="Oasis Learning Centre" height={32} src="/oasis-logo.svg" width={84} />
            <span>
              <small>Student Portal</small>
              <strong>My Oasis</strong>
            </span>
          </Link>
          <div className="admin-shell__mobile-actions">
            <LogoutButton className="logout-button logout-button--mobile" />
          </div>
        </header>

        <main className="admin-shell__main student-shell__main">
          <StudentPortalGate>{children}</StudentPortalGate>
        </main>
        <StudentBottomNav />
      </div>
    </div>
  );
}
