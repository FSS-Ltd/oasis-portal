import { auth } from '@clerk/nextjs/server';
import { createContext } from '@oasis/api';
import { canAnswerChildRegistrationPrompt, canUseClubLeadAccess } from '@oasis/domain';
import { redirect } from 'next/navigation';
import {
  isTwoFactorEnforcementEnabled,
  twoFactorSatisfiedFromClerkAuth,
} from '@/lib/clerk-two-factor';
import { ensureDevHeadUser } from '@/lib/dev-head-user';
import { resolvePostSignInDestinationForState } from '@/lib/post-sign-in-routing';
import { PostSignInTransition } from './post-sign-in-transition';

export const dynamic = 'force-dynamic';

type PortalSwitchTarget = 'parent' | 'staff' | 'club';

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

  return value === 'parent' || value === 'staff' || value === 'club' ? value : null;
}

export default async function PostSignInResolvePage({ searchParams }: PostSignInResolvePageProps) {
  const clerkAuth = await auth();
  const { userId } = clerkAuth;
  if (!userId) redirect('/sign-in/');

  const switchTarget = portalSwitchTargetFromSearchParams(await searchParams);
  await ensureDevHeadUser(userId);
  const ctx = await createContext({
    headers: new Headers(),
    clerkUserId: userId,
    enforceTwoFactor: isTwoFactorEnforcementEnabled(),
    twoFactorSatisfied: twoFactorSatisfiedFromClerkAuth(clerkAuth),
  });
  let parentNeedsRegistration = false;
  let childRegistrationPromptRequired = false;
  let childRegistrationRequired = false;
  let linkedChildrenCount = 0;
  let assignedClubLeadCount = 0;

  if (ctx.user) {
    const [registration, linkedChildrenTotal, assignedClubLeadTotal, promptUser] =
      await Promise.all([
        ctx.db.parentRegistration.findUnique({
          where: { parentUserId: ctx.user.id },
          select: { id: true },
        }),
        ctx.db.guardian.count({ where: { userId: ctx.user.id } }),
        canUseClubLeadAccess(ctx.user)
          ? ctx.db.clubLeadAssignment.count({
              where: { userId: ctx.user.id, club: { active: true } },
            })
          : Promise.resolve(0),
        ctx.db.user.findUnique({
          where: { id: ctx.user.id },
          select: { childRegistrationPromptStatus: true },
        }),
      ]);
    linkedChildrenCount = linkedChildrenTotal;
    assignedClubLeadCount = assignedClubLeadTotal;
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
  if (switchTarget === 'club' && assignedClubLeadCount > 0) {
    return <PostSignInTransition destination="/clubs-lead" />;
  }

  return <PostSignInTransition destination={destination} />;
}
