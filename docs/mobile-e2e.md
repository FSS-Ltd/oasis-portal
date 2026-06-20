# Mobile E2E Harness

The native mobile e2e harness uses Maestro against the installed Oasis Expo app.

Run from the repo root:

```bash
pnpm --filter @oasis/mobile test:e2e
```

The Maestro flows target the production mobile app id, `uk.oasis.portal`.

## Required Setup

Install the Maestro CLI and boot an iOS simulator or Android emulator with the
Oasis mobile app installed before running the command.

The runner also requires mobile runtime configuration:

- `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `EXPO_PUBLIC_TRPC_URL`

If either value is missing, the command skips before launching Maestro.

## Credential-Gated Flows

Each role smoke only runs when its complete credential pair is present:

- Parent: `E2E_PARENT_EMAIL`, `E2E_PARENT_PASSWORD`
- Student: `E2E_STUDENT_EMAIL`, `E2E_STUDENT_PASSWORD`
- Staff: `E2E_SUPERVISOR_EMAIL`, `E2E_SUPERVISOR_PASSWORD`

Use dedicated synthetic test accounts only. Do not run these flows with real
parent, student, or staff credentials, and keep the linked fixture records free
from private child details, live message bodies, production balances, or
identifiable incident data.

Missing credentials skip clearly. The repository must not contain real
passwords, one-time codes, TOTP seeds, child names, message bodies, screenshots
with private data, or any Clerk bypass. These first Maestro flows are read-only
login and navigation smokes.

## Production Journey Coverage

The production journey flows cover the Parent, Student, and Staff navigation
surfaces added during Phase 6. They are intentionally gated because they visit
screens that may reveal fixture-specific messages, fees, permissions, incident
summaries, shop reservations, wallet state, and operational staff queues.

Set `E2E_ALLOW_MOBILE_PRODUCTION_JOURNEYS=1` only for dedicated synthetic test
accounts and resettable fixture data:

```bash
E2E_ALLOW_MOBILE_PRODUCTION_JOURNEYS=1 pnpm --filter @oasis/mobile test:e2e
```

The current production journey flows assert the critical role surfaces without
submitting forms. Mutating flows such as parent message send, club signup,
incident acknowledgement, permission-slip signature, shop reservation, student
wallet transfer, attendance marking, behaviour logging, incident submission,
PACE entry, and shop collection should stay behind an additional explicit
mutation gate when those fixture accounts are ready.

The staff production journey expects the `E2E_SUPERVISOR_EMAIL` fixture to be
configured as a synthetic staff account with the permissions needed to render
the staff quick actions it verifies, including club lead and shop counter access.
Because that fixture is more privileged than the staff smoke fixture, the staff
production journey also requires `E2E_ALLOW_MOBILE_STAFF_PERMISSION_JOURNEYS=1`.
If those permissions are not present, leave the staff permission journey gate
disabled or use a fixture that includes them.
