import { auth } from '@clerk/nextjs/server';
import { createContext } from '@oasis/api';
import { notFound, redirect } from 'next/navigation';
import { MyAgreements } from '@/components/agreements/my-agreements';
import {
  isTwoFactorEnforcementEnabled,
  twoFactorSatisfiedFromClerkAuth,
} from '@/lib/clerk-two-factor';

export const dynamic = 'force-dynamic';

export default async function UserAgreementsPage({
  searchParams,
}: {
  searchParams?: Promise<{ requestId?: string }>;
}) {
  const clerkAuth = await auth();
  const context = await createContext({
    headers: new Headers(),
    clerkUserId: clerkAuth.userId,
    enforceTwoFactor: isTwoFactorEnforcementEnabled(),
    twoFactorSatisfied: twoFactorSatisfiedFromClerkAuth(clerkAuth),
  });
  if (context.accountAccessState === 'deactivated') redirect('/access-revoked');
  if (!context.user || context.user.role === 'Student') notFound();
  if (context.user.requires2fa) redirect('/2fa');
  const requestId = (await searchParams)?.requestId;
  return <MyAgreements {...(requestId ? { focusRequestId: requestId } : {})} />;
}
