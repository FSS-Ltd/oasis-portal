# Mobile Push Notifications Implementation

Status: Proposed
Created: 2026-06-21
Owner: Technical Agent

## Decision

Use Expo Push Service for the first Oasis mobile push implementation.

Oasis mobile is already an Expo app built through EAS, and the app currently has an in-app student notification inbox backed by `StudentNotification`. Expo Push Service is the lowest-friction provider because it lets the backend send one Expo push token format while Expo handles handoff to FCM and APNs. It also keeps the first production slice focused on device registration, delivery reliability, permission handling, and auditability rather than provider migration work.

Do not use OneSignal in the first implementation. It is useful when Oasis needs marketing-style segmentation, in-app messaging campaigns, dashboard-led sends, or non-engineering operators managing cohorts. Those are not the current requirement, and OneSignal would add another SDK, provider account, identity mapping layer, and dashboard permission surface.

Do not send directly to FCM and APNs in the first implementation. Direct provider integration gives more low-level control, but it also requires separate platform token handling, APNs auth, FCM v1 auth, provider-specific retry logic, and more infrastructure before Oasis has validated its production push workflows.

## Current Repo State

- `apps/mobile` is an Expo Router app with EAS build profiles documented in `docs/mobile-eas-internal-builds.md`.
- `apps/mobile/app.json` defines the native identifiers:
  - iOS bundle: `uk.oasis.portal`
  - Android package: `uk.oasis.portal`
- The app has no native push SDK yet. `expo-notifications` is not installed.
- The API already has an in-app notification owner:
  - `apps/api/src/services/student-notifications.ts`
  - `apps/api/src/routers/studentNotification.ts`
  - `packages/db/prisma/schema.prisma` model `StudentNotification`
- Existing notification creation paths include behaviour, clubs, homework, and shop workflows.
- Transactional email is already handled separately through Resend and should remain the fallback channel for email-safe notifications.

## Provider Comparison

| Provider             | Use in Oasis                      | Strengths                                                                                                                             | Costs and constraints                                                                                                                            |
| -------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Expo Push Service    | Recommended first provider        | Fits current Expo/EAS stack, one push token format, server SDK available for Node, no sending cost, avoids direct APNs/FCM complexity | No SLA, Expo receives notification payloads in transit, 600 notifications per second per project limit, still depends on APNs/FCM final delivery |
| Direct FCM plus APNs | Later migration path              | Full provider control, direct access to APNs and FCM features, no Expo relay dependency                                               | More credentials, separate token types, more retry and receipt logic, more platform-specific support burden                                      |
| OneSignal            | Defer until product need is clear | Dashboard campaigns, segmentation, in-app messages, analytics tooling, Expo SDK support                                               | Adds third-party SDK and account, extra identity mapping, more data-processing review, more product/admin surface than the first slice needs     |

## Source Notes

- Expo states that its service sits between Oasis and FCM/APNs, and that the server sends Expo push tokens to the Expo Push API.
- Expo's Node SDK handles request throttling. Expo recommends retry with exponential backoff for transient 429 and 5xx failures.
- Expo push receipts must be checked after sending. `DeviceNotRegistered` should remove or disable the stored token.
- Expo FAQ says Expo Push Service has no sending cost, has a 600 notifications per second per project limit, and is optional because native device tokens can be used with other services.
- Firebase pricing lists Cloud Messaging as no-cost.
- Firebase Cloud Messaging supports notification and data messages and can target devices, groups, or topics.
- Apple documents local and push notifications as the platform mechanism for timely updates, and provides a Push Notifications Console for production APNs metrics.
- OneSignal documents Expo SDK support for Expo SDK 53+ and EAS Build, but requires its own SDK, app/platform setup, and APNs/FCM credentials.

Sources checked on 2026-06-21:

- https://docs.expo.dev/push-notifications/overview/
- https://docs.expo.dev/push-notifications/sending-notifications/
- https://docs.expo.dev/push-notifications/faq/
- https://firebase.google.com/pricing
- https://firebase.google.com/docs/cloud-messaging
- https://developer.apple.com/notifications/
- https://documentation.onesignal.com/docs/en/react-native-expo-sdk-setup

## Architecture

Push should be a delivery signal, not the source of truth.

The existing `StudentNotification` row remains canonical. Push payloads should carry enough data to open the right app screen and refresh the inbox, but they should not carry sensitive student information, internal notes, behaviour details, medical details, or any data that would be inappropriate on a lock screen.

Recommended flow:

1. Mobile asks for notification permission after sign-in, not before auth.
2. Mobile obtains an Expo push token with `expo-notifications`.
3. Mobile posts the token to an authenticated API mutation.
4. API stores the token against the signed-in user, student, platform, app build, and device fingerprint.
5. Existing notification-producing services continue writing `StudentNotification`.
6. A push dispatch service sends generic push messages for eligible notification rows.
7. The mobile notification tap opens the student Updates screen and refreshes `studentNotification.list`.

## Data Model

Add a new device-token table rather than overloading `StudentNotification`.

Proposed model:

