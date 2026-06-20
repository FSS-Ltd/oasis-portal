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
