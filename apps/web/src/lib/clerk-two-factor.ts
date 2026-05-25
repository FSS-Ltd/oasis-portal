import { hasCompletedTwoFactor } from '@oasis/domain';

export function twoFactorSatisfiedFromClerkAuth(authResult: unknown): boolean {
  if (!authResult || typeof authResult !== 'object') return false;

  const authObject = authResult as {
    factorVerificationAge?: unknown;
    sessionClaims?: { fva?: unknown } | null;
  };

  return hasCompletedTwoFactor(authObject.factorVerificationAge ?? authObject.sessionClaims?.fva);
}
