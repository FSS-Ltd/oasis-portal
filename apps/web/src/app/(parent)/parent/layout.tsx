import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { prisma } from '@oasis/db';
import { getLinkedChildPortalUser } from '@/components/admin/require-full-admin';
import { LogoutButton } from '@/components/auth/logout-button';
import { ParentBottomNav, ParentSidebarNav } from '@/components/parent/parent-nav';
import { ProfileBadgeLink } from '@/components/profile/profile-badge-link';
import '../../(admin)/admin/admin.css';

export const dynamic = 'force-dynamic';

export default async function ParentLayout({ children }: { children: ReactNode }) {
  const user = await getLinkedChildPortalUser();
  const now = new Date();
  const [unreadNoticeCount, unreadMessageCount] = await Promise.all([
    prisma.staffNotice.count({
      where: {
        active: true,
        audience: { in: ['Parents', 'Both'] },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        reads: {
          none: { userId: user.id },
        },
      },
    }),
    prisma.message.count({
      where: {
        senderId: { not: user.id },
        thread: { parentId: user.id },
        reads: {
          none: { userId: user.id },
        },
      },
    }),
  ]);

  return (
    <div className="admin-shell parent-shell">
      <aside className="admin-shell__sidebar" aria-label="Parent portal navigation">
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
          <p>My Children</p>
          <strong>Guardian access</strong>
          <span>Linked children only</span>
          <ProfileBadgeLink href="/parent/profile" />
        </div>
        <ParentSidebarNav
          unreadMessageCount={unreadMessageCount}
          unreadNoticeCount={unreadNoticeCount}
        />
        <div className="admin-shell__foot">
          <span>Oasis Learning Centre</span>
          <LogoutButton />
        </div>
      </aside>

      <div className="admin-shell__content">
        <header className="admin-shell__mobile-header">
          <Link className="admin-shell__mobile-brand" href="/parent">
            <Image alt="Oasis Learning Centre" height={32} src="/oasis-logo.svg" width={84} />
            <span>
              <small>My Children</small>
              <strong>Linked children</strong>
            </span>
          </Link>
          <div className="admin-shell__mobile-actions">
            <ProfileBadgeLink href="/parent/profile" variant="mobile" />
            <LogoutButton className="logout-button logout-button--mobile" />
          </div>
        </header>
        <main className="admin-shell__main">{children}</main>
        <ParentBottomNav
          unreadMessageCount={unreadMessageCount}
          unreadNoticeCount={unreadNoticeCount}
        />
      </div>
    </div>
  );
}
