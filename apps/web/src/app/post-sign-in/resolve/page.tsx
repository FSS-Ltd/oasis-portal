import { auth } from '@clerk/nextjs/server';
import { createContext } from '@oasis/api';
import { canAnswerChildRegistrationPrompt } from '@oasis/domain';
import { redirect } from 'next/navigation';
import { ensureDevHeadUser } from '@/lib/dev-head-user';
import { resolvePostSignInDestinationForState } from '@/lib/post-sign-in-routing';
import { PostSignInTransition } from './post-sign-in-transition';

export const dynamic = 'force-dynamic';

type PortalSwitchTarget = 'parent' | 'staff';

interface PostSignInResolvePageProps {
  searchParams?: Promise<{
    switchTo?: string | string[];
  }>;
}

function portalSwitchTargetFromSearchParams(
  searchParams: Awaited<PostSignInResolvePageProps['searchParams']>,
): PortalSwitchTarget | null {
  const value = Array.isArray(searchParams?.switchTo)
    ? searchParams.switchTo[0]
    : searchParams?.switchTo;

  return value === 'parent' || value === 'staff' ? value : null;
}

export default async function PostSignInResolvePage({ searchParams }: PostSignInResolvePageProps) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in/');

  const switchTarget = portalSwitchTargetFromSearchParams(await searchParams);
  await ensureDevHeadUser(userId);
  const ctx = await createContext({ headers: new Headers(), clerkUserId: userId });
  let parentNeedsRegistration = false;
  let childRegistrationPromptRequired = false;
  let childRegistrationRequired = false;
  let linkedChildrenCount = 0;

  if (ctx.user) {
    const [registration, linkedChildrenTotal, promptUser] = await Promise.all([
      ctx.db.parentRegistration.findUnique({
        where: { parentUserId: ctx.user.id },
        select: { id: true },
      }),
      ctx.db.guardian.count({ where: { userId: ctx.user.id } }),
      ctx.db.user.findUnique({
        where: { id: ctx.user.id },
        select: { childRegistrationPromptStatus: true },
      }),
    ]);
    linkedChildrenCount = linkedChildrenTotal;
    const hasRegistrationOrLinkedChildren = Boolean(registration) || linkedChildrenCount > 0;

    if (ctx.user.role === 'Parent') {
      parentNeedsRegistration = !hasRegistrationOrLinkedChildren;
    } else if (canAnswerChildRegistrationPrompt(ctx.user) && !hasRegistrationOrLinkedChildren) {
      childRegistrationRequired = promptUser?.childRegistrationPromptStatus === 'HasChildren';
      childRegistrationPromptRequired = promptUser?.childRegistrationPromptStatus === 'Unanswered';
    }
  }

  const destination = resolvePostSignInDestinationForState(ctx.user, {
    childRegistrationPromptRequired,
    childRegistrationRequired,
    parentNeedsRegistration,
  });

  if (switchTarget === 'parent' && linkedChildrenCount > 0) {
    return <PostSignInTransition destination="/parent" />;
  }

  return <PostSignInTransition destination={destination} />;
}
