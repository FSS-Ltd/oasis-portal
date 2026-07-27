import type { SessionUser } from '@oasis/domain';
import type { AppContext, RlsTx } from '../../context.js';

type TestRlsMode<Db> =
  | { kind: 'db'; db: Db }
  | { kind: 'empty' }
  | { kind: 'reject'; message: string };

interface TestContextInput<Db> {
  db: Db;
  user: SessionUser | null;
  requestId?: string;
  rls?: TestRlsMode<Db>;
}

export function makeTestContext<Db>({
  db,
  user,
  requestId = 'req_test',
  rls = { kind: 'empty' },
}: TestContextInput<Db>): AppContext {
  return {
    db: db as unknown as AppContext['db'],
    user,
    requestId,
    withRls: async <T>(fn: (tx: RlsTx) => Promise<T>) => {
      if (rls.kind === 'reject') {
        void fn;
        throw new Error(rls.message);
      }

      const tx = rls.kind === 'db' ? rls.db : {};
      return fn(tx as RlsTx);
    },
  } satisfies AppContext;
}
