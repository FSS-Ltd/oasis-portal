import { resolvePostSignInPortal, type SessionUser } from '@oasis/domain';

export type PostSignInDestination =
  | '/admin'
  | '/admin/access'
  | '/supervisor'
  | '/parent'
  | '/registration'
  | '/not-ready';

type PostSignInPortal = ReturnType<typeof resolvePostSignInPortal>;

const DESTINATION_BY_PORTAL = {
  'full-admin': '/admin',
  'account-admin': '/admin/access',
  supervisor: '/supervisor',
  parent: '/parent',
  'not-ready': '/not-ready',
} satisfies Record<PostSignInPortal, PostSignInDestination>;

export function resolvePostSignInDestination(user: SessionUser | null): PostSignInDestination {
  return resolvePostSignInDestinationForState(user, { parentNeedsRegistration: false });
}

export function resolvePostSignInDestinationForState(
  user: SessionUser | null,
  state: { parentNeedsRegistration: boolean },
): PostSignInDestination {
  if (user?.role === 'Parent' && state.parentNeedsRegistration) return '/registration';
  return DESTINATION_BY_PORTAL[resolvePostSignInPortal(user)];
}
