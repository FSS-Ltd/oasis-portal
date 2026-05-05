import { auth } from '@clerk/nextjs/server';
import { createContext } from '@oasis/api';
import { canAnswerChildRegistrationPrompt } from '@oasis/domain';
import { redirect } from 'next/navigation';
import { resolvePostSignInDestinationForState } from '@/lib/post-sign-in-routing';

export const dynamic = 'force-dynamic';

export default async function PostSignInResolvePage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in/');

  const ctx = await createContext({ headers: new Headers(), clerkUserId: userId });
  let parentNeedsRegistration = false;
  let childRegistrationPromptRequired = false;
  let childRegistrationRequired = false;

  if (ctx.user) {
    const [registration, linkedChildrenCount, promptUser] = await Promise.all([
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
    const hasRegistrationOrLinkedChildren = Boolean(registration) || linkedChildrenCount > 0;

    if (ctx.user.role === 'Parent') {
      parentNeedsRegistration = !hasRegistrationOrLinkedChildren;
    } else if (canAnswerChildRegistrationPrompt(ctx.user) && !hasRegistrationOrLinkedChildren) {
      childRegistrationRequired = promptUser?.childRegistrationPromptStatus === 'HasChildren';
      childRegistrationPromptRequired = promptUser?.childRegistrationPromptStatus === 'Unanswered';
    }
  }

  redirect(
    resolvePostSignInDestinationForState(ctx.user, {
      childRegistrationPromptRequired,
      childRegistrationRequired,
      parentNeedsRegistration,
    }),
  );
}
