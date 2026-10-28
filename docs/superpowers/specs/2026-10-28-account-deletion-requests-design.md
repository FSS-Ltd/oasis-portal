# Account deletion requests: design

**Status:** Built for the API, the web admin queue and the Parent mobile screens. Staff and Student mobile screens are not built.
**Why now:** App Store Guideline 5.1.1(v) and the Play account deletion policy. Decision: in-app request
(option (a) in `mobile-store-submission-checklist.md`).

## Problem

Users have no way to ask for their account to be deleted from the app. Oasis must also keep attendance,
safeguarding and audit records, so deletion cannot mean erasing rows. The request has to reach Oasis
staff, be decided and be recorded.

## Approach

A user submits a request in the mobile app (and web). Oasis staff with account-admin rights see a queue
and approve or decline. Approval deactivates the account and sets `User.deletedAt`, which the database
already allows (`User_deleted_account_inactive`: `deletedAt` implies `active = false`). Related records
stay, matching the migration note "retain user references for attendance, safeguarding, and audit".

Who can request:

| Account                | Who submits                                                |
| ---------------------- | ---------------------------------------------------------- |
| Parent, Staff          | The account holder                                         |
| Student (under 18)     | A linked parent, from the parent's student settings screen |
| Student (self request) | Not offered. The student is told to ask their parent       |

Reuse existing pieces. Admin deletion already exists: `admin.deleteUserAccount` calls
`apps/api/src/services/delete-user-account.ts`, which sets `active = false` and `deletedAt`, writes an audit
row with `retainedHistory: true`, refuses self-deletion and applies `canManageUserAccountRole`. The Clerk
webhook already ignores users with `deletedAt` (`upsertUser`), and `loadAccountAccess` refuses any inactive
user, so a deleted user cannot call the API. Approving a request calls that same service. New code is the
request, the queue and the screens. The `Guardian` link gives parent-to-child authority.

## Data model

Built differently from the first draft: no new table. Two columns on `User`, `deletionRequestedAt` and
`deletionRequestedById`, hold a pending request, and `AuditLog` holds the history. This avoided new RLS and
realtime coverage. The table below is the original idea and is not what shipped:

- `id`, `subjectUserId` (account to delete), `requestedById`, `status` (`Pending`, `Approved`, `Declined`,
  `Cancelled`), `reasonEnc` (optional, encrypted like other free text), `createdAt`.
- `decidedById`, `decidedAt`, `declineReasonEnc`, `completedAt`.
- Unique index: one `Pending` request per `subjectUserId`.
- Index on `(status, createdAt)` for the queue.

Migration is additive. Row-level security follows the existing pattern in `rls.sql`.

## API (tRPC)

- `accountDeletion.request` (authed): validates authority above, creates the request, audit log.
- `accountDeletion.mine` (authed): current request and status.
- `accountDeletion.cancel` (authed): requester cancels while `Pending`.
- `accountDeletion.queue` (admin): paginated pending requests.
- `accountDeletion.decide` (admin): approve or decline with a reason. Approve runs in one transaction:
  mark request, set `active = false` and `deletedAt`, audit log.

Inputs validated with zod. No raw user text in logs.

## Failure modes

- **Clerk account remains.** The API already blocks the deleted user, but their Clerk identity still exists
  (`studentSettings.ts` shows a `client.users.deleteUser` pattern). Decide whether approval also deletes the
  Clerk user after the transaction commits. If so, retry on failure. The `user.deleted` webhook only
  deactivates, so it is safe. Without it, the person can still sign in to Clerk but sees "access revoked".
- **Duplicate or abusive requests.** Unique pending index, and rate limit per user.
- **Parent requests deletion of a child who also holds records the parent cannot see.** Staff reviewing the
  request sees the retention note and can decline.
- **Last admin deletes themselves.** Blocked by existing rule.
- **Request made on a locked or deactivated account.** Allowed for locked accounts. Deactivated accounts cannot
  sign in, so they use the support email.

## Security and privacy

Only the subject, a linked parent (for a student) or an authorised admin can read or act on a request.
Every state change writes an audit log row. The reason text is encrypted. The privacy policy and `/support`
page describe what is kept after deletion.

## Open decisions (need Oasis and FSS)

1. After deletion, does Oasis anonymise the person's name and email, and after how long? Today the design
   only deactivates. That may not satisfy an erasure request on its own.
2. Does a parent need to confirm when a Student account holder over 13 asks, or is parent-only enough?
3. Target time for staff to action a request (for the review notes and the policy).

## Rollout and rollback

Ship the migration and API first, then the admin queue, then the mobile and web screens. Rollback: hide
the screens. The table is additive and can stay. Requests already approved remain valid because they only
set fields the schema already supports.

## Success metrics

- A reviewer can find and submit the request in under three taps from settings.
- Every request ends `Approved`, `Declined` or `Cancelled`, none left `Pending` beyond the agreed target.
- No signed-in session survives for a deleted user.

## Tests

Router tests for each authority case (self, parent for child, unlinked parent rejected, student rejected),
duplicate pending, cancel, approve and decline, and audit rows. Mobile screen test for the confirm step.
