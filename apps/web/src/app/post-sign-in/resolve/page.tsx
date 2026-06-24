import { auth } from '@clerk/nextjs/server';
import { createContext } from '@oasis/api';
import { canAnswerChildRegistrationPrompt, canUseClubLeadAccess } from '@oasis/domain';
import { redirect } from 'next/navigation';
import {
  isTwoFactorEnforcementEnabled,
  twoFactorSatisfiedFromClerkAuth,
} from '@/lib/clerk-two-factor';
import { ensureDevHeadUser } from '@/lib/dev-head-user';
import {
  resolvePostSignInDestinationForState,
  type PostSignInDestination,
} from '@/lib/post-sign-in-routing';
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

function destinationForPortalSwitch(
  switchTarget: PortalSwitchTarget | null,
  counts: { assignedClubLeadCount: number; linkedChildrenCount: number },
): PostSignInDestination | null {
  if (switchTarget === 'parent' && counts.linkedChildrenCount > 0) return '/parent';
  if (switchTarget === 'club' && counts.assignedClubLeadCount > 0) return '/clubs-lead';
  return null;
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
  let pendingParentLinkRequests = false;
  let linkedChildrenCount = 0;
  let assignedClubLeadCount = 0;

  if (ctx.user) {
    const [
      registration,
      linkedChildrenTotal,
      assignedClubLeadTotal,
      promptUser,
      pendingParentLinkRequestTotal,
    ] = await Promise.all([
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
      ctx.db.studentParentLinkRequest.count({
        where: { targetUserId: ctx.user.id, status: 'Pending' },
      }),
    ]);
    linkedChildrenCount = linkedChildrenTotal;
    assignedClubLeadCount = assignedClubLeadTotal;
    pendingParentLinkRequests = pendingParentLinkRequestTotal > 0;
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
    pendingParentLinkRequests,
    parentNeedsRegistration,
  });
  const switchDestination = destinationForPortalSwitch(switchTarget, {
    assignedClubLeadCount,
    linkedChildrenCount,
  });

  if (switchDestination) {
    return <PostSignInTransition destination={switchDestination} />;
  }

  return <PostSignInTransition destination={destination} />;
}
