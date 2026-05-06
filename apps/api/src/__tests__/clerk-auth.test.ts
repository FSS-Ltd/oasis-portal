import { describe, expect, it } from 'vitest';
import { resolveClerkUserIdFromBearerToken } from '../lib/clerk.js';

describe('resolveClerkUserIdFromBearerToken', () => {
  it('returns null when the authorization header is absent or malformed', async () => {
    await expect(resolveClerkUserIdFromBearerToken(new Headers())).resolves.toBeNull();
    await expect(
      resolveClerkUserIdFromBearerToken(new Headers({ authorization: 'Basic abc' })),
    ).resolves.toBeNull();
  });

  it('returns the Clerk subject from a verified bearer token', async () => {
    const headers = new Headers({ authorization: 'Bearer token_123' });

    await expect(
      resolveClerkUserIdFromBearerToken(headers, {
        verifyToken: (token) => {
          expect(token).toBe('token_123');
          return Promise.resolve({ sub: 'user_clerk_123' });
        },
      }),
    ).resolves.toBe('user_clerk_123');
  });

  it('returns null when token verification fails or has no subject', async () => {
    await expect(
      resolveClerkUserIdFromBearerToken(new Headers({ authorization: 'Bearer bad' }), {
        verifyToken: () => Promise.reject(new Error('invalid token')),
      }),
    ).resolves.toBeNull();

    await expect(
      resolveClerkUserIdFromBearerToken(new Headers({ authorization: 'Bearer empty' }), {
        verifyToken: () => Promise.resolve({}),
      }),
    ).resolves.toBeNull();
  });
});
