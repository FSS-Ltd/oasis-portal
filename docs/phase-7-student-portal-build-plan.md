# Phase 7 - Student portal build PR plan

**Status:** Planned
**Last updated:** 2026-06-03
**Parent plan:** [`/oasis-platform-plan.md`](/oasis-platform-plan.md) Delivery phases
**Project context:** [`/PROJECT_Oasis_Context.md`](/PROJECT_Oasis_Context.md)
**Requirements source:** `Oasis Student Portal Requirements.docx`
**Design source:** [`/design/Oasis Learning Center.zip`](/design/Oasis%20Learning%20Center.zip)

---

## Purpose

Phase 7 builds the student-facing portal layer for Oasis Learning Centre.
Students get a distinct portal experience, while parents keep visibility and
control over linked children until the child is 18 or older.

This document is the sprint plan. Each feature is broken into a focused PR with
clear scope, dependencies, and done criteria. Implementation details belong in
the individual PR branches when each step starts.

Current state:

- The web app already has role-aware Parent, Supervisor, Clubs Lead, and Admin
  shells.
- `Student` is already a first-class role in the database and RBAC layer.
- `Student.userId` already links a student profile to a login user.
- `Guardian` already links parent/carer users to student records.
- Existing routers already own much of the underlying data: `student`, `shop`,
  `meritLedger`, `pace`, `attendance`, `club`, `notice`, and `profile`.
- There is no current model for parent-controlled student portal settings,
  usage limits, account locks, or merit-shop blocking.

Terminology guardrail:

- Use "Learning Centre", not "school".
- Use "Supervisor", not "teacher".
- Use "Group" or "Age band", not "class", "grade", or "year group" in new
  student-facing copy.
- Use "attending" or "active", not "enrolled" in new student-facing copy.
- Use "club task" or "activity", not "homework".

Design guardrail:

- Every Phase 7 UI PR must reference `design/Oasis Learning Center.zip` in the
  same session before changing student or parent portal layout, components,
  colours, spacing, typography, icons, assets, or interaction states.
- Primary references are `Oasis Student Portal.html`, `parent-portal.jsx`,
  `student-snapshot.jsx`, `shop.jsx`, `shared-data.jsx`, and the included
  screenshots.

---

## Phase-level acceptance criteria

Phase 7 is complete when:

1. Student users can sign in and land in a production `/student` portal.
2. Parents can configure linked-child student settings, credentials, usage
   limits, account locks, and merit-shop access.
3. Students can manage their password only when parent policy allows it or when
   they are 18 or older.
4. Parents retain account control for under-18 linked children.
5. Parent control is disabled for students who are 18 or older, except for
   parent-visible read-only data already allowed by platform policy.
6. Head users can lock or unlock a student portal account for academic reasons.
7. Account locks and shop blocks are enforced by backend policy, not only hidden
   in the UI.
8. Usage limits are enforced for student portal access once the usage tracking
   PR lands.
9. Students see only student-safe data: no sensitive behaviour reasons,
   supervisor names, surnames, DOB, email, parent-only notes, or internal admin
   records unless explicitly allowed by the requirements.
10. No student-to-student messaging, public profiles, or social visibility is
    introduced.
11. Parent and student flows include loading, empty, error, denied, pending,
    success, locked, and over-limit states where relevant.
12. Existing RBAC, RLS, PII encryption, audit logging, and parent scoping remain
    enforced by the owning API routers.
13. All new migrations are applied with the repository migration command before
    PR closeout.
14. `docs/architecture/component-relationships.md` is regenerated if a PR adds
    or moves a product owner, router, domain helper, UI surface, or workflow.

---

## PR guardrails

- Keep one review mental model per PR.
- Extend existing owners before creating new ones.
- Do not add a broad "student portal" API router for all features. Use the
  existing product routers unless the responsibility is truly new.
- New parent-controlled account policy can use a focused `studentSettings`
  router because no existing owner covers that responsibility.
- Do not store raw passwords locally. Password actions must go through Clerk or
  an injectable Clerk adapter.
- Do not log raw passwords, reset tokens, usernames before encryption, email
  addresses, DOB, or other sensitive credential material.
- Do not add student-to-student communication, comments, reactions, public
  profiles, friend lists, or shared galleries.
- UI controls must reflect permissions, but API policy is the source of truth.
- Each PR must update tests close to the changed owner.
- If a PR changes Prisma schema, run `pnpm db:migrate` from the repo root.

---

## Sprint 1 - Parent settings, account control, and access policy

### PR-7.0 - `docs: plan student portal phase build`

Goal:

- Create this Phase 7 sprint and PR plan.

Scope:

- Add the phase plan Markdown file.
- Do not implement app code, schema, routes, or UI in this PR.

