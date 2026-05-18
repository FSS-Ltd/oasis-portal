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
  canManageShop,
  canRespondToParentMessages,
  canUseFullPaceAccess,
  canManageUserAccounts,
  canSellInShop,
  hasTag,
  isFullAdmin,
} from '@oasis/domain';
import { prisma } from '@oasis/db';
import { AdminBottomNav, AdminSidebarNav } from '@/components/admin/admin-nav';
import { getAdminShellUser, linkedChildCount } from '@/components/admin/require-full-admin';
import { LogoutButton } from '@/components/auth/logout-button';
import { MobileSideMenu } from '@/components/navigation/mobile-side-menu';
import { ProfileBadgeLink } from '@/components/profile/profile-badge-link';
import { roleLabel } from '@/lib/profile-display';
import './admin.css';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await getAdminShellUser();
  const canViewAudit = hasTag(user, 'audit-viewer');
  const canViewBehaviour = canViewBehaviourReports(user);
  const fullAdmin = isFullAdmin(user);
  const canViewStudents = canViewAnyStudentDrillThrough(user);
  const canViewPace = canUseFullPaceAccess(user);
  const canManageAccounts = canManageUserAccounts(user);
  const canExportAttendanceCsv = canExportAttendance(user);
  const canManageCalendarDates = canManageCalendar(user);
  const canManageClubModule = canManageClubs(user);
  const canManageInvoiceModule = canManageInvoices(user);
  const canUseShop = canManageShop(user) || canSellInShop(user);
  const canUseMessages = canRespondToParentMessages(user);
  const [linkedChildren, unreadMessageCount] = await Promise.all([
    linkedChildCount(user.id),
    canUseMessages
      ? prisma.message.count({
          where: {
            senderId: { not: user.id },
            ...(fullAdmin ? {} : { thread: { adminId: user.id } }),
            reads: {
              none: { userId: user.id },
            },
          },
        })
      : Promise.resolve(0),
  ]);
  const hasLinkedChildren = linkedChildren > 0;
  const userRoleLabel = roleLabel(user.role);
  const homeHref = fullAdmin
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
                : canManageInvoiceModule
                  ? '/admin/invoices'
                  : canUseShop
                    ? '/admin/shop'
                    : '/admin/profile';
  const adminNavProps = {
    canManageCalendar: canManageCalendarDates,
    canManageClubs: canManageClubModule,
    canManageInvoices: canManageInvoiceModule,
    canUseShop,
    canManageUserAccounts: canManageAccounts,
    canUseMessages,
    canViewAudit,
    canViewBehaviour,
    canViewPace,
    canViewStudents,
    canExportAttendance: canExportAttendanceCsv,
    clubsOnly: user.role === 'ClubsAdmin',
    fullAdmin,
    hasLinkedChildren,
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
          <ProfileBadgeLink href="/admin/profile" />
        </div>
        <AdminSidebarNav {...adminNavProps} />
        <div className="admin-shell__foot">
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
            <ProfileBadgeLink href="/admin/profile" variant="mobile" />
            <LogoutButton className="logout-button logout-button--mobile" />
          </div>
        </header>
        <main className="admin-shell__main">{children}</main>
        <AdminBottomNav {...adminNavProps} />
      </div>
    </div>
  );
}
