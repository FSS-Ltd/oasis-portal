# Task 1 report: shared authorization and account state

## Outcome

Implemented the shared account-administration permissions and trusted account-access state.

- Full admins and `TechnicalSupport` can use all account, invitation, profile, status, and role-management workflows across all role targets.
- Role changes use the shared account-admin guard. The existing adult-account role input schema still rejects `Student` as a next role, and self-role-change protection remains unchanged.
- Status updates retain the self-deactivation guard and continue to persist the existing `User.active` field and audit rows.
- Context now exposes `accountAccessState`: `active`, `deactivated`, or `unavailable`. A deactivated local user remains `user: null`, so protected procedures continue to reject the session normally.
- `health.me` returns the same trusted account-access state.

## RED / GREEN evidence

### RED

After adding the focused domain expectations, ran:

```sh
pnpm --filter @oasis/domain test -- rbac.test.ts
```

The suite failed as intended: full admins were not user-account admins, and Technical Support could not manage all role targets. The run also exposed a missing `ROLES` test import, which was corrected before the production edit/green run.

The first focused API green candidate additionally surfaced two obsolete expectations that contradicted the new contract (Technical Support profile access across roles and full-admin invitation deletion). Those test expectations were updated to the approved new authorization contract before the final green run.

### GREEN

```sh
pnpm --filter @oasis/domain exec vitest run src/__tests__/rbac.test.ts
# 53 passed

pnpm --filter @oasis/api exec vitest run \
  src/__tests__/admin.router.test.ts \
  src/__tests__/health.router.test.ts \
  src/__tests__/clerkWebhook.test.ts \
  src/__tests__/trpc.middleware.test.ts
# 118 passed

pnpm --filter @oasis/domain test
# 25 files / 362 tests passed

pnpm --filter @oasis/domain lint
pnpm --filter @oasis/api lint
pnpm --filter @oasis/domain typecheck
pnpm --filter @oasis/api typecheck
# all passed
```

The full API suite was also run. It has 954 passing tests and the known 11 failing tests in `src/__tests__/invoice.router.test.ts`; those invoice failures match the stated baseline and are unrelated to this task.

## Files changed

- `packages/domain/src/rbac.ts` and `packages/domain/src/__tests__/rbac.test.ts`
- `apps/api/src/context.ts`, `apps/api/src/routers/admin.ts`, and `apps/api/src/routers/health.ts`
- Focused API coverage: `admin.router.test.ts`, `health.router.test.ts`, `clerkWebhook.test.ts`, and `trpc.middleware.test.ts`
- Typed API test-context fixtures, mechanically updated to include the now-required `accountAccessState` field.

## Self-review

- Authorization is centralized in the existing domain predicates/procedure middleware; no router-local duplicate role list remains.
- Existing audit events and `User.active` persistence were preserved.
- Existing account-type validation, self-role-change, and self-deactivation protections are still covered by tests.
- No migration or dependency was introduced.

## Concerns

The 11 invoice-router failures remain external to Task 1 and should be handled separately. Test contexts model anonymous callers as `unavailable` and authenticated fixtures as `active`; the dedicated health/context tests cover the `deactivated` state.