Done criteria:

- Phase 7 has a sprint-ready PR sequence.
- The first implementation PR is the parent settings menu.
- Each later feature is separated into its own PR.

### PR-7.1 - `feat: add parent student settings model`

Goal:

- Add the data model and domain policy for parent-controlled student portal
  settings.

Scope:

- Add `StudentPortalSettings` with a 1:1 `Student` relation.
- Store encrypted username or login handle fields where local storage is needed.
- Store parent password-control preference.
- Store daily, hourly, and weekly usage limit minutes.
- Store parent account lock state and reason.
- Store Head academic lock state and reason.
- Store parent merit-shop block state.
- Store actor IDs and timestamps for lock/settings changes where required for
  auditability.
- Add domain helpers for:
  - parent control eligibility by DOB
  - adult cutoff at 18
  - effective account lock state
  - usage-limit validation
  - merit-shop access policy
- Add focused unit tests for the domain helpers.

Done criteria:

- Settings rows can represent all requested parent and Head controls.
- Invalid usage limits are rejected by domain validation.
- Parent control returns false for students who are 18 or older.
- Domain tests cover under-18, exactly-18, over-18, locked, unlocked, and
  shop-blocked cases.
- `pnpm db:migrate` passes.

### PR-7.2 - `feat: add student settings API`

Goal:

- Add the backend API for parent, student, and Head settings workflows.

Scope:

- Add a focused `studentSettings` tRPC router.
- Parent procedures:
  - list linked children with settings summaries
  - read one linked child's settings
  - set child username or login handle
  - trigger password setup/reset through a Clerk adapter
  - allow or revoke student-managed password changes
  - set daily, hourly, and weekly usage limits
  - lock or unlock the student account for a parent reason
  - block or unblock merit shop use
- Student procedures:
  - read own effective settings
  - request or set own password only when allowed by parent policy or when 18+
- Head procedures:
  - lock or unlock a student account for an academic reason
- Add a narrow injectable Clerk credential adapter so tests do not require
  `CLERK_SECRET_KEY`.
- Write audit rows for every settings, credential, usage-limit, lock, unlock,
  and shop-block change.

Done criteria:

- Parents can only mutate settings for linked children under 18.
- Parents cannot mutate settings for unlinked children.
- Parents cannot mutate account-control settings for students who are 18 or
  older.
- Students under 18 cannot change password unless policy allows it.
- Students 18 or older can control their own password.
- Head can only set academic locks, not parent lock reasons.
- API tests cover permission denial, happy paths, audit writes, and sanitized
  credential handling.

### PR-7.3 - `feat: build parent student settings menu`

Goal:

- Add the parent-facing settings menu where parents configure linked-child
  student portal controls.

Scope:

- Add `/parent/settings`.
- Add a "Settings" item to parent navigation.
- Show linked children and their current portal settings state.
- Add settings panels for:
  - username or login handle
  - password setup/reset
  - whether the child can set their password
  - daily usage limit
  - hourly usage limit
  - weekly usage limit
  - merit-shop block
  - account lock/unlock with parent reason
- Show an adult-child read-only state when the student is 18 or older.
- Include loading, empty, validation error, mutation pending, success, denied,
  locked, and over-18 states.
- Use existing parent shell patterns and the design reference.

Done criteria:

- Parent users can complete the settings workflows from the UI.
- Settings cannot be edited for unlinked or adult students.
- No raw password values are displayed after submission.
- Mobile and tablet layouts remain usable.
- Web typecheck and focused component/browser checks pass.

### PR-7.4 - `feat: enforce student account locks and shop blocks`

Goal:

- Enforce settings policy at existing backend boundaries.

Scope:

- Gate student portal access on effective account lock state.
- Return a student-safe locked-account response with the correct parent or
  academic reason label.
- Update shop reservation and purchase paths to reject blocked student shop
  use.
- Keep parents and authorised staff able to view data according to existing
  role policy.
- Add user-facing error copy that uses Learning Centre terminology.

Done criteria:

- Locked students cannot access student portal data.
- Parent-lock and academic-lock states are distinguishable to authorised users.
- Shop-blocked students cannot reserve or purchase shop items.
- Parent/admin visibility is not accidentally removed.
- API tests prove enforcement is backend-side.

### PR-7.5 - `feat: enforce student usage limits`

Goal:

- Track and enforce daily, hourly, and weekly usage limits.

Scope:

- Add student portal activity/session tracking.
- Add a heartbeat endpoint or equivalent session update mechanism.
- Calculate hourly, daily, and weekly usage windows.
- Block student portal access when the active limit is reached.
- Add a limit-reached screen in the student shell.
- Exempt parent, Head, and authorised staff views from student usage limits.
- Audit or operationally log limit denials without storing unnecessary
  behavioural detail.

