import type { SessionUser } from '@oasis/domain';
import { resolvePostSignInDestination } from './post-sign-in-routing';

export type StaffPortalHref = '/admin' | '/admin/access' | '/admin/clubs' | '/supervisor';

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
