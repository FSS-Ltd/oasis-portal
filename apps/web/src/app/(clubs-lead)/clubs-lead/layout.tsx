import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Bell, ClipboardList, Home, Star } from 'lucide-react';
import { prisma } from '@oasis/db';
import { getClubsLeadUser, linkedChildCount } from '@/components/admin/require-full-admin';
import { LogoutButton } from '@/components/auth/logout-button';
import { MobileSideMenu } from '@/components/navigation/mobile-side-menu';
import { PortalViewSwitch } from '@/components/navigation/portal-view-switch';
import { ProfileBadgeLink } from '@/components/profile/profile-badge-link';
import { ProfilePortalMenu } from '@/components/profile/profile-portal-menu';
import { DownloadAppLink } from '@/components/pwa/download-app-link';
import type { PortalProfileHref } from '@/lib/portal-view-routing';
import {
  clubPortalView,
  parentPortalView,
  portalSwitchViewsFrom,
  staffPortalViewForUser,
} from '@/lib/portal-view-routing';
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
  const [linkedChildren, assignedClubLeadCount] = await Promise.all([
    linkedChildCount(user.id),
    prisma.clubLeadAssignment.count({ where: { userId: user.id, club: { active: true } } }),
  ]);
  const staffView = staffPortalViewForUser(user);
  const hasLinkedChildren = linkedChildren > 0;
  const hasAssignedClub = assignedClubLeadCount > 0;
  const portalViews = [
    ...(hasAssignedClub ? [clubPortalView] : []),
    ...(hasLinkedChildren ? [parentPortalView] : []),
    ...(staffView ? [staffView] : []),
  ];
  const portalSwitchViews = portalSwitchViewsFrom(portalViews);
  const profileHref: PortalProfileHref | null =
    user.role === 'Supervisor'
      ? '/supervisor/profile'
      : user.role === 'Parent'
        ? '/parent/profile'
        : staffView
          ? '/admin/profile'
          : null;
  const showProfilePortalMenu = profileHref !== null && portalViews.length > 2;

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
          {profileHref === null ? null : showProfilePortalMenu ? (
            <ProfilePortalMenu profileHref={profileHref} views={portalViews} />
          ) : (
            <ProfileBadgeLink href={profileHref} />
          )}
          {portalSwitchViews ? (
            <PortalViewSwitch activeView="club" variant="sidebar" views={portalSwitchViews} />
          ) : null}
        </div>
        <ClubsLeadNav />
        <div className="admin-shell__foot">
          <DownloadAppLink variant="sidebar" />
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
          <div className="admin-shell__mobile-actions">
            <DownloadAppLink variant="mobile" />
            {portalSwitchViews ? (
              <PortalViewSwitch activeView="club" variant="mobile" views={portalSwitchViews} />
            ) : null}
            {profileHref === null ? null : showProfilePortalMenu ? (
              <ProfilePortalMenu profileHref={profileHref} variant="mobile" views={portalViews} />
            ) : (
              <ProfileBadgeLink href={profileHref} variant="mobile" />
            )}
            <LogoutButton className="logout-button logout-button--mobile" />
          </div>
        </header>
        <main className="admin-shell__main">{children}</main>
      </div>
    </div>
  );
}
