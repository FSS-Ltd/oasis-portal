# Task 2 report: web account management and access-revoked flow

## Outcome

- Full admins and Technical Support now both see **User Access** in the web navigation.
- User Access uses the shared `ROLES` catalog for invitation choices and directory filters. The profile surface exposes API-backed profile editing, role updates, all permission tags, and clearly labelled deactivate/reactivate controls. Self-deactivation and self-role-change remain guarded by the existing UI/API protections; no backend role rules were copied into the web surface.
- Post-sign-in resolution checks the trusted `accountAccessState` before normal destination work and directly routes only `deactivated` accounts to `/access-revoked`.
- `/access-revoked` is public and uses the existing Oasis logo with a calm, responsive card, visible text countdown, native `<progress>` element, and reduced-motion-safe styling. Its deadline-based 60-second timer signs out through Clerk then replaces the location with `/`, including on a Clerk sign-out failure.

## Files changed

- `apps/web/src/components/admin/admin-nav.tsx`
- `apps/web/src/app/(admin)/admin/access/access-account-model.ts`
- `apps/web/src/app/(admin)/admin/access/access-management-client.tsx`
- `apps/web/src/app/(admin)/admin/access/access-account-panel.tsx`
- `apps/web/src/app/post-sign-in/resolve/page.tsx`
- `apps/web/src/app/access-revoked/page.tsx`
- `apps/web/src/app/access-revoked/access-revoked-screen.tsx`
- `apps/web/src/app/access-revoked/access-revoked.module.css`
- `apps/web/tests/access-revocation-contract.test.mjs`

## RED / GREEN evidence

### RED

```sh
pnpm --filter @oasis/web test -- access-revocation-contract.test.mjs
```

Failed as intended before implementation: five new contract checks failed for full-admin navigation visibility, full role catalog wiring, profile controls, trusted deactivation routing, and the missing access-revoked route/countdown.

### GREEN

```sh
pnpm --filter @oasis/web test
# 30 passed

pnpm --filter @oasis/web lint
# passed

pnpm --filter @oasis/web typecheck
# passed

git diff --check
# passed
```

## Self-review

- The navigation delegates visibility to the existing `canManageUserAccounts` capability, so full-admin and Technical Support access stays aligned with domain authorization.
- Invitations and filters use the canonical `ROLES`; the separate `ADULT_USER_ACCOUNT_ROLES` role-change schema remains respected by the UI and API.
- The post-sign-in branch uses `ctx.accountAccessState`, never `ctx.user === null`, and occurs before normal routing/database work.
- The countdown derives remaining seconds from a fixed deadline, clears interval/timeout effects on unmount, has a visible numerical/textual status in addition to progress, and does not introduce animation.

## Known limitation

The focused web tests follow the repository's Node source-contract convention, so the 60-second timer/sign-out interaction is verified by wiring assertions rather than a mounted browser-clock test. No browser build or end-to-end run was performed; the requested web test, lint, typecheck, and whitespace checks passed.

## Follow-up remediation

The countdown's native progress element now has the visible **Sign-out progress** label associated through `htmlFor` / `id`, so its purpose is announced programmatically. The focused contract test covers that association. After this fix, `pnpm --filter @oasis/web test` (30 passed), lint, typecheck, and `git diff --check` passed again.
