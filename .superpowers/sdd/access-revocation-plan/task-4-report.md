# Task 4 report: access-deactivation integration verification

## Outcome

No task-related defect was found; no production code changed in this task.

The combined changes preserve the intended authorization and account-state contract:

- `canManageUserAccounts` and `userAccountAdminProcedure` admit only full admins (`Head`, `Principal`, `Pastor`, `HeadOfDiscipline`) and `TechnicalSupport`; all other roles are denied. Full admins remain distinct from Technical Support.
- The user-account, invitation, profile, status, role, and tag paths retain their existing validation. In particular, self-deactivation and self-role-change remain forbidden, and the existing adult-role schema still prevents changing an account to `Student`.
- `loadAccountAccess` provides trusted `active`, `deactivated`, and `unavailable` states. A deactivated account produces `user: null`, so `authedProcedure` rejects protected calls, while the public `health.me` response safely exposes the state to clients.
- Web checks `ctx.accountAccessState === 'deactivated'` before normal destination resolution. The public notice has the required exact heading, visible deadline countdown, labelled native progress control, reduced-motion-safe styles, and a Clerk-sign-out failure fallback to `window.location.replace('/')`.
- Mobile checks the trusted deactivated state before ordinary role routing. The revocation screen has an accessible countdown/progressbar and calls Clerk sign-out at the deadline. The app root renders `SignInPanel` inside Clerk's normal `SignedOut` boundary, so no custom protected-route redirect is required.

## Checks run

```sh
pnpm --filter @oasis/domain test
# 25 files / 362 tests passed

pnpm --filter @oasis/domain lint
pnpm --filter @oasis/domain typecheck
# passed

pnpm --filter @oasis/api test
# 48 files / 954 tests passed; 11 failures, all in src/__tests__/invoice.router.test.ts

pnpm --filter @oasis/api lint
pnpm --filter @oasis/api typecheck
# passed

pnpm --filter @oasis/web test
# 30 tests passed

pnpm --filter @oasis/web lint
pnpm --filter @oasis/web typecheck
# passed

pnpm --filter @oasis/mobile test
# 35 Vitest files / 131 tests passed; Node suite: 55 tests passed

pnpm --filter @oasis/mobile lint
pnpm --filter @oasis/mobile typecheck
# passed

git diff --check
git diff --check 75bc2c5^..3ae24b7
# passed
```

The full API run reproduced precisely the documented baseline: 11 failed assertions in `invoice.router.test.ts` and no failures elsewhere. Those invoice failures cover active-year payment summaries/coverage and are unrelated to account deactivation; no invoice logic was changed.

## Diff review

Reviewed commits `75bc2c5`, `a97240d`, and `3ae24b7` against the current worktree. The final task diff is limited to the requested API/domain access-state and authorization changes, web revocation/account-management work, mobile shared account-management/revocation work, focused coverage, and implementation reports. No dependency or migration was introduced.

## Files changed in Task 4

- `.superpowers/sdd/access-revocation-plan/task-4-report.md`

## Known limitations

Web and mobile revocation tests use the repository's existing source-contract convention; the current checks do not mount a browser clock or an Expo device. No browser/e2e run was performed because that requires configured Clerk/mobile runtime credentials. Static type checks and all requested package test/lint checks were run successfully, subject only to the documented API invoice baseline.
