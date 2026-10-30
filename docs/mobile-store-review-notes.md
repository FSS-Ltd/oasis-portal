# Oasis mobile: review notes and demo account spec

Drafts for the parts of the store submission that can be prepared in the repository. Nothing here is
submitted. Credentials are never stored in this repo: enter them directly in App Store Connect and
the Play Console.

## Public URLs (once the web app is deployed)

- Privacy policy: `https://<production web host>/privacy`
- Support URL: `https://<production web host>/support`
- Support contact: `support@faithfulsoftware.dev`

Pages live in `apps/web/src/app/(legal)/`. The privacy text was written from what the code does and
from the draft answers in `mobile-store-submission-checklist.md`. Oasis and FSS must read it
before it is published. In particular they need to confirm that Oasis Learning Centre is the data
controller and FSS Ltd the processor, the supplier list, and whether to state fixed retention periods.

## Demo accounts to create (production Clerk)

Create these by hand through the normal invitation flow so the reviewer sees the real product.

| Role   | Purpose                                | Data it must show                                                                    |
| ------ | -------------------------------------- | ------------------------------------------------------------------------------------ |
| Parent | Attendance, fees, messages, progress   | One synthetic child linked to this parent, with a few attendance and fee entries     |
| Staff  | Taking attendance, behaviour, messages | The same synthetic child in a synthetic group, plus a message thread with the Parent |

Rules: synthetic names only, no real child data, an email on a domain you control, a strong unique
password, 2FA off for these two accounts if enforcement is enabled (a reviewer cannot receive codes).
Rotate the passwords after review.

## App Review notes (paste into App Store Connect and Play Console "App access")

> Oasis is the portal for Oasis Learning Centre. Accounts are created by Oasis through an
> invitation, so there is no public sign-up. Please sign in with the demo accounts below.
>
> Parent: <email> / <password>
> Staff: <email> / <password>
>
> The app has no tracking, no advertising and no in-app purchases. Fees are shown for information and
> are paid outside the app.
>
> Account deletion: Parent accounts can request deletion in the app under Profile ("Delete my
> account"), and a child's account under Settings ("Delete this child's account"). Oasis reviews the
> request and, once approved, the account can no longer sign in. Attendance, safeguarding and audit
> records are retained because Oasis is required to keep them. See /support and /privacy.

In-app deletion requests now cover parents (Profile), staff (Home) and students aged 18 or over
(Notifications). Account admins approve them in User Access on mobile or People & Profiles on web.
The current App Store review copy is in `docs/app-store-review-response.md`.
