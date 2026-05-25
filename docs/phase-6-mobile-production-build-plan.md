# Phase 6 - Mobile production build PR plan

**Status:** Planned
**Last updated:** 2026-05-25
**Parent plan:** [`/oasis-platform-plan.md`](/oasis-platform-plan.md) Delivery phases
**Project context:** [`/PROJECT_Oasis_Context.md`](/PROJECT_Oasis_Context.md)

---

## Purpose

Phase 6 turns the existing Expo mobile smoke app into the production iOS and
Android app for Supervisor/staff, Parent, and Student users.

This document intentionally lists the PR sequence, goal, plan, and acceptance
criteria only. Implementation details belong in the individual PR branches when
each step is started.

Current state:

- `apps/mobile` already has Clerk, Expo Router, React Query, and typed tRPC
  wiring.
- Mobile screens currently live under `apps/mobile/src/components/smoke`.
- Existing smoke screens prove Supervisor, Parent, Clubs, Student wallet, PACE,
  leaderboard, shop, and More navigation paths can call the backend.
- The production build still needs route structure, reusable primitives,
  production user flows, e2e coverage, and EAS release readiness.

Design source:

- Every Phase 6 UI PR must reference `design/Oasis Learning Center.zip` in the
  same session before changing mobile layout, components, colours, spacing,
  typography, icons, or interaction states.

Mobile user-flow criteria:

- Start each role on the next action that matters today: staff see daily
  operational work, parents see their selected child and urgent actions, and
  students see learning and wallet state.
- Preserve the Oasis visual language from the design handoff: soft blue page
  background, navy staff chrome, crimson parent chrome, green clubs chrome,
  white cards, compact stat blocks, badges, avatars, and bottom navigation.
- Keep primary mobile screens task-led with one dominant action, then secondary
  inspection or history below it.
- Use familiar native controls for the job: segmented controls for modes,
  toggles for binary choices, fields for data entry, badges for policy/status,
  and icon-led navigation for repeated destinations.
- Avoid explanatory feature copy inside the app. The interface should make the
  next step obvious through hierarchy, labels, state, and feedback.
- Treat loading, empty, denied, pending, success, and error states as part of
  the user journey, not as afterthoughts.
- Keep parent and student flows calm and inspection-first; keep staff flows
  fast, dense, and action-first for repeated centre use.
- Preserve backend policy boundaries in every flow. UI affordances must reflect
  permissions, but API/RBAC/RLS policy remains the source of truth.

---

## Phase-level acceptance criteria

Phase 6 is complete when:

1. Production mobile routes no longer import from `components/smoke`.
2. Parent, Student, and Staff users have production mobile route groups.
3. Shared Oasis mobile tokens, primitives, and shell components are reused
   across role flows.
4. Parent users can complete the planned mobile paths for child overview,
   messages, notices, clubs, shop reservation, permission slips, fees, and
   calendar where current APIs support them.
5. Student users can complete the planned mobile paths for dashboard, wallet,
   permitted wallet actions, PACE results, leaderboards, and shop.
6. Staff users can complete the planned mobile paths for daily home,
   attendance, behaviour, PACE, clubs, and shop counter where role/tag policy
   allows.
7. Loading, empty, error, denied, pending, and success states are covered on
   production screens.
8. Existing RBAC, RLS, encryption, and audit boundaries remain enforced by the
   owning API routers.
9. Mobile e2e or documented manual UAT covers Parent, Student, Supervisor,
   shopkeeper/shopadmin, and ClubsAdmin paths.
10. iOS and Android Expo exports pass, and EAS internal builds install on target
    devices.

---

## PR guardrails

- Keep one review mental model per PR.
- Prefer screen-level PRs over role-wide PRs.
- Backend changes must extend existing routers only.
- Do not add a separate `mobile` API router.
- Do not add a styling framework in Phase 6 unless a later PR proves the
  current Expo stack cannot meet the requirement.
- A mechanical move PR must not also add new behaviour.
- If a PR changes product ownership paths, update
  `scripts/generate-component-map.mjs`, run `pnpm docs:component-map`, and
  include the regenerated component map.

---

## PR sequence

### PR-6.0 - `docs: plan phase 6 mobile production build`

Goal:

- Create the Phase 6 production mobile build plan and point the wider phase
  docs at it.

Plan:

- Add this document.
- Update the master platform plan to include Phase 6.
- Update Phase 5 references so launch hardening depends on Phase 6 mobile
  outputs rather than smoke screens.
- Record the planning session in the project context document.

Done criteria:

- Phase 6 appears in the master phase list.
- Phase 5 no longer owns the production mobile app build.
- No app code or mobile screen implementation changes are included.

### PR-6.1 - `refactor(mobile): extract Oasis mobile tokens`

Goal:

- Create the production mobile token layer before any production screen work.

Plan:

- Move reusable colours, spacing, typography, radii, shadows, and role theme
  rules out of the smoke folder.
- Keep current smoke screens compiling.
- Do not change user-facing behaviour.

