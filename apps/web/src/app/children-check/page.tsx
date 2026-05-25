import Image from 'next/image';
import { auth } from '@clerk/nextjs/server';
import { createContext } from '@oasis/api';
import { canAnswerChildRegistrationPrompt } from '@oasis/domain';
import { redirect } from 'next/navigation';
import { twoFactorSatisfiedFromClerkAuth } from '@/lib/clerk-two-factor';
import { resolvePostSignInDestination } from '@/lib/post-sign-in-routing';
import '../(admin)/admin/admin.css';
import '../registration/registration.css';
import { ChildrenCheckClient } from './children-check-client';

export const dynamic = 'force-dynamic';

export default async function ChildrenCheckPage() {
  const clerkAuth = await auth();
  const { userId } = clerkAuth;
  if (!userId) redirect('/sign-in/');

  const ctx = await createContext({
    headers: new Headers(),
    clerkUserId: userId,
    twoFactorSatisfied: twoFactorSatisfiedFromClerkAuth(clerkAuth),
  });
  if (!ctx.user) redirect('/not-ready');
  if (!canAnswerChildRegistrationPrompt(ctx.user)) redirect('/post-sign-in/resolve');

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
  if (!promptUser) redirect('/not-ready');
  if (registration || linkedChildrenCount > 0) {
    redirect(resolvePostSignInDestination(ctx.user));
  }
  if (promptUser.childRegistrationPromptStatus === 'HasChildren') redirect('/registration');
  if (promptUser.childRegistrationPromptStatus === 'NoChildren') {
    redirect(resolvePostSignInDestination(ctx.user));
  }

  return (
    <main className="admin-shell registration-shell">
      <div className="registration-page admin-shell__main">
        <div className="registration-brand">
          <Image
            alt="Oasis Learning Centre"
            height={58}
            priority
            src="/oasis-logo.svg"
            width={148}
          />
        </div>
        <div className="page-header">
          <div>
            <p>Account setup</p>
            <h1>Children at Oasis</h1>
            <p>Confirm whether this account should create child registration records.</p>
          </div>
        </div>
        <ChildrenCheckClient />
      </div>
    </main>
  );
}