Done criteria:

- Usage minutes are tracked for student portal sessions.
- Hourly, daily, and weekly limits are enforced independently.
- Limit enforcement survives page reloads.
- Tests cover under-limit, hourly-limit, daily-limit, weekly-limit, no-limit,
  and locked-account precedence.

---

## Sprint 2 - Student shell, profile, avatar, and safe account view

### PR-7.6 - `feat: add student portal shell`

Goal:

- Add the production student portal route group and shell.

Scope:

- Add `/student` route group and layout.
- Add student top/bottom navigation based on `Oasis Student Portal.html`.
- Add post-sign-in routing for `Student` users.
- Add locked and usage-limit-reached states.
- Add loading, not-ready, and access-denied states.
- Keep data cards lightweight until feature PRs fill them.

Done criteria:

- Student role signs in to `/student`.
- Non-student users cannot access `/student`.
- Locked and over-limit users see the correct blocked state.
- Shell is responsive for tablet-first and mobile use.

### PR-7.7 - `feat: add student dashboard`

Goal:

- Build the student home screen with safe summary data.

Scope:

- Show first name, age band, avatar, merit balance, PACE summary, Faith Corner
  preview placeholder, notification preview, and shop/club shortcuts.
- Do not expose surname, DOB, email, behaviour reasons, supervisor names, or
  parent-only notes.
- Use existing data owners for student profile, merit ledger, PACE, and
  attendance summaries.

Done criteria:

- Dashboard renders useful summary data for an active student.
- Empty states appear when a student has no PACE, merit, club, or notification
  data.
- Student-safe data contract is covered by API tests.

### PR-7.8 - `feat: add student profile and avatar builder`

Goal:

- Add student profile display and avatar setup/edit flow.

Scope:

- Add student-safe profile endpoint exposing first name, age band, and avatar.
- Add avatar state model.
- Add approved avatar item catalogue model if shop/avatar items need shared
  ownership.
- Add first-login avatar onboarding.
- Add profile page where students can edit avatar choices.
- Keep profile photo upload disabled by default and Centre Manager controlled.
- Keep all avatar items age-appropriate and admin-approved before availability.

Done criteria:

- Student profile never returns surname, DOB, email, or private parent data.
- Avatar builder includes base free options.
- Purchased/approved items can be represented for later shop integration.
- Tests cover onboarding, edit, unapproved item rejection, and safe profile
  response.

---

## Sprint 3 - Merits and Merit Shop

### PR-7.9 - `feat: add student merit wallet`

Goal:

- Add student-safe merit balance and history.

Scope:

- Show current merit balance on dashboard and wallet page.
- Show merit/debit history with date and amount only.
- Hide reason, supervisor name, internal notes, behaviour category, and linked
  sensitive records.
- Show demerits as negative merit amounts.
- Add student-safe empty and loading states.

Done criteria:

- Student can see balance and date/amount history.
- Student cannot see internal merit/debit reasons.
- API tests prove sensitive ledger fields are not exposed.

### PR-7.10 - `feat: add student merit shop`

Goal:

- Add student-facing merit shop use.

Scope:

- Add student shop catalogue using existing `shop` owner.
- Support Avatar Cosmetics and Learning Resources categories.
- Enforce current merit balance.
- Enforce parent merit-shop block.
- Enforce item availability and stock.
- Add student purchase history.
- Apply purchased avatar items immediately where relevant.
- Keep admin item management under existing shop controls.

Done criteria:

- Student can browse available shop items.
- Student cannot spend more merits than available.
- Shop-blocked student cannot reserve or purchase.
- Purchase history is visible to the student.
- Tests cover insufficient balance, shop block, inactive item, and successful
  purchase.

---

## Sprint 4 - Learning progress and attendance

### PR-7.11 - `feat: add student pace progress view`

Goal:

- Add read-only student PACE progress.

Scope:

- Show current PACE number per subject.
- Show progress indicator within current PACE.
- Show completed PACEs per subject with completion date.
- Add a simple milestone timeline across completed PACEs.
- Keep data entry Centre Manager only.

Done criteria:

- Student sees subject-by-subject PACE progress.
- No overall average is shown.
- Student cannot mutate PACE records.
- Tests cover self-only access and empty subject state.

### PR-7.12 - `feat: add student attendance summary`

Goal:

- Add read-only student attendance summary.

Scope:

- Show monthly calendar view or percentage summary.
- Show present, absent, and late states.
- Show absence reason only if entered by Centre Manager.
- Keep attendance entry Centre Manager/staff-only through existing policy.

Done criteria:

- Student can view own attendance.
- Student cannot edit attendance.
- Tests cover self-only access, absent reason visibility, and no-record state.

