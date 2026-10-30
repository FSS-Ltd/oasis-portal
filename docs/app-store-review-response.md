# App Store review response: Guideline 2.1 Information Needed

**Status:** Ready to paste. 2026-10-30. App version 1.0.1, bundle ID `uk.oasis.portal`.

Apple asked for six things and wants them in two places: a reply in App Store Connect, and the
**Notes** field of **App Review Information** so future reviews have them. This file holds both texts,
the sign-in fields, and the recording script.

Passwords are never written here. Copy them from `app-review-credentials.env` (outside git) into
App Store Connect directly. Replace each `<...>` placeholder before pasting.

## Where each piece goes in App Store Connect

| What                     | Where                                                                                                      |
| ------------------------ | ---------------------------------------------------------------------------------------------------------- |
| Staff username/password  | Apps > Oasis > iOS app 1.0.1 > App Review Information > **Sign-In Information** (User name, Password)      |
| Notes text (section A)   | Same page, **Notes** field (4,000 character limit; section A is under it)                                  |
| Reply text (section B)   | Apps > Oasis > **App Review** (left sidebar) > open the submission > **Reply** to the 2.1 message          |
| Screen recording         | Attach the .mov/.mp4 to that reply. If it is too large, upload it and paste a private link into the reply. |
| Contact name/phone/email | App Review Information > **Contact Information**: must be someone who answers during the review            |

Tick **Sign-in required**. Then save the version page before replying, so the Notes reach the reviewer.

## A. Notes field (App Review Information)

```text
WHAT OASIS IS
Oasis is the private portal for Oasis Learning Centre, an independent school in the UK. Parents see their child's attendance, behaviour, academic progress, fees and school notices, and message staff. Staff take attendance, record behaviour and progress, and message parents. Students check their merit wallet, learning and timetable. The school creates every account by invitation. There is no public sign-up.

DEMO ACCOUNTS (sandbox data only, no real children)
Sign in with "Email or username" and password.
1. Staff (Head role): oasis-review-staff / <staff password>  (also in Sign-In Information)
2. Parent: oasis-review-parent / <parent password>
3. Account deletion demo (Parent): oasis-review-delete / <delete password>
No second factor or email code is needed.

ACCOUNT DELETION
Every signed-in parent, staff member and adult student can request deletion in the app:
- Parent: Profile tab > "Delete my account" > Request account deletion > Yes, request deletion.
- Staff: Home > "Delete my account" card.
- A parent can also request deletion of a child's account: Settings > "Delete this child's account".
The Head and Technical Support are alerted in the app, by push notification and by email, and the alert opens the person's profile. An administrator then approves the request there (Staff Home > Review > Approve deletion > Confirm deletion). Approval removes the sign-in account and the person can no longer sign in. Attendance, safeguarding and audit records are kept because the school is legally required to keep them under UK education and safeguarding law.
To test the full cycle without losing the main logins: sign in as oasis-review-delete, request deletion, sign out, sign in as oasis-review-staff, open User Access and approve it, then try to sign in as oasis-review-delete again. Please use account 3 for this, not accounts 1 or 2.

PAYMENTS
No in-app purchases, subscriptions or paid features. School fees are shown for information and paid to the school outside the app. "Merits" in the student wallet and shop are school reward points with no cash value and cannot be bought.

USER CONTENT
Messages are only between members of one school, who are all known to the school. Parents message school staff. Student group chats are created, membership-controlled and moderated by staff, who can read every message and block a student from messaging.

EXTERNAL SERVICES
Clerk (sign-in), Supabase (database, EU), Vercel (API hosting), Sentry (error reports), Resend (invitation and notice emails), Expo Push Notification Service with Apple Push Notification service (message alerts), Twelve Data, Yahoo Finance and Finnhub (delayed market prices and news used in a student money-education feature, shown as merits, no real money or trading). No advertising, analytics or tracking SDKs. No AI services.

REGIONS
English only. The app works the same in every region where it is available.

Support: support@faithfulsoftware.dev
```

## B. Reply to App Review

