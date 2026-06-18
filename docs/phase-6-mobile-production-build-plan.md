# Phase 6 - Mobile production build PR plan

**Status:** Planned - refreshed against current portal surfaces
**Last updated:** 2026-06-18
**Parent plan:** [`/oasis-platform-plan.md`](/oasis-platform-plan.md) Delivery phases
**Project context:** [`/PROJECT_Oasis_Context.md`](/PROJECT_Oasis_Context.md)

---

## Purpose

Phase 6 turns the existing Expo mobile smoke app into the production iOS,
Android, and temporary installable PWA path for Supervisor/staff, Parent, and
Student users.

This document intentionally lists the PR sequence, goal, plan, and acceptance
criteria only. Implementation details belong in the individual PR branches when
each step is started.

Current state:

- `apps/mobile` already has Clerk, Expo Router, React Query, and typed tRPC
  wiring.
- Mobile screens currently live under `apps/mobile/src/components/smoke`.
- Existing smoke screens prove Supervisor, Parent, Clubs, Student wallet, PACE,
  leaderboard, shop, and More navigation paths can call the backend.
- Current web/API surfaces now include staff communications, rota self-service,
  incident reporting, club lead operations, reservation collection, parent
  settings, registration/profile maintenance, parent incidents, reports/ranks,
  student access policy, student communications/community, homework/activity,
  Faith Corner, notifications, and Phase 8 market-data constraints.
- The production build still needs route structure, reusable primitives,
  production user flows, PWA readiness, e2e coverage, and EAS release readiness.

PWA distribution guardrail:

- The PWA is a distribution path for the same Expo mobile app, not a separate
  mobile-web product. PWA work must keep Clerk Expo auth, typed tRPC, iOS bundle
  ID, Android package name, and native Expo/EAS builds intact.
- Web-only installability, service worker, and offline-shell code must stay
  isolated to the Expo web path. Do not add Capacitor, a Trusted Web Activity
  wrapper, or a separate mobile web app in Phase 6.
- The service worker must not cache `/api/*`, tRPC responses, decrypted PII, or
  role data. Offline fallback may show only a static no-private-data shell.

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
   student settings/account controls, profile and registration maintenance,
   messages, notices, clubs, shop reservation, permission slips, fees, calendar,
   incidents, reports, and ranks where current APIs support them.
5. Student users can complete the planned mobile paths for dashboard,
   notifications, access-policy gates, wallet, permitted wallet actions, PACE
   and attendance where enabled, homework/activity, clubs, Faith Corner, ranks,
   shop, and student communications only where current policy allows them.
6. Staff users can complete the planned mobile paths for daily home,
   communications, rota and availability, attendance, behaviour, incidents,
   PACE, clubs, and shop counter/reservation collection where role/tag policy
   allows.
7. Loading, empty, error, denied, pending, and success states are covered on
   production screens.
8. Existing RBAC, RLS, encryption, and audit boundaries remain enforced by the
   owning API routers.
9. PWA installability, manifest metadata, service worker generation, offline
   shell, and Expo web export are verified without weakening native builds.
10. Mobile e2e or documented manual UAT covers Parent, Student, Supervisor,
    shopkeeper/shopadmin, ClubsAdmin, and club lead paths.
11. iOS and Android Expo exports pass, and EAS internal builds install on target
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
- Student mobile screens must consume student-safe projections only. Do not show
  surname/full name, DOB, email, supervisor names, Sensitive behaviour reasons,
  parent-only notes, internal records, or raw ledger reasons unless a
  student-safe API contract explicitly allows it.
- Heavy Head/admin operations remain web-first unless separately scoped:
  invoices administration, permission-slip management/payment confirmation,
  full calendar management, reports authoring, audit, access administration,
  people profile administration, academic settings, and incident sign-off or
  parent-copy release.
- Investment trading surfaces must wait for Phase 8 server-backed market data
  contracts or be limited to read-only balances with clear educational copy.
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

### PR-6.3A - `feat(mobile): add PWA readiness gates`

Goal:

- Add the temporary installable PWA path for the existing Expo mobile app before
  production role routes depend on it.

Plan:

