import { resolvePostSignInPortal, type SessionUser } from '@oasis/domain';

export type PostSignInDestination =
  | '/admin'
  | '/admin/access'
  | '/supervisor'
  | '/parent'
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
  return DESTINATION_BY_PORTAL[resolvePostSignInPortal(user)];
}
