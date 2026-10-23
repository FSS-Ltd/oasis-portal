import { describe, expect, it, vi } from 'vitest';
import type { SessionUser } from '@oasis/domain';
import type { AppContext, RlsTx } from '../context.js';
import { createAdminRouter } from '../routers/admin.js';
import { router } from '../trpc.js';

function setup(role: SessionUser['role'] = 'Head') {
  const user = { id: 'actor', role, tags: [], requires2fa: false } satisfies SessionUser;
  const findUnique = vi.fn().mockResolvedValue({ id: 'target', role: 'Parent', deletedAt: null });
  const update = vi
    .fn<
      (args: {
        where: { id: string; deletedAt: null };
        data: { active: boolean; deletedAt: Date };
        select: { id: true };
      }) => Promise<{ id: string }>
    >()
    .mockResolvedValue({ id: 'target' });
  const audit = vi.fn().mockResolvedValue({});
  const tx = { user: { findUnique, update }, auditLog: { create: audit } };
  const transaction = vi.fn();
  // This transaction double implements only the delegates exercised by account deletion.
  const withRls: AppContext['withRls'] = async (fn) => {
    transaction();
    return fn(tx as unknown as RlsTx);
  };
  const ctx = {
    user,
    db: tx as unknown as AppContext['db'],
    withRls,
    accountAccessState: 'active',
    requestId: 'delete-test',
  } satisfies AppContext;
  const caller = router({ admin: createAdminRouter() }).createCaller(ctx);
  return { caller, findUnique, update, audit, transaction };
}

describe('admin.deleteUserAccount', () => {
  it.each(['Head', 'Principal', 'TechnicalSupport'] as const)(
    'allows %s to delete an account and audit it within one transaction',
    async (role) => {
      const { caller, update, audit, transaction } = setup(role);
      await expect(caller.admin.deleteUserAccount({ userId: 'target' })).resolves.toEqual({
        id: 'target',
      });
      expect(transaction).toHaveBeenCalledOnce();
      expect(update).toHaveBeenCalledOnce();
      const args = update.mock.calls[0]?.[0];
      expect(args?.where).toEqual({ id: 'target', deletedAt: null });
      expect(args?.data.active).toBe(false);
      expect(args?.data.deletedAt).toBeInstanceOf(Date);
      expect(audit).toHaveBeenCalledWith({
        data: {
          userId: 'actor',
          action: 'Delete',
          entity: 'User',
          entityId: 'target',
          meta: { source: 'admin.deleteUserAccount', retainedHistory: true },
        },
      });
    },
  );

  it.each(['Parent', 'Supervisor'] as const)(
    'denies %s without reading or writing accounts',
    async (role) => {
      const { caller, findUnique, update } = setup(role);
      await expect(caller.admin.deleteUserAccount({ userId: 'target' })).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
      expect(findUnique).not.toHaveBeenCalled();
      expect(update).not.toHaveBeenCalled();
    },
  );

  it('prevents deleting your own account', async () => {
    const { caller, update } = setup();
    await expect(caller.admin.deleteUserAccount({ userId: 'actor' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    expect(update).not.toHaveBeenCalled();
  });

  it.each([null, { id: 'target', role: 'Parent', deletedAt: new Date() }])(
    'rejects missing or already deleted accounts',
    async (row) => {
      const { caller, findUnique, update } = setup();
      findUnique.mockResolvedValue(row);
      await expect(caller.admin.deleteUserAccount({ userId: 'target' })).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
      expect(update).not.toHaveBeenCalled();
    },
  );

  it('prevents reactivating a deleted account', async () => {
    const { caller, findUnique, update } = setup();
    findUnique.mockResolvedValue({ id: 'target', role: 'Parent', deletedAt: new Date() });
    await expect(
      caller.admin.updateUserAccountStatus({ userId: 'target', active: true }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(update).not.toHaveBeenCalled();
  });
});