- Add Expo web export configuration, PWA manifest/icons, web metadata,
  install-panel behaviour for Chromium and iOS, standalone-mode handling,
  service worker generation, and a static offline fallback.
- Keep web-only PWA code guarded to the Expo web path.
- Do not cache API/tRPC responses or private role data.
- Do not add Capacitor, a Trusted Web Activity wrapper, or a separate mobile web
  codebase.

Done criteria:

- `pnpm --filter @oasis/mobile build:web` produces the static web output.
- PWA checks verify manifest metadata, service worker output, install metadata,
  and no-private-data offline fallback.
- iOS and Android Expo exports still pass after the PWA additions.
- Clerk Expo auth, typed tRPC setup, iOS bundle ID, and Android package name are
  unchanged.

### PR-6.4 - `feat(mobile): add production auth routing`

Goal:

- Route authenticated users into production Parent, Student, or Staff mobile
  route groups without flattening role-specific staff/admin outcomes.

Plan:

- Split sign-in, MFA, SSO callback, session loading, and role routing away from
  the smoke router.
- Preserve Clerk token handling and typed tRPC provider setup.
- Preserve existing post-sign-in outcomes for full-admin, TechnicalSupport,
  ClubsAdmin, ClubsLead, Supervisor, Parent, Student, 2FA, not-ready, and denied
  states.
- Keep unsupported staff/admin variants in clear not-ready or access-denied
  states instead of silently routing them into the wrong shell.

Done criteria:

- Signed-in users resolve to production role route groups.
- Signed-out users still see the mobile auth flow.
- Smoke router is no longer the production entrypoint.
- Unsupported or web-first role variants are denied or signposted explicitly.

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

### PR-6.5A - `feat(mobile): build staff communications`

Goal:

- Add the staff communication paths needed for daily mobile operations.

Plan:

- Add staff noticeboard read/mark-read, unread badges, Staffroom, supervisor to
  Head, and staff-direct conversation paths where current message policy allows.
- Reuse the existing `notice` and `message` routers.
- Keep parent-facing messaging in the parent PR sequence.

Done criteria:

- Staff users see current staff notices and unread state.
- Authorised staff can read/send permitted staff conversations.
- Denied, empty, loading, sending, and failed-send states are visible.

### PR-6.5B - `feat(mobile): build staff rota and availability`

Goal:

- Add staff rota self-service beyond the home summary.

Plan:

- Add today's rota, weekly/monthly rota views, own availability maintenance, and
  shift swap request/status surfaces where current APIs support them.
- Keep Head rota scheduling and approval administration web-first unless a later
  PR explicitly scopes it.

Done criteria:

- Staff users can inspect rota and maintain permitted availability from mobile.
- Shift swap request and status states are visible where policy allows.
- Scheduling/approval-only controls do not appear for unauthorised users.

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

### PR-6.8A - `feat(mobile): build staff incident reporting`

Goal:

- Add mobile incident capture for staff users while keeping review/release
  decisions in the existing web-first Head workflow.

Plan:

- Add create/update draft, parent-safe summary preview where available, evidence
  attachment affordances where current APIs support them, and submit for Head
  review.
- Keep Head sign-off, escalation, parent-copy release, and PDF administration
  web-first unless separately scoped.

Done criteria:

- Authorised staff can draft and submit an incident from mobile.
- Validation, attachment, pending, submitted, and failed-submit states are
  visible.
- Parent-copy release and Sensitive details remain governed by existing API
  policy.

### PR-6.9 - `feat(mobile): build club lead operations`

Goal:

- Add production mobile club operations for assigned club leads and authorised
  club staff.

Plan:

- Add club roster, club attendance sessions, club task/activity status, club
  rota/availability context, and club notices where current APIs support the
  workflow.
- Keep broad club creation/editing and lead assignment web-first unless
  separately scoped.
- Scope access to full-admin, ClubsAdmin, or assigned club leads as supported by
  existing API policy.

Done criteria:

- Authorised club users can view expected club data.
- Unauthorised staff cannot access club manager data.
- Any write path has pending, success, and error feedback.

### PR-6.9A - `feat(mobile): build club manager operations`