```text
Hello,

Thank you for the review. The information you asked for is below, and we have added it to the Notes field of App Review Information. The screen recording is attached [or: is here: <private link>].

1. SCREEN RECORDING
Recorded on <device, e.g. iPhone 16 Pro> running iOS <26.x>, build 1.0.1 (<build number>). It starts from launching the app and shows:
- Sign-in with the parent account and the typical parent flow: child overview, attendance, progress, fees, notices and messaging a member of staff.
- Sign-in with the staff account and the typical staff flow: taking attendance, recording behaviour, replying to the parent, and User Access.
- Account deletion end to end: the deletion demo account requests deletion from Profile, an administrator approves it in User Access, and the deleted account can no longer sign in.
- User content: parent and staff messaging between known members of the school. There is no public content.
- Paid content: there is none. The app has no in-app purchases or paid features.
Account registration: accounts are created only by the school through an invitation, so there is no registration screen in the app.

2. PURPOSE AND AUDIENCE
Oasis is the private portal for Oasis Learning Centre, an independent school in the UK. Its audience is the school's parents and carers, staff, and students. It replaces paper letters, phone calls and separate spreadsheets: parents see their child's attendance, behaviour, progress, fees and school notices in one place and message staff directly; staff record attendance, behaviour and progress on the move; students follow their learning and a merit reward wallet.

3. SETUP AND ACCESS
No setup or sample files are needed. Sign in with "Email or username" and a password:
- Staff (Head): oasis-review-staff / <staff password>
- Parent: oasis-review-parent / <parent password>
- Account deletion demo: oasis-review-delete / <delete password>
All three use synthetic data in a sandbox that is separate from the school's real records. To see account deletion, sign in as oasis-review-delete, open Profile > Delete my account, request deletion, sign out, then sign in as oasis-review-staff, open User Access and approve the request.

4. EXTERNAL SERVICES
- Clerk: sign-in and account management.
- Supabase: PostgreSQL database, hosted in the EU.
- Vercel: hosting for the API the app calls.
- Sentry: crash and error reports.
- Resend: invitation and school notice emails.
- Expo Push Notification Service and Apple Push Notification service: alerts for new messages and student updates.
- Twelve Data, Yahoo Finance and Finnhub: delayed stock and ETF prices and news for a student money-education feature. Values are shown in school merits; there is no real money, brokerage or trading.
The app has no advertising, analytics or tracking SDKs and uses no AI services.

5. REGIONAL DIFFERENCES
There are none. The app is in English and works the same in every region where it is available.

6. REGULATED INDUSTRY AND THIRD-PARTY MATERIAL
The app is not in a highly regulated industry such as banking, healthcare or gambling. It holds school records about children, which we process under UK GDPR on behalf of the school: <Oasis Learning Centre, ICO registration number ZXXXXXXX>. The app is built and operated for the school by FSS Ltd. No third-party protected material is shown other than market prices from the licensed data providers listed above.

Thank you,
<name>
<role>, <organisation>
```

## C. Screen recording script

Record on a physical iPhone running the latest iOS, with the App Store Connect build (TestFlight).
Use Control Centre > Screen Recording. Turn on Do Not Disturb so no personal notifications appear.
Keep it under about 5 minutes and do not cut in the middle of a flow.

1. Start on the home screen. Tap the Oasis icon. Let the launch screen play.
2. **Parent.** Sign in as `oasis-review-parent`. Show Home and the child overview, then attendance,
   progress, fees and notices. Open Messages and send a short message to a member of staff.
   Open Profile and scroll to "Delete my account" so it is visible (do not tap). Sign out.
3. **Staff.** Sign in as `oasis-review-staff`. Show Home, take attendance for a group, record a
   behaviour entry, open the parent's message and reply. Open User Access. Sign out.
4. **Deletion request.** Sign in as `oasis-review-delete`. Open Profile > Delete my account >
   Request account deletion. Read the retention text on screen, tap Yes, request deletion.
   Show the "Deletion requested" state. Sign out.
5. **Deletion approval.** Sign in as `oasis-review-staff`. Staff Home shows an "Action needed:
   Account deletion request" alert for Dana Delete Demo (the same request also goes to the Head and
   Technical Support as a push notification and to support@faithfulsoftware.dev as an email; tapping
   the push opens the same profile). Tap Review Dana Delete Demo. The profile opens with its
   deletion request on top. Tap Approve deletion, then Confirm deletion. Show the "Account deleted"
   message. Sign out. Optionally show the alert email in the support inbox.
6. **Proof.** Try to sign in as `oasis-review-delete` with the same password. Show that it fails.
7. Stop the recording.

After recording, run **App Review Seed** again (see checklist section 8) so `oasis-review-delete`
exists again for Apple's reviewer. Do this before you reply, never during a review.
