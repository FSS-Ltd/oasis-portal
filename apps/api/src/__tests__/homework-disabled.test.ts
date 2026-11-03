import type { SessionUser } from '@oasis/domain';
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { describe, expect, it } from 'vitest';
import { homeworkRouter } from '../routers/homework.js';
import { router } from '../trpc.js';
import { makeTestContext } from './helpers/test-context.js';

const app = router({ homework: homeworkRouter });
const roles = ['Head', 'Student'] as const;

describe.each(roles)('disabled homework for %s', (role) => {
  it.each(Object.entries(homeworkRouter._def.procedures))(
    'rejects %s before validation or database access',
    async (name, procedure) => {
      const user: SessionUser = {
        id: 'homework-disabled-user',
        role,
        tags: [],
        requires2fa: false,
      };
      // No database delegates are available: entering a resolver would fail this test.
      const ctx = makeTestContext({
        db: {},
        user,
        rls: { kind: 'reject', message: 'disabled homework must not open a transaction' },
      });
      const mutation = procedure._def.type === 'mutation';
      const req = new Request(`http://localhost/api/trpc/homework.${name}`, {
        method: mutation ? 'POST' : 'GET',
        ...(mutation ? { headers: { 'content-type': 'application/json' }, body: '{}' } : {}),
      });
      const response = await fetchRequestHandler({
        endpoint: '/api/trpc',
        req,
        router: app,
        createContext: () => ctx,
      });

      expect(response.status).toBe(404);
      expect(await response.json()).toMatchObject({
        error: { json: { message: 'Not found', data: { code: 'NOT_FOUND' } } },
      });
    },
  );
});
