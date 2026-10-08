import { CLUBS_VISIBLE } from '@oasis/domain/portal-visibility';
import { resolvePostSignInPortal, type SessionUser } from '@oasis/domain';

export type PostSignInDestination =
  | '/2fa'
  | '/admin'
  | '/admin/access'
  | '/admin/clubs'
  | '/clubs-lead'
  | '/children-check'
  | '/supervisor'
  | '/parent'
  | '/student'
  | '/registration'
  | '/parent-link-requests'
  | '/not-ready';

type PostSignInPortal = ReturnType<typeof resolvePostSignInPortal>;

const DESTINATION_BY_PORTAL = {
  'two-factor-required': '/2fa',
  'full-admin': '/admin',
  'admin-operations': '/admin',
  'account-admin': '/admin/access',
  'clubs-admin': CLUBS_VISIBLE ? '/admin/clubs' : '/supervisor',
  'clubs-lead': CLUBS_VISIBLE ? '/clubs-lead' : '/not-ready',
  supervisor: '/supervisor',
  parent: '/parent',
  student: '/student',
  'not-ready': '/not-ready',
} satisfies Record<PostSignInPortal, PostSignInDestination>;

export function resolvePostSignInDestination(user: SessionUser | null): PostSignInDestination {
  return resolvePostSignInDestinationForState(user, {
    childRegistrationPromptRequired: false,
    childRegistrationRequired: false,
    pendingParentLinkRequests: false,
    parentNeedsRegistration: false,
  });
}

export function resolvePostSignInDestinationForState(
  user: SessionUser | null,
  state: {
    childRegistrationPromptRequired: boolean;
    childRegistrationRequired: boolean;
    pendingParentLinkRequests: boolean;
    parentNeedsRegistration: boolean;
  },
): PostSignInDestination {
  if (state.pendingParentLinkRequests) return '/parent-link-requests';
  if (user?.role === 'Parent' && state.parentNeedsRegistration) return '/registration';
  if (state.childRegistrationRequired) return '/registration';
  if (state.childRegistrationPromptRequired) return '/children-check';
  return DESTINATION_BY_PORTAL[resolvePostSignInPortal(user)];
}