Goal:

- Add the mobile club-management surfaces that are justified for ClubsAdmin and
  full-admin users.

Plan:

- Add manager roster views, club notification send/history, attendance review,
  and club rota inspection where current APIs support them.
- Explicitly defer club creation/editing, lead assignment, and policy-heavy
  administration to web if they are not mobile-critical.

Done criteria:

- ClubsAdmin/full-admin users can complete the scoped mobile manager tasks.
- Assigned club leads cannot access manager-only controls.
- Deferred web-first controls are not half-built in mobile.

### PR-6.10 - `feat(mobile): build staff shop counter flow`

Goal:

- Add the mobile shopkeeper counter purchase and reservation collection flow.

Plan:

- Add pending reservation list, reservation collection, student selection, item
  selection, quantity, balance/stock check, confirmation, pending state, and
  completion state.
- Keep item management web-first unless separately scoped later.

Done criteria:

- Authorised shopkeepers can record purchases and collect reservations.
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

### PR-6.11A - `feat(mobile): build parent profile and registration maintenance`

Goal:

- Give parents a mobile path for account/profile and family setup work before
  child-dependent flows assume those links exist.

Plan:

- Add own profile edit, spouse invite status/action, registration review/edit,
  add-sibling flow, and confirm/reject student-parent link requests where current
  APIs support them.
- Show pending-link, rejected-link, no-linked-child, validation, pending, and
  success states.

Done criteria:

- Parents can maintain their own profile and family registration state from
  mobile where the existing web/API flow allows it.
- Pending or missing child links have a clear next action.
- No raw invitation or credential secrets are displayed.

### PR-6.11B - `feat(mobile): build parent student settings controls`

Goal:

- Add parent-controlled student portal settings before child account, shop, and
  student mobile flows depend on them.

Plan:

- Add linked-child settings status, child login creation, login handle display,
  password setup/reset action, password-control toggle, usage limits, child icon
  upload, parent lock/reason, and merit-shop block through the existing
  `studentSettings` router.
- Show adult-child read-only state when parent control no longer applies.
- Sequence this before student and shop mobile PRs because locks, usage limits,
  and shop blocks affect later flows.

Done criteria:

- Parents can update permitted under-18 student settings from mobile.
- Adult, unlinked, locked, denied, pending, success, and error states are
  visible.
- Account locks and shop blocks remain enforced by backend policy.

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

### PR-6.12A - `feat(mobile): build parent reports and ranks`

Goal:

- Add parent report and positive rank inspection without exposing staff-only
  workflow controls.

Plan:

- Add sent term report list/detail per linked child.
- Add positive leaderboard/rank views with linked-child callouts.
- Keep report draft/review/send controls and Highest Demerits out of parent
  mobile.

Done criteria:

- Parent can inspect released reports and allowed ranks for linked children.
- Draft or staff-only report state is not exposed.
- Restricted leaderboard data is not exposed.

### PR-6.12B - `feat(mobile): build parent incident reports`

Goal:

- Add parent-safe incident report access on mobile.

Plan:

- List signed-off parent copies, filter by linked child, preview parent-safe
  summary, open/download the parent copy PDF where supported, acknowledge
  receipt, and link to messages for follow-up.
- Do not expose staff draft, Head sign-off, escalation, or Sensitive internal
  review fields.

Done criteria:

- Parents can inspect and acknowledge released incident reports.
- Unreleased, unrelated-child, or staff-only incident data is denied.
- PDF/download failures and acknowledgement failures are visible.

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

### PR-6.15 - `feat(mobile): build parent shop reservations`

Goal:

- Add parent shop reservation and cart surfaces supported by existing APIs.

Plan:

- Add shop browsing, cart, reservation submit, reservation status, and stock or
  balance failure states where policy allows.
- Respect parent-set student shop blocks and tithe-due shop blocks.

Done criteria:

- Parent can reserve shop items where policy allows.
- Denied, blocked, out-of-stock, insufficient-balance, pending, success, and
  error states are clear.
- Reservation state refreshes after successful submission.

### PR-6.15A - `feat(mobile): build parent permission slips`

Goal:

