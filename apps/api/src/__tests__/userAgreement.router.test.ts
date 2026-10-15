import { describe, expect, it } from 'vitest';
import type { SessionUser } from '@oasis/domain';
import { makeTestContext } from './helpers/test-context.js';
import { userAgreementRouter } from '../routers/userAgreement.js';
import { router } from '../trpc.js';

const appRouter = router({ userAgreement: userAgreementRouter });

function caller(role: SessionUser['role'] | null) {
  const user: SessionUser | null = role
    ? { id: 'user-1', role, tags: [], requires2fa: false }
    : null;
  return appRouter.createCaller(makeTestContext({ db: {}, user }));
}

function recipientCaller(recipientId: string, openedAt: Date | null) {
  const user: SessionUser = { id: 'user-1', role: 'Parent', tags: [], requires2fa: false };
  const db = {
    userAgreementRequest: {
      findUnique: () =>
        Promise.resolve({
          id: 'request-1',
          recipientId,
          status: 'NeedsSigning',
          openedAt,
          signature: null,
        }),
    },
  };
  return appRouter.createCaller(makeTestContext({ db, user, rls: { kind: 'db', db } }));
}

describe('user agreement API boundary', () => {
  it('allows tagged staff to use management procedures and rejects a tagged parent', async () => {
    const db = { user: { findMany: () => Promise.resolve([]) } };
    const tagged = (role: SessionUser['role']) =>
      appRouter.createCaller(
        makeTestContext({
          db,
          user: { id: 'user-1', role, tags: ['compliance-admin'], requires2fa: false },
        }),
      );
    await expect(tagged('ClubsLead').userAgreement.people()).resolves.toEqual([]);
    await expect(tagged('Parent').userAgreement.people()).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });
  it('restricts management to the Head', async () => {
    await expect(caller('Parent').userAgreement.people()).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await expect(caller('Pastor').userAgreement.documents()).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await expect(caller('Supervisor').userAgreement.register({})).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('excludes students and unauthenticated users from personal agreements', async () => {
    await expect(caller('Student').userAgreement.mine()).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await expect(caller(null).userAgreement.mine()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('rejects signing without explicit acknowledgement or a typed name', async () => {
    // Deliberately bypass the client type to exercise the server's runtime boundary.
    await expect(
      caller('Parent').userAgreement.sign({
        requestId: 'request-1',
        acknowledged: false as true,
        fullName: 'Jane',
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    await expect(
      caller('Parent').userAgreement.sign({
        requestId: 'request-1',
        acknowledged: true,
        fullName: '   ',
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('requires opening the assigned form and rejects a different recipient', async () => {
    const input = { requestId: 'request-1', acknowledged: true as const, fullName: 'Jane Example' };
    await expect(recipientCaller('user-1', null).userAgreement.sign(input)).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
    await expect(
      recipientCaller('another-user', new Date()).userAgreement.sign(input),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
