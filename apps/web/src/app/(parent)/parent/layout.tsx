import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { prisma } from '@oasis/db';
import { canUseClubLeadAccess } from '@oasis/domain';
import { getLinkedChildPortalUser, linkedChildCount } from '@/components/admin/require-full-admin';
import { LogoutButton } from '@/components/auth/logout-button';
import { MobileSideMenu } from '@/components/navigation/mobile-side-menu';
import { PortalViewSwitch } from '@/components/navigation/portal-view-switch';
import { ParentBottomNav, ParentSidebarNav, ParentTopNav } from '@/components/parent/parent-nav';
import { ProfileBadgeLink } from '@/components/profile/profile-badge-link';
import { ProfilePortalMenu } from '@/components/profile/profile-portal-menu';
import { DownloadAppLink } from '@/components/pwa/download-app-link';
import {
  clubPortalView,
  parentPortalView,
  portalSwitchViewsFrom,
  staffPortalViewForUser,
} from '@/lib/portal-view-routing';
import '../../(admin)/admin/admin.css';
import './parent.css';

export const dynamic = 'force-dynamic';

export default async function ParentLayout({ children }: { children: ReactNode }) {
  const user = await getLinkedChildPortalUser();
  const now = new Date();
  const [linkedChildren, assignedClubLeadCount, unreadNoticeCount, unreadMessageCount] =
    await Promise.all([
      linkedChildCount(user.id),
      canUseClubLeadAccess(user)
        ? prisma.clubLeadAssignment.count({
            where: { userId: user.id, club: { active: true } },
          })
        : Promise.resolve(0),
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
          thread: {
            kind: 'ParentStaff',
            parentId: user.id,
            participants: { some: { userId: user.id } },
          },
          reads: {
            none: { userId: user.id },
          },
        },
      }),
    ]);
  const parentNavProps = { unreadMessageCount, unreadNoticeCount };
  const hasLinkedChildren = linkedChildren > 0;
  const hasAssignedClub = assignedClubLeadCount > 0;
  const staffView = staffPortalViewForUser(user);
  const portalViews = [
    ...(hasLinkedChildren ? [parentPortalView] : []),
    ...(staffView ? [staffView] : []),
    ...(hasAssignedClub ? [clubPortalView] : []),
  ];
  const portalSwitchViews = portalSwitchViewsFrom(portalViews);
  const showProfilePortalMenu = portalViews.length > 2;

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
            <DownloadAppLink variant="topbar" />
            {portalSwitchViews ? (
              <PortalViewSwitch activeView="parent" variant="topbar" views={portalSwitchViews} />
            ) : null}
            {showProfilePortalMenu ? (
              <ProfilePortalMenu
                profileHref="/parent/profile"
                variant="topbar"
                views={portalViews}
              />
            ) : (
              <ProfileBadgeLink href="/parent/profile" variant="topbar" />
            )}
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
            <DownloadAppLink variant="mobile" />
            {portalSwitchViews ? (
              <PortalViewSwitch activeView="parent" variant="mobile" views={portalSwitchViews} />
            ) : null}
            {showProfilePortalMenu ? (
              <ProfilePortalMenu
                profileHref="/parent/profile"
                variant="mobile"
                views={portalViews}
              />
            ) : (
              <ProfileBadgeLink href="/parent/profile" variant="mobile" />
            )}
            <LogoutButton className="logout-button logout-button--mobile" />
          </div>
        </header>
        <main className="admin-shell__main">{children}</main>
        <ParentBottomNav {...parentNavProps} />
      </div>
    </div>
  );
}
