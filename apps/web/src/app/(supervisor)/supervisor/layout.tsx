import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  canManageClubs,
  canManageInvoices,
  canManageShop,
  canSellInShop,
  canUseClubLeadAccess,
} from '@oasis/domain';
import { prisma } from '@oasis/db';
import { SupervisorBottomNav, SupervisorSidebarNav } from '@/components/supervisor/supervisor-nav';
import { getStaffUser, linkedChildCount } from '@/components/admin/require-full-admin';
import { LogoutButton } from '@/components/auth/logout-button';
import { MobileSideMenu } from '@/components/navigation/mobile-side-menu';
import { PortalViewSwitch } from '@/components/navigation/portal-view-switch';
import { ProfileBadgeLink } from '@/components/profile/profile-badge-link';
import { ProfilePortalMenu } from '@/components/profile/profile-portal-menu';
import {
  clubPortalView,
  parentPortalView,
  portalSwitchViewsFrom,
  staffPortalViewForUser,
} from '@/lib/portal-view-routing';
import { roleLabel } from '@/lib/profile-display';
import '../../(admin)/admin/admin.css';

export const dynamic = 'force-dynamic';

export default async function SupervisorLayout({ children }: { children: ReactNode }) {
  const user = await getStaffUser();
  const userRoleLabel = user.role === 'Supervisor' ? 'Supervisor' : roleLabel(user.role);
  const now = new Date();
  const [linkedChildren, assignedClubLeadCount, unreadMessageCount, unreadNoticeCount] =
    await Promise.all([
      linkedChildCount(user.id),
      canUseClubLeadAccess(user)
        ? prisma.clubLeadAssignment.count({
            where: { userId: user.id, club: { active: true } },
          })
        : Promise.resolve(0),
      prisma.message.count({
        where: {
          senderId: { not: user.id },
          thread: { participants: { some: { userId: user.id } } },
          reads: {
            none: { userId: user.id },
          },
        },
      }),
      prisma.staffNotice.count({
        where: {
          active: true,
          audience: { in: ['Supervisors', 'Both'] },
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          reads: {
            none: { userId: user.id },
          },
        },
      }),
    ]);
  const hasLinkedChildren = linkedChildren > 0;
  const hasAssignedClub = assignedClubLeadCount > 0;
  const staffView = staffPortalViewForUser(user);
  const portalViews = [
    ...(staffView ? [staffView] : []),
    ...(hasLinkedChildren ? [parentPortalView] : []),
    ...(hasAssignedClub ? [clubPortalView] : []),
  ];
  const portalSwitchViews = portalSwitchViewsFrom(portalViews);
  const showProfilePortalMenu = portalViews.length > 2;
  const supervisorNavProps = {
    canManageClubs: canManageClubs(user),
    canManageInvoices: canManageInvoices(user),
    canUseShop: canManageShop(user) || canSellInShop(user),
    unreadMessageCount,
    unreadNoticeCount,
  };

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
          {showProfilePortalMenu ? (
            <ProfilePortalMenu profileHref="/supervisor/profile" views={portalViews} />
          ) : (
            <ProfileBadgeLink href="/supervisor/profile" />
          )}
          {portalSwitchViews ? (
            <PortalViewSwitch activeView="staff" variant="sidebar" views={portalSwitchViews} />
          ) : null}
        </div>
        <SupervisorSidebarNav {...supervisorNavProps} />
        <div className="admin-shell__foot">
          <span>Oasis Learning Centre</span>
          <LogoutButton />
        </div>
      </aside>

      <div className="admin-shell__content">
        <header className="admin-shell__mobile-header">
          <MobileSideMenu
            menuLabel="Open supervisor navigation menu"
            subtitle={userRoleLabel}
            title="Supervisor Portal"
          >
            <SupervisorSidebarNav {...supervisorNavProps} />
          </MobileSideMenu>
          <Link className="admin-shell__mobile-brand" href="/supervisor">
            <Image alt="Oasis Learning Centre" height={32} src="/oasis-logo.svg" width={84} />
            <span>
              <small>Supervisor Portal</small>
              <strong>{userRoleLabel}</strong>
            </span>
          </Link>
          <div className="admin-shell__mobile-actions">
            {portalSwitchViews ? (
              <PortalViewSwitch activeView="staff" variant="mobile" views={portalSwitchViews} />
            ) : null}
            {showProfilePortalMenu ? (
              <ProfilePortalMenu
                profileHref="/supervisor/profile"
                variant="mobile"
                views={portalViews}
              />
            ) : (
              <ProfileBadgeLink href="/supervisor/profile" variant="mobile" />
            )}
            <LogoutButton className="logout-button logout-button--mobile" />
          </div>
        </header>
        <main className="admin-shell__main">{children}</main>
        <SupervisorBottomNav {...supervisorNavProps} />
      </div>
    </div>
  );
}
