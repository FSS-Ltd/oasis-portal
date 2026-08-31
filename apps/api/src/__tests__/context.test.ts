import type { SessionUser } from '@oasis/domain';
import { describe, expect, it, vi } from 'vitest';
import { applySerializableRlsTx, RlsSerializationConflictError, type RlsTx } from '../context.js';

const HEAD: SessionUser = { id: 'user_head', role: 'Head', tags: [], requires2fa: false };

function serializationConflict(): Error & { code: string } {
  return Object.assign(new Error('Serialization conflict'), { code: 'P2034' });
}

describe('applySerializableRlsTx', () => {
  it('retries a serialization conflict with a fresh RLS-scoped transaction', async () => {
    const tx = {
      $executeRaw: vi.fn().mockResolvedValue(0),
    } as unknown as RlsTx;
    let attempts = 0;
    const client = {
      $transaction: vi.fn((callback: (transaction: RlsTx) => Promise<string>) => {
        attempts += 1;
        if (attempts === 1) return Promise.reject(serializationConflict());
        return callback(tx);
      }),
    };

    const result = await applySerializableRlsTx(client as never, HEAD, () =>
      Promise.resolve('complete'),
    );

    expect(result).toBe('complete');
    expect(client.$transaction).toHaveBeenCalledTimes(2);
    expect(tx.$executeRaw).toHaveBeenCalledTimes(3);
    expect(client.$transaction.mock.calls[0]?.[1]).toEqual({ isolationLevel: 'Serializable' });
  });

  it('returns a safe error after bounded serialization retries are exhausted', async () => {
    const client = {
      $transaction: vi.fn(() => Promise.reject(serializationConflict())),
    };

    await expect(
      applySerializableRlsTx(client as never, HEAD, () => Promise.resolve('complete')),
    ).rejects.toBeInstanceOf(RlsSerializationConflictError);
    expect(client.$transaction).toHaveBeenCalledTimes(3);
  });
});
