import { hasCompletedTwoFactor } from '@oasis/domain';

const ENABLED_VALUE = 'true';
const ENFORCE_2FA_ENV = 'OASIS_ENFORCE_2FA';

export function isTwoFactorEnforcementEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env[ENFORCE_2FA_ENV]?.trim().toLowerCase() === ENABLED_VALUE;
}

export function twoFactorSatisfiedFromClerkAuth(authResult: unknown): boolean {
  if (!authResult || typeof authResult !== 'object') return false;

  const authObject = authResult as {
    factorVerificationAge?: unknown;
    sessionClaims?: { fva?: unknown } | null;
  };

  return hasCompletedTwoFactor(authObject.factorVerificationAge ?? authObject.sessionClaims?.fva);
}
