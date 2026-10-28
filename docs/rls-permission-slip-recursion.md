# Permission slip RLS recursion

**Status:** Draft for implementation
**Branch:** `fix/permission-slip-rls-recursion`
**Scope:** `packages/db` only (one migration, one policy in `prisma/rls.sql`, tests). No API or client changes.

## 1. Problem

Reading `PermissionSlip` as the application's runtime role fails for every user with Postgres error
`42P17: infinite recursion detected in policy for relation "PermissionSlip"`. The same error appears for
`PermissionSlipRecipient`. Parents cannot list slips, and cannot sign, decline or pay for one.

The policies reference each other:

- `permission_slip_parent_select` on `PermissionSlip` queries `PermissionSlipRecipient`.
- `permission_slip_recipient_parent_select` on `PermissionSlipRecipient` queries `PermissionSlip`.
- The recipient `UPDATE` policies (response and payment) also query `PermissionSlip`, and the slip's
  `SELECT` policy queries the recipient table again.

Postgres expands policies when it rewrites a query. If a relation reappears while it is already being
expanded, it stops with the recursion error. This does not depend on data or on who is signed in, so
`EXPLAIN SELECT * FROM "PermissionSlip"` is enough to trigger it.

It has been present since the permission slip workflow was added (commit `cdc2ba5e`, 2026-05-22). A restore
of a database from before the latest migrations fails the same way, so it is not caused by any recent
migration. The policy text is the same in `prisma/rls.sql` and in migration
`20260604170000_linked_child_guardian_parent_access`.

## 2. Approach

Make `PermissionSlip` a leaf: its policies must not read another table that has row level security.

1. Add a `SECURITY DEFINER` helper, `public.oasis_guardian_can_see_permission_slip(slip_id TEXT)`. It runs
   the exact check the policy did inline: is there a recipient of this slip whose student has the current
   session user (`app.user_id`) as a guardian.
2. Change `permission_slip_parent_select` to call the helper in place of the inline `EXISTS`. The role list
   and the `"active" = true` condition are unchanged.

Cutting this one edge removes every cycle, because every other policy that touches slips only reads
`PermissionSlip` and the slip policies now read no table. The recipient policies keep their inline
checks, so their behaviour is untouched.

### Alternatives considered

- **Cut the recipient to slip edge instead.** Leaves a cycle through the recipient `UPDATE` policies, so
  signing and paying would still fail. Rejected.
- **Merge the two policies into one table or drop recipient visibility.** A schema or behaviour change
  far larger than the bug. Rejected.
- **Connect as a role that bypasses RLS.** Removes the protection these policies exist to give. Rejected.

## 3. Where the change lives

The repo changes policies in a migration and mirrors them in `prisma/rls.sql`, which is re-applied after
every `migrate deploy`. This fix follows that:

- New migration `20261028090000_permission_slip_policy_recursion`: creates the helper, then drops and
  recreates `permission_slip_parent_select`. A database built from migrations alone works.
- `prisma/rls.sql`: the same policy text, so the re-apply keeps it.

Helper functions live in migrations because `rls.sql` is split on semicolons and does not understand
`$$` bodies.

## 4. Security

- **No wider access.** The helper answers one question for the caller's own session, using
  `current_setting('app.user_id')`. It takes no user argument, so it cannot be used to probe whether another
  user guards a slip. It returns a boolean and writes nothing.
- **Fixed `search_path`** (`public`), as in the existing helpers.
- **`SET row_security = off`.** The slip tables use `FORCE ROW LEVEL SECURITY`, so the function bypasses RLS
  only if its owner has `BYPASSRLS` (the local `oasis` superuser and Supabase's `postgres` do; existing
  helpers rely on the same thing). With the setting off, an owner that lacks it gets an explicit error and
  the query fails closed, instead of looping.
- **`EXECUTE`** stays with `PUBLIC`: policy expressions run with the querying role's privileges, so the
  runtime role needs it, and the helper only reports on the caller's own session.

## 5. Failure modes

| Risk                                                   | Mitigation                                                                                                            |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| Policy text drifts between the migration and `rls.sql` | A test applies `rls.sql` after the migration path and the cycle test reads `rls.sql`; both state the same text        |
| Another cycle is added later                           | Static test over every policy in `rls.sql`, plus a database check that `EXPLAIN`s every RLS table as the runtime role |
| Owner role lacks `BYPASSRLS`                           | Fails closed with an explicit error (see section 4)                                                                   |
| Helper missing when `rls.sql` runs                     | `pnpm migrate` deploys migrations before applying RLS                                                                 |

## 6. Rollout and rollback

- Apply with `pnpm db:migrate`. It needs `OASIS_ENFORCE_2FA` set in the environment (`false` is the default in
  `.env.example`) because the same command configures realtime.
- Rollback: re-create the previous policy text and drop the helper. That restores the recursion, so only do
  it with the slip feature switched off.
- No data is touched. The change is metadata only.

## 7. Success criteria

1. The static cycle test fails on `main` and passes on this branch.
2. As the runtime role, `EXPLAIN SELECT * FROM` each RLS table raises no `42P17`.
3. A parent still sees only slips addressed to their own linked children, and none for other children.
4. A parent can read, and a manager can still read, their expected slips; inactive slips stay hidden from parents.
5. `pnpm lint`, `pnpm typecheck` and `pnpm test` pass.
