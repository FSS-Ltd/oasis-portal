# App store review tenant

**Status:** Approved approach (same database, separate `review` schema). 2026-10-28.

## Problem

Apple and Google need a working staff login and a working parent login to review the mobile app
(checklist item 3 in `docs/mobile-store-submission-checklist.md`). The store build ships one Clerk key
and one API URL, so reviewers sign in to production. The reviewers must see realistic data, must never
see a real child, and live families and staff must never see the reviewer data. Sign-in must be email
and password with no second factor. We do not want a second Supabase project or Vercel deployment.

## Approach

A second Postgres schema, `review`, inside the production database. It holds the same tables as
`public` and is filled with synthetic data by the existing client-demo seeder.

- **The flag.** Reviewer Clerk users carry `publicMetadata.reviewSandbox = true`.
- **Routing.** `createContext` looks up the Clerk user in `review` first, then in `public`. A user found
  in `review` gets a Prisma client bound to the `review` schema for `ctx.db` and `ctx.withRls`. Every
  other user gets the normal client. No router or query changes.
- **Raw SQL.** Prisma qualifies its own queries with the schema, but raw SQL does not. Review
  transactions run `set_config('search_path', 'review', true)`, which is local to the transaction and safe
  on the Supabase transaction pooler. The one raw query outside a transaction is `SELECT 1`.
- **No leak into `public`.** The Clerk webhook and the missed-webhook repair skip users flagged
  `reviewSandbox`, so a reviewer never gets a `public."User"` row. Web pages that read the global
  client find no row for a reviewer and deny access.
- **MFA.** Reviewer accounts are created by the backend with a password and no enrolled factor. Users
  in the `review` tenant are exempt from `OASIS_ENFORCE_2FA` in the API.

### Rejected

- **`tenantId` on every row.** That means 127 tables, about 1,560 query sites and composite unique keys.
  RLS covers only 40 tables, so one missed filter would show a real child to a reviewer.
- **Separate Supabase project or Vercel deployment.** Rejected by the owner on cost and operations.

## Data model

There is no Prisma model change. The `review` schema is created from `schema.prisma` with `prisma db push`,
because six historical migrations hardcode `public.` and cannot be replayed into another schema. Then
`rls.sql` is applied with `search_path=review`. The SECURITY DEFINER permission-slip helper also gets a
copy in `review`. `oasis_app` is granted access, and `anon` and `authenticated` are revoked.

Seeded logins:

- `staff@<domain>`: Head role, the full staff experience inside the sandbox.
- `parent@<domain>`: Parent with two synthetic children.

The other synthetic people (pastor, supervisor, students and so on) exist only as rows. They get
placeholder Clerk IDs (`review_noclerk_*`) and cannot sign in.

## Failure modes

| Failure                                 | Effect                         | Guard                                                                                                          |
| --------------------------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| Seeder pointed at `public`              | Live data truncated            | The seeder refuses to run unless `current_schema()` is exactly `review`, and it needs a confirmation variable. |
| Reviewer reaches `public`               | Reviewer sees live data        | The review schema is looked up first, the webhook skips flagged users, and a test covers both.                 |
| Raw SQL in a review transaction         | Reads from `public`            | `search_path` is set inside each review transaction.                                                           |
| `review` schema missing or not migrated | Reviewer requests fail         | Live users are not affected, because the review client is created lazily.                                      |
| Schema drift after a migration          | Reviewer errors on new columns | Re-run `review:schema` and `seed:app-review` after each release.                                               |

## Known limitations

- Triggers and constraints that exist only in raw migrations (Realtime broadcasts, some integrity
  triggers) are not in `review`. Reviewers get no live push updates; screens refresh on focus and pull.
- Cron jobs run only on `public`, so the sandbox does not accrue interest or send reminder emails.
- The web portal denies reviewer accounts. Only the mobile app, through `/api/trpc`, is routed.

## Security and privacy

All PII in `review` is synthetic and encrypted with the production key, like any other row. The reviewer
password is supplied through an environment variable at seed time and is never committed. Reviewer
sign-ins are audit-logged in `review."AuditLog"`, which keeps them apart from the live audit trail.

## Rollout and rollback

1. Deploy the API change. With no `review` schema, behaviour is unchanged.
2. Run `pnpm --filter @oasis/db review:schema`, then `pnpm --filter @oasis/api seed:app-review`.
3. Put the two logins in App Store Connect and the Play Console.

Rollback: delete the two Clerk users and run `DROP SCHEMA review CASCADE`. The code path goes inert.

## Success metrics

- Both logins reach their portals on a store build with no MFA prompt.
- Tests prove a reviewer resolves to `review`, a live user resolves to `public`, and the webhook never
  writes a flagged user to `public`.