---

## Sprint 5 - Clubs, Faith Corner, and notifications

### PR-7.13 - `feat: add student clubs noticeboard`

Goal:

- Add student club discovery and member-only noticeboards.

Scope:

- Let students browse active clubs with name, day, time, supervisor, and short
  description.
- Let students submit an expression of interest.
- Keep Centre Manager approval for enrolment.
- Show member-only club noticeboards.
- Keep noticeboards read-only for students.
- Trigger or queue in-app notifications for new club posts when notification
  infrastructure is available.

Done criteria:

- Student can browse clubs and submit interest.
- Non-members cannot see member-only noticeboards.
- Students cannot post or message through noticeboards.
- Tests cover discovery, expression of interest, member access, and denied
  access.

### PR-7.14 - `feat: add student faith corner`

Goal:

- Add managed Faith Corner content to the student portal.

Scope:

- Add managed Faith Corner content model.
- Add Centre Manager controls for weekly devotion theme, NKJV memory verse,
  reflection prompt, and optional verse of the day.
- Show Faith Corner card on dashboard.
- Add full Faith Corner page.
- Keep student access read-only.

Done criteria:

- Centre Manager can publish current Faith Corner content.
- Student can read current Faith Corner content.
- Student cannot edit or submit Faith Corner content.
- Tests cover admin update, student read, and disabled verse-of-day state.

### PR-7.15 - `feat: add student notifications`

Goal:

- Add student notification centre and announcements.

Scope:

- Add in-app notification centre accessible from all student screens.
- Support notifications for merit award, shop purchase confirmation, club
  noticeboard post, and system announcement.
- Let Centre Manager send announcements to all students, Primary, Secondary, or
  an individual student.
- Add read/unread state and mark-read mutation.
- Do not add direct messaging between students.

Done criteria:

- Student sees targeted notifications only.
- Student can mark notifications read.
- Notification badge counts unread items.
- Tests cover audience targeting, mark-read, and no student-to-student path.

---

## Sprint 6 - Registration, parent linking, and admin closeout

### PR-7.16 - `feat: add student self-registration`

Goal:

- Add student self-registration with Centre Manager approval.

Scope:

- Add Centre Manager-issued student registration codes.
- Add student registration form collecting first name, last name, DOB, email,
  age band, and registration code.
- Create account in pending state until Centre Manager approval.
- Send confirmation email after activation.
- Keep account inactive until parental consent is confirmed.

Done criteria:

- No registration code means no student account.
- Pending student accounts cannot access the student portal.
- Centre Manager can approve or decline pending student accounts.
- Tests cover invalid code, pending state, approval, and activation email.

### PR-7.17 - `feat: add student parent linking workflow`

Goal:

- Link student accounts to one or more parent/carer accounts.

Scope:

- During registration, ask whether the parent/carer is already registered.
- If yes, send link request to the existing parent account.
- If no, send invitation email to the supplied parent email.
- Let parent confirm or reject the link.
- Allow Centre Manager manual linking from admin.
- Support more than one parent/carer link per student.

Done criteria:

- Parent link is not active until confirmed.
- Existing parent and invited parent paths both work.
- Centre Manager manual linking remains available.
- Tests cover multiple guardians, rejection, duplicate requests, and unlinked
  access denial.

### PR-7.18 - `feat: add student portal admin reporting`

Goal:

- Add Centre Manager reporting and closeout controls for student portal launch.

Scope:

- Add reports for active/pending student accounts.
- Add reports for locked accounts, shop-blocked accounts, and usage-limit
  status.
- Add merit totals, attendance summaries, PACE levels by subject, and club
  enrolment numbers where existing owners provide the data.
- Add final admin filters needed to operate launch.
- Update component map if product ownership changed.

Done criteria:

- Centre Manager can inspect student portal readiness and exceptions.
- Reports do not leak student data outside authorised admin views.
- Full phase checks pass or blockers are documented.

---

## Final phase verification

Run these before Phase 7 closeout:

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm build`
- `pnpm db:migrate` for all Phase 7 migrations
- `pnpm docs:component-map` if module ownership changed
- `graphify update .` after code changes
- Browser verification for:
  - parent settings
  - student locked state
  - student usage-limit state
  - student dashboard
  - student profile/avatar
  - student merit wallet
  - student shop
  - student PACE
  - student attendance
  - student clubs
  - Faith Corner
  - notifications
  - registration and parent linking

---

## Explicit deferrals

These are not part of Phase 7 unless a later sprint explicitly pulls them in:

- Push notifications for mobile devices.
- Achievement badges.
- Merit savings goals.
- Printable student progress summaries.
- Daily check-in or reflection prompts that store student data.
- Student-to-student communication of any kind.
- Public student profiles.