Done criteria:

- Production token exports exist under a non-smoke mobile path.
- Smoke screens can still import compatible tokens.
- Mobile typecheck and lint pass.

### PR-6.2 - `refactor(mobile): add core native UI primitives`

Goal:

- Establish the reusable production UI primitives required by later screens.

Plan:

- Add Button, Card, Badge, Field, LoadingState, EmptyState, ErrorState, Avatar,
  SegmentedControl, and InlineSpinner primitives.
- Keep props typed and limited to the needs already visible in planned screens.
- Do not migrate full role screens yet.

Done criteria:

- Core primitives exist under a non-smoke mobile path.
- Primitives use Oasis tokens.
- No role workflow behaviour changes are included.

### PR-6.3 - `refactor(mobile): add production app shell`

Goal:

- Provide production shell components for role apps.

Plan:

- Add screen wrapper, role header, bottom navigation, More drawer,
  access-denied state, and not-ready state.
- Keep shell components independent of Parent, Student, and Staff data.

Done criteria:

- Shell exports are available from non-smoke paths.
- Existing smoke app still compiles.
- Shell PR does not implement a role journey.

### PR-6.4 - `feat(mobile): add production auth routing`

Goal:

- Route authenticated users into production Parent, Student, or Staff mobile
  route groups.

Plan:

- Split sign-in, MFA, SSO callback, session loading, and role routing away from
  the smoke router.
- Preserve Clerk token handling and typed tRPC provider setup.
- Keep unsupported users in a clear not-ready or access-denied state.

Done criteria:

- Signed-in users resolve to production role route groups.
- Signed-out users still see the mobile auth flow.
- Smoke router is no longer the production entrypoint.

### PR-6.5 - `feat(mobile): build staff mobile home`

Goal:

- Create the staff daily command centre.

Plan:

- Add rota summary, today's attendance status, behaviour quick action, PACE
  quick action, and authorised shop/clubs shortcuts.
- Keep write workflows for later PRs.

Done criteria:

- Staff home loads role-appropriate summary data.
- Empty, loading, error, and denied states are visible.
- No attendance, behaviour, or PACE write flow is implemented in this PR.

### PR-6.6 - `feat(mobile): build staff attendance flow`

Goal:

- Add production attendance capture for staff mobile users.

Plan:

- Add roster loading, status selection, save flow, pending state, success state,
  and error state.
- Reuse the existing attendance router unless a small read model is needed.

Done criteria:

- Authorised staff can mark attendance from mobile.
- Unauthorised users are denied by API policy.
- Save failures are visible and do not lose user context.

### PR-6.7 - `feat(mobile): build staff behaviour flow`

Goal:

- Add production Merit/Demerit capture for staff mobile users.

Plan:

- Add student selection, type selection, category, note, General/Sensitive
  display, validation, pending state, and success feedback.
- Keep Sensitive visibility enforced by existing backend policy.

Done criteria:

- Authorised staff can submit valid behaviour entries.
- Invalid entries show field-level or form-level feedback.
- Sensitive handling is not UI-only.

### PR-6.8 - `feat(mobile): build staff PACE flow`

Goal:

- Add production PACE score entry on mobile.

Plan:

- Add student and subject selection, test type, score input, policy warning or
  block state, pending state, and success feedback.

Done criteria:

- Authorised users can record valid PACE scores.
- Policy warnings and blocked submissions are clearly shown.
- Failed submissions preserve entered context.

### PR-6.9 - `feat(mobile): build staff clubs flow`

Goal:

- Add production mobile club operations for authorised club users.

Plan:

- Add club roster, club attendance, and club notices where current APIs support
  the workflow.
- Scope access to full-admin, ClubsAdmin, or assigned club leads as supported by
  existing API policy.

Done criteria:

- Authorised club users can view expected club data.
- Unauthorised staff cannot access club manager data.
- Any write path has pending, success, and error feedback.

### PR-6.10 - `feat(mobile): build staff shop counter flow`

Goal:

- Add the mobile shopkeeper counter purchase flow.

Plan:

- Add student selection, item selection, quantity, balance/stock check,
  confirmation, pending state, and completion state.
- Keep item management web-first unless separately scoped later.

Done criteria:

- Authorised shopkeepers can record purchases.
- Insufficient stock or balance is handled clearly.
- Stock and Spend updates are driven by the existing shop API.

### PR-6.11 - `feat(mobile): build parent home and child switcher`

Goal:

- Create the Parent mobile landing experience.

Plan:

- Add linked-child switching, urgent actions, selected child summary, unread
  messages, notices, club prompts, fee state, and permission-slip prompts where
  existing APIs support them.

Done criteria:

- Parent home works with one child and multiple linked children.
- Empty linked-child state is handled.
- Parent access remains scoped to linked children.

### PR-6.12 - `feat(mobile): build parent child detail`

Goal:

- Add the Parent read-only child detail flow.

Plan:

- Add attendance, PACE, visible behaviour, visible notes, report summary, and
  wallet read-only panels.
