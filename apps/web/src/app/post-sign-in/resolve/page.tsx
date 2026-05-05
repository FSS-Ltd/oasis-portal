import { auth } from '@clerk/nextjs/server';
import { createContext } from '@oasis/api';
import { redirect } from 'next/navigation';
import { resolvePostSignInDestinationForState } from '@/lib/post-sign-in-routing';

export const dynamic = 'force-dynamic';

export default async function PostSignInResolvePage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in/');

  const ctx = await createContext({ headers: new Headers(), clerkUserId: userId });
  const parentNeedsRegistration =
    ctx.user?.role === 'Parent'
      ? !(await ctx.db.parentRegistration.findUnique({
          where: { parentUserId: ctx.user.id },
          select: { id: true },
        })) && (await ctx.db.guardian.count({ where: { userId: ctx.user.id } })) === 0
      : false;

  redirect(resolvePostSignInDestinationForState(ctx.user, { parentNeedsRegistration }));
}
