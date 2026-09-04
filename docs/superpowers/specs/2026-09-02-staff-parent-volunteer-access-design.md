# Staff parent volunteer access design

## Goal

Let an authorised administrator grant an active staff member with an active linked child access to the parent volunteer page. Staff may volunteer only for Lunch + Clubs; parent accounts retain the existing Centre and Lunch + Clubs choices.

## Eligibility and management

- Eligible recipients are every active staff account role (all roles except `Parent` and `Student`) with at least one active child linked through `Guardian`. This includes `ClubsLead`.
- Ineligible accounts must not be returned or shown in the access list.
- Only the `Head` and `TechnicalSupport` roles can view or change staff parent-volunteer access. This is a dedicated capability, separate from broader admin or rota permissions.
- The account-level setting is `staffParentVolunteerAccess`, which defaults to `false`.
- Revoking access disables the setting and releases the recipient's future Lunch + Clubs reservations in the same transaction. Past reservations remain for rota history.
- The previous, unused staff Lunch + Clubs volunteer data remains untouched. This change does not delete historical data.

## User experience

- The existing Admin Rota workspace gains a `Volunteer access` tab.
- The tab contains a concise list of only eligible staff. Each row shows the person's name, role, linked-child count, current status, and one labelled switch for parent volunteer access.
- Head and Technical Support may use the switch. Pending requests disable only the affected control and report success or errors with the existing notification patterns.
- Desktop keeps the control in the rota workspace. On narrow screens, the workspace tabs form a compact grid and access rows remain large, readable, and touch-friendly without horizontal scrolling.
- Granting access adds `Volunteer` to the staff member's desktop and mobile parent navigation. Revoking it removes the entry.
- A parent account sees the existing full volunteer flow. A staff account with the grant sees a clearly labelled Lunch + Clubs-only volunteer flow with no Centre option or Centre data.

## Server enforcement

- Add dedicated rota endpoints to list and change eligible staff access, protected by the Head/Technical Support capability. Changes are audit logged.
- Determine the caller's volunteer scope from the current database state for every parent-volunteer query and mutation:
  - `Parent` accounts retain full access.
  - Granted, eligible staff have Lunch + Clubs-only access.
  - Everyone else is denied.
- The data returned to a restricted staff caller omits Centre volunteering. Mutations reject `centreDates` for that scope, preventing URL, client-state, or crafted-request bypasses.
- A deactivated user or a user whose active child link is removed becomes ineligible immediately, regardless of a stored grant.

## Verification

- API coverage: eligibility filtering, Head/Technical Support-only management, audit logging, Centre denial for staff, parent compatibility, loss of eligibility, and release of future reservations when access is revoked.
- Web coverage: tab and access-list state plus the restricted volunteer view.
- Validate responsive layouts at desktop and mobile widths, then run affected API and web type checks, linting, and production builds.
