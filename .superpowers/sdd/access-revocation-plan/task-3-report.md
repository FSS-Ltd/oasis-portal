# Task 3 report: Mobile shared User Access and access revocation

## Outcome

- Extracted the Technical Support account directory into shared mobile access components used by both the Technical Support Access tab and a Head-only Staff Portal entry.
- The shared screen uses the generated admin tRPC hooks for the complete directory/invitation flow. It uses the canonical `ROLES` catalogue for invitations and filters; its account-detail component uses `ADULT_USER_ACCOUNT_ROLES` and `PERMISSION_TAGS` for the API-backed role/tag controls, alongside profile and active-status updates.
- Technical Support retains its dedicated Access tab and all pre-existing support workflow tabs. Head users see a clear **User Access** Staff Home entry, which opens the same shared component; other staff roles do not receive that route entry.
- `SignedInRouter` now handles an explicit `health.me.accountAccessState === 'deactivated'` before regular portal routing. The calm mobile revoked screen has the exact required heading, a deadline-derived 60-second visible countdown, accessible non-colour progress semantics, no decorative animation, and Clerk sign-out at expiry with interval/timeout cleanup.

## Files changed

- `apps/mobile/src/components/access/user-access-model.ts`
- `apps/mobile/src/components/access/user-access-screen.tsx`
- `apps/mobile/src/components/access/user-access-account-detail.tsx`
- `apps/mobile/src/components/access/user-access-screen-wiring.test.ts`
- `apps/mobile/src/components/support/technical-support-portal-screen.tsx`
- `apps/mobile/src/components/staff/staff-home-screen.tsx`
- `apps/mobile/src/components/staff/staff-portal-screen.tsx`
- `apps/mobile/src/components/core/mobile-access-revoked-screen.tsx`
- `apps/mobile/src/components/core/mobile-access-revocation-wiring.test.ts`
- `apps/mobile/src/components/core/signed-in-router.tsx`
- `apps/mobile/src/components/core/signed-in-router-wiring.test.ts`

## RED / GREEN evidence

### RED

Added focused source-contract tests, then ran:

```sh
pnpm --filter @oasis/mobile exec vitest run \
  src/components/core/mobile-access-revocation-wiring.test.ts \
  src/components/access/user-access-screen-wiring.test.ts
```

The tests failed as expected: the shared User Access and access-revoked components did not exist, and neither the Head route nor deactivated state routing was wired.

### GREEN

```sh
pnpm --filter @oasis/mobile test
# 35 Vitest files / 131 tests passed; Node suite: 55 tests passed

pnpm --filter @oasis/mobile lint
pnpm --filter @oasis/mobile typecheck
git diff --check
# all passed
```

The full suite initially caught two legacy Technical Support source assertions that were coupled to the old embedded implementation. They were updated to assert the shared screen and account-detail components instead, then the full suite passed.

## Self-review

- Shared access queries and mutations exist in one reusable component boundary; Technical Support and Head wrappers only supply portal-specific header/navigation context.
- The UI uses canonical domain role/tag catalogues and generated tRPC procedures, with no copied API authorization policy. The Head-only route is the explicitly requested mobile navigation affordance.
- The deactivated condition is checked from trusted health data before every ordinary role route. It does not infer deactivation from a missing user.
- Countdown state is calculated against one fixed deadline; the timer handles are cleared on unmount. Progress includes accessible value and textual remaining-time feedback rather than relying on colour or animation.

## Limitations

The requested focused mobile tests follow the repository's existing source-contract convention, so the timer/Clerk call wiring is verified statically rather than with an Expo-mounted fake-clock test. No device or Maestro run was performed because it requires configured mobile/Clerk credentials.
