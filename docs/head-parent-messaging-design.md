# Design note: Head-initiated parent messaging

**Status:** In progress
**Last updated:** 2026-07-08

## Problem statement

`ParentStaff` message threads can currently only be started by a parent (or a
staff member acting as a linked-child guardian). The Head of centre (and other
`parent-message-responder`-capable staff) can only reply once a parent has
opened a thread — they have no way to pick a parent and start a conversation
themselves.

## Architecture approach

No new thread kind or schema change is needed. `MessageThread` already stores
`parentId` and `adminId` independently of who created the row, and
`MessageThreadParticipant` already supports either side being the initiator.
The restriction lives entirely in `apps/api/src/routers/message.ts`
authorization checks, which assume `ctx.user` is always the parent side.

Change: resolve the `ParentStaff` participant roles from the **target user's
actual role**, not from which side called the mutation.

- If the resolved recipient has `role === 'Parent'`: the caller must satisfy
  `canRespondToParentMessages` (the same permission that already gates who can
  reply to parent threads). `parentId` = recipient, `adminId` = caller.
- Otherwise (existing behaviour): the caller must satisfy
  `requireParentStaffThreadAuthor` (linked-child guardian access + an active
  linked child) and the recipient must satisfy `canRespondToParentMessages`.
  `parentId` = caller, `adminId` = recipient.

This keeps a single `openConversation` / `openThread` code path working for
both directions and needs no new Prisma enum value or migration.

One existing bug this fixes as a side effect: `openConversation`'s
pre-creation `conversationId` for `ParentStaff` was built as
`` `ParentStaff:${ctx.user.id}:${recipientId}` ``, which only produces the
canonical `ParentStaff:{parentId}:{adminId}` id (used by
`conversationIdForThread` once a thread exists) when the caller is the parent.
Resolving `parentId`/`adminId` before building the id fixes this for both
directions, so a Head-initiated and a parent-initiated conversation with the
same two people always dedupe into one conversation.

`listRecipients` has no target user to resolve a direction from (it's a list,
not a specific recipient), so it needs an explicit signal. Add an optional
`direction` field, `'toStaff'` (default, unchanged) or `'toParent'`. When
`kind === 'ParentStaff' && direction === 'toParent'`, require
`canRespondToParentMessages(ctx.user)` and return active `Parent`-role users
instead of active staff responders.

## Data model

No changes.

## Failure modes / edge cases

- A staff member who is also a linked guardian of their own child: direction
  is still resolved per-recipient, so no ambiguity — if they target a `Parent`
  user they're staff-initiating; if they target a staff responder they're
  guardian-initiating for their own child, same as today.
- Inactive or non-`Parent` recipient targeted via `direction: 'toParent'`
  flows: rejected with `BAD_REQUEST` by the new recipient loader, same
  pattern as `loadParentMessageAssignee`.
- `ClubsLead` is explicitly excluded by `canRespondToParentMessages`, so it
  cannot initiate parent threads, matching its existing inability to respond
  to them.

## Security

No new permission primitive. Reuses `canRespondToParentMessages`, which is
already the exact permission gating who may be assigned as a parent-thread
responder — the same population is now allowed to originate the thread. All
existing thread-access (`canAccessThread`) and audit-log behaviour applies
unchanged.

## Rollout / rollback

Backend and frontend (web + mobile) ship together; the API changes are
backwards compatible (new optional input field, no breaking changes to
existing calls), so no phased rollout dance is required. Rollback is a plain
revert.

## Success metrics

Head can open `/admin/messages`, switch to a "Parents" contact list, pick a
parent, and send a message that appears in the parent's `/parent/messages`
inbox as a normal `ParentStaff` conversation. Mobile staff communications
screen gets the same capability.
