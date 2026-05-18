import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { prisma } from '@oasis/db';
import { getLinkedChildPortalUser } from '@/components/admin/require-full-admin';
import { LogoutButton } from '@/components/auth/logout-button';
import { MobileSideMenu } from '@/components/navigation/mobile-side-menu';
import { ParentBottomNav, ParentSidebarNav, ParentTopNav } from '@/components/parent/parent-nav';
import { ProfileBadgeLink } from '@/components/profile/profile-badge-link';
import '../../(admin)/admin/admin.css';
import './parent.css';

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
        thread: { kind: 'ParentStaff', parentId: user.id, participants: { some: { userId: user.id } } },
        reads: {
          none: { userId: user.id },
        },
      },
    }),
  ]);
  const parentNavProps = { unreadMessageCount, unreadNoticeCount };

  return (
    <div className="admin-shell parent-shell">
      <div className="admin-shell__content">
        <header className="parent-topbar">
          <Link className="parent-topbar__brand" href="/parent">
            <Image
              alt="Oasis Learning Centre"
              height={32}
              priority
              src="/oasis-logo.svg"
              width={128}
            />
          </Link>
          <ParentTopNav {...parentNavProps} />
          <div className="parent-topbar__actions">
            <ProfileBadgeLink href="/parent/profile" variant="topbar" />
            <LogoutButton className="parent-topbar__logout" />
          </div>
        </header>

        <header className="admin-shell__mobile-header">
          <MobileSideMenu
            menuLabel="Open parent navigation menu"
            subtitle="Linked children"
            title="Parent Portal"
          >
            <ParentSidebarNav {...parentNavProps} />
          </MobileSideMenu>
          <Link className="admin-shell__mobile-brand" href="/parent">
            <Image alt="Oasis Learning Centre" height={32} src="/oasis-logo.svg" width={84} />
            <span>
              <small>Parent Portal</small>
              <strong>Linked children</strong>
            </span>
          </Link>
          <div className="admin-shell__mobile-actions">
            <ProfileBadgeLink href="/parent/profile" variant="mobile" />
            <LogoutButton className="logout-button logout-button--mobile" />
          </div>
        </header>
        <main className="admin-shell__main">{children}</main>
        <ParentBottomNav {...parentNavProps} />
      </div>
    </div>
  );
}
