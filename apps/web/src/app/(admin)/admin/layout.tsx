import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  canViewAnyStudentDrillThrough,
  canViewBehaviourReports,
  canExportAttendance,
  canManageCalendar,
  canManageClubs,
  canManageInvoices,
  canManagePermissionSlips,
  canManageShop,
  canUseAdminOperations,
  canUseClubLeadAccess,
  canRespondToParentMessages,
  canUseStaffMessaging,
  canUseFullPaceAccess,
  canManageUserAccounts,
  canSellInShop,
  canViewAuditLog,
  isFullAdmin,
} from '@oasis/domain';
import { prisma } from '@oasis/db';
import { AdminBottomNav, AdminSidebarNav } from '@/components/admin/admin-nav';
import { getAdminShellUser, linkedChildCount } from '@/components/admin/require-full-admin';
import { LogoutButton } from '@/components/auth/logout-button';
import { MobileSideMenu } from '@/components/navigation/mobile-side-menu';
import { PortalViewSwitch } from '@/components/navigation/portal-view-switch';
import { ProfileBadgeLink } from '@/components/profile/profile-badge-link';
import { ProfilePortalMenu } from '@/components/profile/profile-portal-menu';
import { DownloadAppLink } from '@/components/pwa/download-app-link';
import {
  clubPortalView,
  parentPortalView,
  portalSwitchViewsFrom,
  staffPortalViewForUser,
} from '@/lib/portal-view-routing';
import { roleLabel } from '@/lib/profile-display';
import './admin.css';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await getAdminShellUser();
  const canViewAudit = canViewAuditLog(user);
  const canViewBehaviour = canViewBehaviourReports(user);
  const fullAdmin = isFullAdmin(user);
  const adminOperations = canUseAdminOperations(user);
  const canViewStudents = canViewAnyStudentDrillThrough(user);
  const canViewPace = canUseFullPaceAccess(user);
  const canManageAccounts = canManageUserAccounts(user);
  const canExportAttendanceCsv = canExportAttendance(user);
  const canManageCalendarDates = canManageCalendar(user);
  const canManageClubModule = canManageClubs(user);
  const canManageInvoiceModule = canManageInvoices(user);
  const canManagePermissionSlipModule = canManagePermissionSlips(user);
  const canUseShop = canManageShop(user) || canSellInShop(user);
  const canUseMessages = canRespondToParentMessages(user) || canUseStaffMessaging(user);
  const [linkedChildren, assignedClubLeadCount, unreadMessageCount] = await Promise.all([
    linkedChildCount(user.id),
    canUseClubLeadAccess(user)
      ? prisma.clubLeadAssignment.count({
          where: { userId: user.id, club: { active: true } },
        })
      : Promise.resolve(0),
    canUseMessages
      ? prisma.message.count({
          where: {
            senderId: { not: user.id },
            thread: { participants: { some: { userId: user.id } } },
            reads: {
              none: { userId: user.id },
            },
          },
        })
      : Promise.resolve(0),
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
  const userRoleLabel = roleLabel(user.role);
  const homeHref = adminOperations
    ? '/admin'
    : canManageAccounts
      ? '/admin/access'
      : canViewStudents
        ? '/admin/students'
        : canViewBehaviour
          ? '/admin/behaviour'
          : canViewPace
            ? '/admin/pace'
            : canManageCalendarDates
              ? '/admin/calendar'
              : canManageClubModule
                ? '/admin/clubs'
                : canManagePermissionSlipModule
                  ? '/admin/permission-slips'
                  : canManageInvoiceModule
                    ? '/admin/invoices'
                    : canUseShop
                      ? '/admin/shop'
                      : '/admin/profile';
  const adminNavProps = {
    canManageClubs: canManageClubModule,
    canManageInvoices: canManageInvoiceModule,
    canManagePermissionSlips: canManagePermissionSlipModule,
    canUseShop,
    canUseAdminOperations: adminOperations,
    canManageUserAccounts: canManageAccounts,
    canUseMessages,
    canViewAudit,
    canViewBehaviour,
    canViewPace,
    canViewStudents,
    canExportAttendance: canExportAttendanceCsv,
    clubsOnly: user.role === 'ClubsAdmin',
    fullAdmin,
    unreadMessageCount,
  };

  return (
    <div className="admin-shell">
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
          <span>Centre operations</span>
          {showProfilePortalMenu ? (
            <ProfilePortalMenu profileHref="/admin/profile" views={portalViews} />
          ) : (
            <ProfileBadgeLink href="/admin/profile" />
          )}
          {portalSwitchViews ? (
            <PortalViewSwitch activeView="staff" variant="sidebar" views={portalSwitchViews} />
          ) : null}
        </div>
        <AdminSidebarNav {...adminNavProps} />
        <div className="admin-shell__foot">
          <DownloadAppLink variant="sidebar" />
          <span>Oasis Learning Centre</span>
          <LogoutButton />
        </div>
      </aside>

      <div className="admin-shell__content">
        <header className="admin-shell__mobile-header">
          <MobileSideMenu
            menuLabel="Open admin navigation menu"
            subtitle={userRoleLabel}
            title="Supervisor Portal"
          >
            <AdminSidebarNav {...adminNavProps} />
          </MobileSideMenu>
          <Link className="admin-shell__mobile-brand" href={homeHref}>
            <Image alt="Oasis Learning Centre" height={32} src="/oasis-logo.svg" width={84} />
            <span>
              <small>Supervisor Portal</small>
              <strong>{userRoleLabel}</strong>
            </span>
          </Link>
          <div className="admin-shell__mobile-actions">
            <DownloadAppLink variant="mobile" />
            {portalSwitchViews ? (
              <PortalViewSwitch activeView="staff" variant="mobile" views={portalSwitchViews} />
            ) : null}
            {showProfilePortalMenu ? (
              <ProfilePortalMenu
                profileHref="/admin/profile"
                variant="mobile"
                views={portalViews}
              />
            ) : (
              <ProfileBadgeLink href="/admin/profile" variant="mobile" />
            )}
            <LogoutButton className="logout-button logout-button--mobile" />
          </div>
        </header>
        <main className="admin-shell__main">{children}</main>
        <AdminBottomNav {...adminNavProps} />
      </div>
    </div>
  );
}
