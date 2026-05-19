import { resolvePostSignInPortal, type SessionUser } from '@oasis/domain';

export type PostSignInDestination =
  | '/admin'
  | '/admin/access'
  | '/admin/clubs'
  | '/clubs-lead'
  | '/children-check'
  | '/supervisor'
  | '/parent'
  | '/registration'
  | '/not-ready';

type PostSignInPortal = ReturnType<typeof resolvePostSignInPortal>;

const DESTINATION_BY_PORTAL = {
  'full-admin': '/admin',
  'account-admin': '/admin/access',
  'clubs-admin': '/admin/clubs',
  'clubs-lead': '/clubs-lead',
  supervisor: '/supervisor',
  parent: '/parent',
  'not-ready': '/not-ready',
} satisfies Record<PostSignInPortal, PostSignInDestination>;

export function resolvePostSignInDestination(user: SessionUser | null): PostSignInDestination {
  return resolvePostSignInDestinationForState(user, {
    childRegistrationPromptRequired: false,
    childRegistrationRequired: false,
    parentNeedsRegistration: false,
  });
}

export function resolvePostSignInDestinationForState(
  user: SessionUser | null,
  state: {
    childRegistrationPromptRequired: boolean;
    childRegistrationRequired: boolean;
    parentNeedsRegistration: boolean;
  },
): PostSignInDestination {
  if (user?.role === 'Parent' && state.parentNeedsRegistration) return '/registration';
  if (state.childRegistrationRequired) return '/registration';
  if (state.childRegistrationPromptRequired) return '/children-check';
  return DESTINATION_BY_PORTAL[resolvePostSignInPortal(user)];
}
