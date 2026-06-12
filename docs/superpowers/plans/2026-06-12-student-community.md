# Student Community Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the student Community tab and admin moderation side with text-only group messaging, realtime updates, read receipts, typing indicators, and per-student messaging disablement.

**Architecture:** Add a dedicated `community` router and Prisma data model rather than extending adult parent/staff messaging. Use encrypted message bodies, full-admin-only moderation, student-only group access, Supabase realtime invalidation for persisted changes, and browser broadcast events for typing presence.

**Tech Stack:** Next.js App Router, React, tRPC, Prisma/Postgres, Supabase Realtime, Vitest, TypeScript, existing Oasis CSS/UI primitives.

---

## File Structure

- Create `apps/api/src/routers/community.ts`: all community tRPC procedures, access helpers, DTO mapping, encryption/decryption, audit writes.
- Create `apps/api/src/__tests__/community.router.test.ts`: fake database tests for student access, blocked sending, read receipts, and admin moderation.
- Modify `apps/api/src/router.ts`: register `communityRouter`.
- Modify `packages/db/prisma/schema.prisma`: add community models and student messaging block fields.
- Create `packages/db/prisma/migrations/20260612180000_student_community/migration.sql`: schema and realtime trigger SQL.
- Modify `apps/web/src/lib/realtime/events.ts`: add community realtime event parsing.
- Modify `apps/web/src/components/providers/realtime-provider.tsx`: invalidate community tRPC queries for realtime events.
- Create `apps/web/src/components/community/community-types.ts`: shared frontend type aliases and date format helpers.
- Create `apps/web/src/components/community/student-community-client.tsx`: student group list, message bubbles, composer, join flow, typing broadcast.
- Create `apps/web/src/components/community/admin-community-client.tsx`: admin group controls, membership controls, student block controls, oversight view.
- Create `apps/web/src/app/(student)/student/community/page.tsx`: student route wrapper.
- Create `apps/web/src/app/(admin)/admin/community/page.tsx`: admin route wrapper.
- Modify `apps/web/src/components/student/student-nav.tsx`: add Community tab.
- Modify `apps/web/src/components/admin/admin-nav.tsx`: add Community admin tab.
- Modify `apps/web/src/app/(admin)/admin/admin.css`: community layout and chat styles.
- Modify `apps/web/src/app/(student)/student/student.css`: student community responsive refinements if needed.
- Modify `scripts/generate-component-map.mjs` and regenerate `docs/architecture/component-relationships.md` if adding the new community product owner changes module ownership.

## Task 1: Backend Failing Tests

**Files:**

- Create: `apps/api/src/__tests__/community.router.test.ts`

- [ ] Write tests that instantiate `router({ community: createCommunityRouter() })` with a fake Prisma-like database.
- [ ] Cover these behaviors:
  - Student can list central and joined active groups.
  - Student cannot read a group without active membership.
  - Student can join an active public group.
  - Blocked student cannot send.
  - Send input accepts only `groupId` and `body`.
  - Reading a group creates `CommunityMessageRead` rows for other students' unread messages.
  - Full admin can create and update groups.
  - Supervisor cannot use admin moderation procedures.
- [ ] Run `pnpm --filter @oasis/api test -- community.router.test.ts`.
- [ ] Expected result before implementation: FAIL because `../routers/community.js` and `community` router procedures do not exist.

## Task 2: Prisma Schema And Migration

**Files:**

- Modify: `packages/db/prisma/schema.prisma`
- Create: `packages/db/prisma/migrations/20260612180000_student_community/migration.sql`

- [ ] Add `CommunityGroup`, `CommunityGroupMember`, `CommunityMessage`, and `CommunityMessageRead` relations to `User` and `Student`.
- [ ] Add community block fields to `StudentPortalSettings`.
- [ ] Add SQL tables, foreign keys, indexes, encrypted body columns, and read receipt constraints.
- [ ] Add realtime SQL functions and triggers for community groups/messages/reads/members.
- [ ] Run `pnpm --filter @oasis/db generate`.
- [ ] Run `pnpm --filter @oasis/api test -- community.router.test.ts`.
- [ ] Expected result: still FAIL until router implementation exists.

## Task 3: Community Router

**Files:**