- Do not allow wallet movement unless existing API policy allows it.

Done criteria:

- Parent can inspect child data from one detail screen.
- Sensitive or unlinked-child data is not exposed.
- Empty child sub-panels are clear and non-broken.

### PR-6.13 - `feat(mobile): build parent messages`

Goal:

- Add production parent messaging on mobile.

Plan:

- Add inbox, thread detail, new message, reply composer, read refresh, empty
  state, and error state.

Done criteria:

- Parent can read and send messages.
- Thread state refreshes after send/read actions.
- Empty and error states are usable.

### PR-6.14 - `feat(mobile): build parent clubs and notices`

Goal:

- Add parent club and notice workflows on mobile.

Plan:

- Add club signup/withdrawal, club notices, staff notices, unread states, and
  refresh behaviour.

Done criteria:

- Parent can sign up or withdraw linked children where allowed.
- Club and staff notices render with read/unread states.
- Full or unavailable club states are clear.

### PR-6.15 - `feat(mobile): build parent shop and admin forms`

Goal:

- Add remaining parent action surfaces supported by existing APIs.

Plan:

- Add parent shop reservation flow.
- Add parent permission slips, fees, and calendar surfaces where existing APIs
  are sufficient.
- Split backend work first if a workflow needs more than a small existing-router
  read model.

Done criteria:

- Parent can reserve shop items where policy allows.
- Parent can complete supported administrative forms from mobile.
- Unsupported or web-first actions are clearly signposted, not half-built.

### PR-6.16 - `feat(mobile): build student home and wallet`

Goal:

- Create the Student mobile landing and wallet read experience.

Plan:

- Add balance overview, week/month activity, next learning signal, shop
  affordance, wallet account cards, and recent activity.

Done criteria:

- Student only sees their own linked student data.
- Wallet read states cover Spend, Saving, Investment, TithePaid, and activity.
- Empty or no-linked-student states are handled.

### PR-6.17 - `feat(mobile): build student wallet actions`

Goal:

- Add permitted Student wallet actions.

Plan:

- Add Spend/Saving transfers and investment buy/sell actions where existing API
  policy allows.
- Handle insufficient balance, denied action, pending, success, and API error
  states.

Done criteria:

- Permitted actions work through existing wallet/investment APIs.
- Denied or invalid actions do not appear successful.
- Balances refresh after successful mutations.

### PR-6.18 - `feat(mobile): build student learning and rewards`

Goal:

- Add Student learning and reward surfaces beyond wallet.

Plan:

- Add PACE results, leaderboards, shop browsing, and shop reservation where
  policy allows.
- Keep Highest Demerits unavailable to normal Student users.

Done criteria:

- Student can inspect PACE results and positive leaderboards.
- Student shop path follows current policy.
- Restricted leaderboard data is not exposed.

### PR-6.19 - `test(mobile): add mobile e2e harness`

Goal:

- Add the mobile e2e foundation.

Plan:

- Add Maestro configuration and scripts.
- Add first stable login/navigation smoke flows for one Parent, one Student,
  and one Staff account.
- Keep credential-gated flows skipped or documented when env vars are absent.

Done criteria:

- Mobile e2e command is documented.
- Basic auth/navigation coverage exists.
- Missing credentials fail safely or skip clearly.

### PR-6.20 - `test(mobile): cover production user journeys`

Goal:

- Add critical-path production mobile journey coverage.

Plan:

- Cover Parent login, child home, message read/send, club signup, and shop
  reservation.
- Cover Student login, wallet, transfer, PACE, leaderboard, and shop.
- Cover Staff login, attendance mark, behaviour log, and PACE entry.

Done criteria:

- Critical journeys are covered on iOS and Android where local tooling allows.
- Credential-gated skips are documented.
- Failures provide useful debugging context.

### PR-6.21 - `chore(mobile): configure EAS internal builds`

Goal:

- Prepare internal mobile distribution and release-candidate builds.

Plan:

- Add EAS profiles for internal iOS, internal Android, release-candidate iOS,
  and release-candidate Android.
- Document required env vars, build commands, device install checklist, UAT
  script, and known limitations.
- Keep store submission behind human approval.

Done criteria:

- EAS config is present and validated.
- Internal builds install on target devices.
- Parent, Student, Supervisor, shopkeeper, and ClubsAdmin UAT paths are signed
  off or explicitly blocked.

---

## Standard verification per PR

Run the relevant subset for each PR:

- `pnpm --filter @oasis/mobile typecheck`
- `pnpm --filter @oasis/mobile lint`
- iOS Expo export for UI/navigation PRs.
- Android Expo export before each role-flow sprint closes.
- Relevant API/domain tests only if an existing router contract changes.
- `git diff --check`
- `graphify update .` after modifying code files.

Phase closeout:

- Full mobile e2e on iOS and Android.
- Internal EAS install on target devices.
- Parent, Student, Supervisor, shopkeeper, and ClubsAdmin UAT.
