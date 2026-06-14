# Student Community Messaging Design

Status: Approved for implementation
Owner: Technical Agent
Date: 2026-06-12
Branch: `feat/student-community`

## Problem

Oasis needs a student community area where children can interact in a central shared space, send text messages, and join group chats. The Head and Pastor need full oversight and control of created groups, and staff must be able to disable messaging for individual children. The experience should feel close to Apple iMessage: conversational bubbles, immediate local feedback, sent/delivered/read states, and a three-dot typing indicator. Image sharing is explicitly out of scope.

## Goals

- Add a student-facing Community tab at `/student/community`.
- Add an admin-facing Community control page at `/admin/community`.
- Provide a central all-student group and additional moderated group chats.
- Allow eligible students to join active public groups and send text-only messages.
- Allow Head, Principal, Pastor, and HeadOfDiscipline users to create, disable, and moderate groups.
- Allow Head, Principal, Pastor, and HeadOfDiscipline users to disable messaging for a specific child.
- Enforce moderation and per-child message disablement in the API, not only in the UI.
- Show messages as soon as they are submitted, then move through sent, delivered, and read states.
- Show read timestamps when another participant has read the message.
- Show a three-dot typing indicator while another participant is typing.
- Preserve existing parent/staff messaging behavior.

## Non-Goals

- No image, file, audio, video, or link preview sharing.
- No direct one-to-one student DMs in this first slice; all student interaction happens inside groups.
- No push notifications or email notifications for student community messages in this first slice.
- No AI moderation, profanity filtering, or automated safeguarding classifier in this first slice.
- No mobile app implementation beyond the responsive web student portal surface.

## Architecture

Add a dedicated `community` product owner instead of overloading the existing parent/staff `message` router. Parent/staff messaging has adult communication semantics, email notification behavior, and `MessageThreadKind` values that do not fit student group moderation. The new owner keeps child-facing access rules explicit and auditable while reusing the same app patterns: Prisma models, tRPC router, encrypted message bodies, audit logs, Supabase realtime invalidation, and shared UI primitives.

The backend will expose `community` tRPC procedures:

- `listStudentGroups`
- `listGroupMessages`
- `sendMessage`
- `joinGroup`
- `listAdminGroups`
- `createGroup`
- `updateGroup`
- `setMembership`
- `setStudentMessagingBlocked`
- `listStudentModeration`

The root router adds `community: communityRouter`. The web app adds student and admin pages that call this router through the existing tRPC client.

## Data Model

Add Prisma models:

- `CommunityGroup`: group record with title, description, central flag, active flag, created/updated metadata.
- `CommunityGroupMember`: student membership with active flag, join metadata, and optional admin-set membership updates.
- `CommunityMessage`: encrypted text message body, group, student sender, and soft-delete/moderation metadata.
- `CommunityMessageRead`: per-message, per-student read receipt with timestamp.

Extend `StudentPortalSettings`:

- `communityMessagingBlocked Boolean @default(false)`
- `communityMessagingBlockedReasonEnc String?`
- `communityMessagingBlockedById String?`
- `communityMessagingBlockedAt DateTime?`

Add indexes for group activity, group membership, message ordering, and read lookups.

Create one migration that also adds Supabase realtime trigger functions for community group/message/read changes. The broadcast payload will include `groupId`, `operation`, and `occurredAt`, and will be sent to active student users in the affected group plus admin users who can moderate community groups.

## Access Rules

Student read access:

- User must have role `Student`.
- User must map to an active `Student` profile.
- Group must be active.
- Student must be an active member of the group.
- Central group membership may be automatically ensured for all active linked student accounts.

Student send access:

- Must satisfy all read access rules.
- `StudentPortalSettings.communityMessagingBlocked` must be false.
- Message body must be trimmed, non-empty, and capped at 2,000 characters.
- API accepts only text; there is no attachment input.

Admin access:

- Head, Principal, Pastor, and HeadOfDiscipline can create, update, disable groups, manage membership, and block/unblock student messaging.
- TechnicalSupport, ClubsAdmin, ClubsLead, Supervisor, Parent, and Student cannot use admin community procedures unless a future explicit requirement expands the scope.

Read receipts:

- `listGroupMessages` marks messages from other students as read for the current student.
- Admin views do not create student read receipts.
- Message status for the sender is derived from local optimistic state, persisted message presence, and `CommunityMessageRead` rows from other active members.

## Live Behavior

Durable updates use Supabase realtime as the existing private invalidation bus. Community insert/update/read triggers broadcast to relevant user channels; the `RealtimeProvider` invalidates `community.listStudentGroups`, `community.listGroupMessages`, and admin community queries.

Typing indicators use ephemeral Supabase broadcast events from the browser on a private group channel. They are not persisted. The student UI shows the three-dot bubble when another active participant has sent a typing event in the last few seconds.

Message status semantics:

- `Sending`: local optimistic message is queued before mutation settles.
- `Sent`: mutation is in flight or has returned a local optimistic row.
- `Delivered`: API has stored the message and realtime/cache refresh has the persisted id.
- `Read <time>`: at least one other active group member has a read receipt; use the latest read timestamp shown by the API.

This avoids claiming device-level delivery acknowledgement that the platform does not have.

## Student UI

`/student/community` uses the existing student shell and Oasis UI tokens. It presents:

- A page hero for Community.
- Left group list with the central group pinned first.
- Group detail with member count, latest activity, and join button for public active groups.
- iMessage-inspired bubbles: own messages aligned right with blue treatment, others aligned left with white treatment.
- Text-only composer with disabled state when blocked, group inactive, or not joined.
- Inline blocked state with the staff-provided reason when available.
- Sent/delivered/read status under the latest own message.
- Three-dot typing bubble in the conversation stream.

The UI must not include upload controls, attachment buttons, image paste handling, or file inputs.

## Admin UI

`/admin/community` uses the existing admin shell and panel/table patterns. It presents:

- Group list with active/disabled state and central group marker.
- Group creation/edit form for title, description, public join setting, and active state.
- Group detail with recent messages for oversight.
- Membership controls for active students.
- Student moderation table with a messaging enabled/disabled toggle and optional reason.

The Head and Pastor requirement is satisfied by full-admin parity. The implementation uses the existing full-admin set: Head, Principal, Pastor, HeadOfDiscipline.

## Error Handling

- Access denied returns `FORBIDDEN` through tRPC with existing safe error formatting.
- Missing or inaccessible groups return `NOT_FOUND`.
- Blocked students receive a `FORBIDDEN` error with a student-facing message.
- Empty or oversized messages fail input validation.
- Admin moderation changes are audited.

## Testing

Router tests are required before implementation:

- Student can list and read active joined groups.
- Student cannot read groups they have not joined.
- Student can join an active public group.
- Student cannot send when `communityMessagingBlocked` is true.
- Student cannot send attachments because the send input only accepts `groupId` and `body`.
- `listGroupMessages` writes read receipts for unread messages from other students.
- Full admin can create/update groups and block/unblock students.
- Non-full-admin staff cannot use admin moderation procedures.

Frontend verification must cover typecheck and lint. Browser verification should confirm the student and admin pages render without overlap and that the composer, group selection, join state, and moderation controls are usable.

## Rollout

The migration creates the schema and realtime triggers. The central group is ensured lazily by the router so deployments do not depend on seed data. Existing student accounts become central group members when they open the Community page or when admin moderation loads.

Rollback is the reverse migration plus removing the `community` router and UI links. No existing parent/staff message data is modified.

## Open Decisions

- This first slice treats all full-admin roles as community moderators, matching current Oasis full-admin parity.
- Automated content moderation is deferred. Human oversight is required through the admin page.
- Direct student DMs are deferred to avoid expanding safeguarding risk beyond the requested central/group chat model.
