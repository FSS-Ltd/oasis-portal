import type { SessionUser } from '@oasis/domain';
import { resolvePostSignInDestination } from './post-sign-in-routing';

export type StaffPortalHref = '/admin' | '/admin/access' | '/admin/clubs' | '/supervisor';
export type PortalViewId = 'parent' | 'staff' | 'club';
export type PortalProfileHref = '/admin/profile' | '/supervisor/profile' | '/parent/profile';

export interface PortalViewLink {
  href: string;
  id: PortalViewId;
  label: string;
}

export type PortalSwitchViews = readonly [PortalViewLink, PortalViewLink];

export const parentPortalView: PortalViewLink = {
  href: '/post-sign-in/resolve?switchTo=parent',
  id: 'parent',
  label: 'Parent',
};

export const clubPortalView: PortalViewLink = {
  href: '/post-sign-in/resolve?switchTo=club',
  id: 'club',
  label: 'Club',
};

export function portalSwitchViewsFrom(views: readonly PortalViewLink[]): PortalSwitchViews | null {
  if (views.length !== 2) return null;
  const [first, second] = views;
  if (!first || !second) return null;
  return [first, second];
}

export function staffPortalHrefForUser(user: SessionUser): StaffPortalHref | null {
  const destination = resolvePostSignInDestination(user);
  switch (destination) {
    case '/admin':
    case '/admin/access':
    case '/admin/clubs':
    case '/supervisor':
      return destination;
    default:
      return null;
  }
}

export function staffPortalViewForUser(user: SessionUser): PortalViewLink | null {
  const href = staffPortalHrefForUser(user);
  if (!href) return null;
  return {
    href: '/post-sign-in/resolve?switchTo=staff',
    id: 'staff',
    label: 'Supervisor',
  };
}