- Create: `apps/api/src/routers/community.ts`
- Modify: `apps/api/src/router.ts`

- [ ] Implement student helpers:
  - `loadStudentProfile(ctx)`
  - `ensureCentralCommunityGroup(ctx)`
  - `ensureCentralMembership(ctx, studentId)`
  - `assertStudentGroupAccess(ctx, groupId)`
  - `assertStudentCanSend(ctx, groupId)`
- [ ] Implement admin helper:
  - `requireCommunityAdmin(user)` using `isFullAdmin(user)`.
- [ ] Implement tRPC procedures listed in the spec.
- [ ] Encrypt `CommunityMessage.bodyEnc` on send and decrypt it when mapping DTOs.
- [ ] Audit group creation/update, membership changes, message sends, read receipt creation, and student block toggles.
- [ ] Register `community: communityRouter` in `apps/api/src/router.ts`.
- [ ] Run `pnpm --filter @oasis/api test -- community.router.test.ts`.
- [ ] Expected result after implementation: PASS.

## Task 4: Realtime Events

**Files:**

- Modify: `apps/web/src/lib/realtime/events.ts`
- Modify: `apps/web/src/components/providers/realtime-provider.tsx`

- [ ] Add community event constants:
  - `oasis.community_group_changed`
  - `oasis.community_message_changed`
  - `oasis.community_read_changed`
  - `oasis.community_member_changed`
- [ ] Parse `groupId` payloads.
- [ ] Invalidate student and admin community tRPC queries for matching group events.
- [ ] Keep existing message and child notes realtime behavior unchanged.
- [ ] Run `pnpm --filter @oasis/web typecheck`.

## Task 5: Student Community UI

**Files:**

- Create: `apps/web/src/components/community/community-types.ts`
- Create: `apps/web/src/components/community/student-community-client.tsx`
- Create: `apps/web/src/app/(student)/student/community/page.tsx`
- Modify: `apps/web/src/components/student/student-nav.tsx`
- Modify: `apps/web/src/app/(admin)/admin/admin.css`
- Modify: `apps/web/src/app/(student)/student/student.css`

- [ ] Add Community nav item with `MessageCircle` icon.
- [ ] Render group list with central group pinned first.
- [ ] Render iMessage-inspired message bubbles.
- [ ] Use optimistic mutation state so a message appears immediately.
- [ ] Display `Sending`, `Sent`, `Delivered`, and `Read <time>` based on mutation and API data.
- [ ] Add text-only composer with no upload, image, attachment, or paste-file handling.
- [ ] Add Supabase typing broadcast on group channel and render three animated dots for recent remote typing.
- [ ] Disable composer when blocked or not a member.
- [ ] Run `pnpm --filter @oasis/web typecheck`.

## Task 6: Admin Community UI

**Files:**

- Create: `apps/web/src/components/community/admin-community-client.tsx`
- Create: `apps/web/src/app/(admin)/admin/community/page.tsx`
- Modify: `apps/web/src/components/admin/admin-nav.tsx`
- Modify: `apps/web/src/app/(admin)/admin/admin.css`

- [ ] Add Community nav item visible to full admins.
- [ ] Render group list, create form, active toggle, and public join toggle.
- [ ] Render message oversight for selected group.
- [ ] Render student moderation table with block/unblock toggle and reason input.
- [ ] Render membership controls for active students.
- [ ] Run `pnpm --filter @oasis/web typecheck`.

## Task 7: Component Map And Verification

**Files:**

- Modify if needed: `scripts/generate-component-map.mjs`
- Modify generated: `docs/architecture/component-relationships.md`

- [ ] Add community module ownership to `PRODUCT_MODULES` if the generator does not classify the new router/pages correctly.
- [ ] Run `pnpm docs:component-map`.
- [ ] Run `graphify update .`.
- [ ] Run targeted tests:
  - `pnpm --filter @oasis/api test -- community.router.test.ts`
  - `pnpm --filter @oasis/api typecheck`
  - `pnpm --filter @oasis/web typecheck`
  - `pnpm --filter @oasis/web lint`
- [ ] If the migration can run with available env, run `pnpm db:migrate`. If not, record the exact blocker.
- [ ] Start the web app and verify `/student/community` and `/admin/community` in the Browser plugin if local app startup succeeds.