- Add parent permission-slip review, signing, and payment-state surfaces.

Plan:

- Add active/past permission-slip list, child-specific detail, signature action,
  payment required/paid state, and file/PDF access where current APIs support
  them.
- Keep staff creation, payment confirmation, and permission-slip administration
  web-first.

Done criteria:

- Parents can sign eligible permission slips from mobile.
- Payment-required, already-signed, expired, pending, success, and failure states
  are visible.
- Staff-only permission-slip fields are not exposed.

### PR-6.15B - `feat(mobile): build parent fees and invoices`

Goal:

- Add parent fee and invoice inspection on mobile.

Plan:

- Add invoice summary, balance state, invoice detail, payment instructions, and
  PDF/download access where current APIs support them.
- Keep discounts, payment confirmation, and invoice administration web-first.

Done criteria:

- Parents can inspect fee balance and invoice detail for linked children.
- Paid, outstanding, discounted, empty, download-failed, and error states are
  visible.
- Parent access remains linked-child scoped.

### PR-6.15C - `feat(mobile): build parent calendar`

Goal:

- Add parent calendar inspection on mobile.

Plan:

- Add upcoming events, linked-child relevant event filtering, event detail, and
  empty/error states using the existing calendar owner.
- Keep full calendar management web-first unless separately scoped.

Done criteria:

- Parents can inspect relevant calendar events from mobile.
- Event visibility remains scoped by existing API policy.
- Calendar authoring controls are not exposed to parent mobile users.

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

### PR-6.16A - `feat(mobile): add student portal access gate`

Goal:

- Add a reusable student mobile access gate before production student feature
  screens rely on policy state.

Plan:

- Call the existing student dashboard, portal usage, and heartbeat procedures
  needed to establish student access state.
- Render locked, off-limit day, usage-limit, no-profile, denied, loading, retry,
  and normal states.
- Reuse the gate across all student mobile routes.

Done criteria:

- Student routes consistently enforce account lock, usage limit, off-limit day,
  and no-linked-profile states.
- Heartbeat/usage tracking failures are visible and do not masquerade as
  successful access.
- Parent and staff users cannot enter student-only mobile surfaces through the
  gate.

### PR-6.17 - `feat(mobile): build student wallet actions`

Goal:

- Add permitted Student wallet actions.

Plan:

- Add Spend/Saving transfers where existing API policy allows.
- Defer production investment buy/sell until Phase 8 server-backed market-data
  contracts are available, or keep investment mobile read-only with clear
  educational copy and no client-side price conversion.
- Handle insufficient balance, denied action, pending, success, and API error
  states.

Done criteria:

- Permitted Spend/Saving actions work through existing wallet APIs.
- Investment actions are server-backed by Phase 8 contracts or explicitly
  deferred/read-only.
- Denied or invalid actions do not appear successful.
- Balances refresh after successful mutations.

### PR-6.18 - `feat(mobile): build student learning status`

Goal:

- Add Student PACE, attendance, and rank inspection beyond wallet.

Plan:

- Add PACE results, attendance where enabled, positive leaderboards/ranks, and
  next learning signals where policy allows.
- Keep Highest Demerits unavailable to normal Student users.

Done criteria:

- Student can inspect PACE, attendance, and positive rank data.
- Restricted leaderboard data is not exposed.

### PR-6.18A - `feat(mobile): build student homework and activity`

Goal:

- Add student-safe homework/activity surfaces on mobile.

Plan:

- Add assigned activity list, activity detail, submission or completion state
  where current APIs allow it, attachment/image affordances where supported, and
  empty/error states.
- Use "club task" or "activity" language where the work is not academic
  homework.

Done criteria:

- Student can inspect assigned work and complete supported actions.
- Denied, blocked messaging, submitted, pending, empty, and error states are
  visible.
- Parent-only notes, staff-only comments, and internal review fields are not
  exposed.

### PR-6.18B - `feat(mobile): build student clubs and Faith Corner`

Goal:

- Add student club and Faith Corner inspection where current APIs allow it.

Plan:

- Add student club list/detail, schedule or session state, club notices/tasks,
  and Faith Corner read surfaces.