```prisma
model PushDeviceToken {
  id          String   @id @default(cuid())
  userId      String
  studentId   String?
  tokenEnc    String
  provider    PushProvider
  platform    PushPlatform
  appBuild    String?
  deviceLabel String?
  enabled     Boolean  @default(true)
  lastSeenAt  DateTime @default(now())
  disabledAt  DateTime?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  user    User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  student Student? @relation(fields: [studentId], references: [id], onDelete: Cascade)

  @@index([userId, enabled])
  @@index([studentId, enabled])
}

enum PushProvider {
  Expo
}

enum PushPlatform {
  Ios
  Android
}
```

Use encryption for tokens because they are device-addressing credentials. Do not log raw tokens. Store enough metadata to debug delivery without storing device serial numbers or unnecessary personal data.

## API Shape

Add a dedicated router, for example `pushNotifications`, instead of folding token management into `studentNotification`.

Suggested procedures:

- `registerDeviceToken`
  - Authenticated.
  - Input: provider, token, platform, app build, optional student id.
  - Validates that the signed-in user can register for the supplied student.
  - Upserts by encrypted token hash or stable token digest, not by raw encrypted value.
  - Audits create/update without raw token.
- `disableDeviceToken`
  - Authenticated.
  - Disables a token on sign-out, permission removal, or explicit settings change.
- `sendPendingPushes`
  - Internal or cron-only.
  - Reads unsent push intents or recent notification rows.
  - Sends through Expo SDK.
  - Stores ticket ids and schedules receipt checks.
- `checkPushReceipts`
  - Internal or cron-only.
  - Fetches Expo receipts after the recommended delay.
  - Disables tokens on `DeviceNotRegistered`.
  - Logs provider failures without exposing payloads.

## Backend Delivery Design

Add a push dispatch service under `apps/api/src/services/`.

Responsibilities:

- Build safe payloads from canonical notification rows.
- Batch sends with `expo-server-sdk`.
- Retry transient Expo API failures with exponential backoff.
- Persist push tickets and receipts.
- Disable dead tokens.
- Emit operational events for provider failures, missing credentials, invalid payloads, and high disable rates.

Payload rule:

```ts
{
  title: 'Oasis update',
  body: 'You have a new update in Oasis.',
  data: {
    route: 'student.notifications',
    notificationId,
    sourceEntity,
    sourceId,
  },
}
```

Use more specific titles only for low-risk categories after product approval. Behaviour, safeguarding, attendance, PACE, sensitive entries, and finance-related updates should use generic copy.

## Mobile Implementation

Add `expo-notifications` to `apps/mobile`.

Client responsibilities:

- Request permission only after sign-in and after explaining the value in app copy.
- Register tokens only on native iOS and Android builds. The PWA path should keep its existing in-app update surface unless a separate Web Push decision is made.
- Send the Expo token to the API with platform and build metadata.
- Register foreground and response listeners once in the mobile shell.
- On notification tap, route to the correct app area and invalidate the relevant tRPC queries.
- Disable or refresh the token on sign-out, account switch, permission changes, and app reinstall cases.

Do not prompt on first cold launch before the user understands the app. For students and parents, ask after they have reached the portal shell and seen the Updates area.

## Privacy And Safeguarding Rules

- No sensitive note body in push payloads.
- No raw child names in push payloads until a human signs off on lock-screen copy.
- No behaviour, safeguarding, incident, finance, or PACE detail in payload body.
- No push for users who have disabled the channel.
- Keep Resend email as the channel for formal transactional records that need a durable inbox outside the app.
- Add audit logs for token registration, token disablement, bulk send attempts, and receipt failures.
- Treat provider dashboards as production systems with least-privilege access.

## Rollout Plan

1. Add schema and API token registration.
2. Add mobile permission and token registration behind a feature flag.
3. Send push only for low-risk student Updates notifications in internal builds.
4. Add push ticket and receipt storage plus the receipt-check cron.
5. Expand to parent and staff notifications after token lifecycle is stable.
6. Add notification settings per role and channel.
7. Revisit OneSignal only if non-engineering campaign management or segmentation becomes a real product need.

## Verification Plan

Local checks for the implementation PR:

- `pnpm --filter @oasis/db typecheck`
- `pnpm --filter @oasis/api typecheck`
- `pnpm --filter @oasis/api lint`
- `pnpm --filter @oasis/api test`
- `pnpm --filter @oasis/mobile typecheck`
- `pnpm --filter @oasis/mobile lint`
- `pnpm --filter @oasis/mobile test`
- `pnpm --filter @oasis/mobile build:web`
- `pnpm --filter @oasis/mobile eas:check`

Device checks:

- iOS internal EAS build can request permission and register a token.
- Android internal EAS build can request permission and register a token.
- Signed-out users do not register tokens.
- Account switching disables or replaces the previous registration.
- Notification tap opens the Updates area and refreshes unread state.
- Denied permissions leave the in-app notification inbox usable.
- `DeviceNotRegistered` receipt disables the token.

## Open Decisions

- Whether parent and staff roles should receive push in the first production release or after the student path is proven.
- Whether lock-screen copy may include a first name for low-risk updates.
- Whether web push is needed for the PWA path. Treat this as separate from native push because Safari and browser permission behavior have different constraints.
- Whether push settings should live in profile settings or role-specific notification settings.