- Keep club management and staff moderation controls out of student mobile.

Done criteria:

- Student can inspect own club and Faith Corner surfaces.
- Empty, denied, blocked, loading, and error states are visible.
- Staff-only club data and moderation controls are not exposed.

### PR-6.18C - `feat(mobile): build student notifications`

Goal:

- Add student-safe notification surfaces on mobile.

Plan:

- Add update list, unread/read state, notification detail, mark-read behaviour,
  and refresh handling through the existing notification owner.
- Do not expose internal audit or recipient metadata.

Done criteria:

- Student can inspect and mark permitted notifications read.
- Read/unread state refreshes after action.
- Empty and failed-refresh states are visible.

### PR-6.18D - `feat(mobile): decide and build student communications`

Goal:

- Resolve and implement the mobile student communications policy.

Plan:

- Before implementation, make an explicit decision: include mobile StudentDirect
  and community messaging, or defer/hide Messages and Community from production
  mobile.
- If included, add StudentDirect/community with moderation, blocked messaging
  states, read receipts, no public profiles, no friend lists, and audit-safe
  errors.
- If deferred, remove or hide production mobile entry points and document the
  deferral.

Done criteria:

- Production mobile does not expose an ambiguous or half-built student Messages
  surface.
- Included communication paths respect existing moderation and blocked-message
  policy.
- Deferred paths are clearly absent from production navigation.

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

- Cover Parent login, child home, settings, message read/send, club signup,
  incident acknowledgement, permission-slip signature, fees, calendar, and shop
  reservation.
- Cover Student login, access gate, wallet, transfer, PACE/attendance,
  notifications, homework/activity, ranks, shop, and whichever communications
  policy is selected.
- Cover Staff login, communications, rota/availability, attendance mark,
  behaviour log, incident submission, PACE entry, club lead operations, and shop
  reservation collection.

Done criteria:

- Critical journeys are covered on iOS and Android where local tooling allows.
- Credential-gated skips are documented.
- Failures provide useful debugging context.

### PR-6.20A - `test(mobile): cover PWA installability and offline shell`

Goal:

- Add PWA-specific verification for the temporary mobile web distribution path.

Plan:

- Cover Expo web export, manifest metadata, install metadata, service worker
  generation, no API/tRPC runtime caching, static offline fallback, and
  standalone-mode behaviour.
- Keep the checks focused on PWA infrastructure rather than role-flow parity.

Done criteria:

- PWA checks fail if install metadata, service worker output, or offline shell
  regress.
- Checks prove private data and API responses are not cached by the service
  worker.
- Native iOS and Android exports still pass with the PWA code present.

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

### PR-6.22 - `chore(mobile): document PWA deployment path`

Goal:

- Document the temporary HTTPS PWA deployment path without replacing the native
  Expo/EAS release path.

Plan:

- Document the static web build command, output directory, runtime tRPC target,
  Clerk allowed origins/redirects, OAuth redirect settings, HTTPS requirement,
  install testing checklist, and rollback path.
- Keep `apps/web` as the API owner and keep PWA deployment separate from the
  main web portal deployment.

Done criteria:

- PWA deployment can be repeated from documentation.
- Clerk and OAuth redirect requirements are listed before user testing.
- Native EAS release remains the app-store path.

---

## Standard verification per PR

Run the relevant subset for each PR:

- `pnpm --filter @oasis/mobile typecheck`
- `pnpm --filter @oasis/mobile lint`
- `pnpm --filter @oasis/mobile build:web` for PWA or web-export PRs.
- `pnpm --filter @oasis/mobile pwa:check` after PWA scripts exist.
- `pnpm --filter @oasis/mobile test:pwa` after PWA tests exist.
- iOS Expo export for UI/navigation PRs.
- Android Expo export before each role-flow sprint closes.
- Relevant API/domain tests only if an existing router contract changes.
- `git diff --check`
- `graphify update .` after modifying code files.

Phase closeout:

- Full mobile e2e on iOS and Android.
- PWA installability and offline-shell checks.
- Internal EAS install on target devices.
- Parent, Student, Supervisor, shopkeeper, ClubsAdmin, club lead, and PWA UAT.
