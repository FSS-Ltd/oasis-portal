# Mobile and PWA Web Parity Audit

Date: 2026-06-21

## Current Differences

### Parent Portal

- Web has: Home, Calendar, Permission Slips, Clubs, Fees/Invoices, Shop, Ranks, Reports, Incidents, Settings, My Profile, Registration, Messages, Noticeboard.
- Mobile now has: Home, Child, Noticeboard, Messages, Reports/Ranks, Incidents, Clubs, Shop, Fees/Invoices, Calendar, Permission Slips, Profile/Registration, Settings.
- Remaining difference: web separates Ranks and Reports, and separates Profile and Registration. Mobile combines those into natural mobile flows to keep the bottom navigation usable.

### Student Portal

- Web has: Home, Updates, Wallet, Merit Markets, PACE, Homework, Community, Messages, Attendance, Clubs, Faith, Ranks, Shop.
- Mobile now has: Home, Wallet, Learning, Activity, Clubs/Faith, Shop, Updates, Messages.
- Remaining differences:
  - Merit Markets is not yet a mobile-native screen.
  - Wallet is still behind the web wallet for tithe preference, manual tithe payment, and charity giving.
  - Community does not have a mobile-native equivalent.
  - PACE, Attendance, and Ranks are grouped into Learning rather than separate bottom-nav entries.
  - Homework is grouped into Activity rather than a separate bottom-nav entry.
  - Clubs and Faith are grouped into one mobile flow.

### Staff, Supervisor, Admin

- Staff mobile has dedicated operational surfaces for home, attendance, behaviour, incidents, PACE, clubs, rota, shop counter, and communications.
- Supervisor and admin remain web-first for heavier management workflows such as audit, access management, sensitive review, reports authoring, bulk profile management, and deep drillthrough.

## Adjustment Plan

1. Navigation parity
   - Keep bottom nav to the highest-frequency routes.
   - Use the existing mobile `More` drawer for secondary pages.
   - Keep grouped routes where they reduce tap count without hiding capability.

2. Student shop parity
   - Add Shop to student mobile `More`.
   - Reuse existing mobile shop catalogue, cart, reservation, and history components.
   - Verify student-only access still relies on `shop.listItems`, `shop.studentHistory`, and `shop.reserve`.

3. Wallet and tithe parity
   - Add `api.tithe.getStatus` to mobile wallet.
   - Add mobile tithe preference controls for cadence, mode, percentage/fixed amount, weekly day/monthly date.
   - Add manual `payDue` action with disabled and error states matching web rules.
   - Add charity giving via `api.meritLedger.giveToCharity`.
   - Update wallet tests so tithe and charity actions are required instead of explicitly forbidden.

4. Merit Markets parity
   - Add a mobile `Markets` route under `More`.
   - Start with portfolio summary, cash funding, and market browsing.
   - Add buy/sell flows only after the mobile UI has clear confirmation, balance, stale-market, and error states.

5. Community parity
   - Decide whether mobile needs a standalone Community route or whether existing Messages/Updates cover the first mobile use case.
   - If needed, add it under `More` after the financial flows are complete.

6. Verification
   - Run mobile typecheck/test gates after each slice.
   - Run `pnpm --filter @oasis/mobile build:web` and `pnpm --filter @oasis/mobile pwa:check` before calling PWA parity complete.
   - Keep native Expo build checks in the release gate because the PWA path is the same Expo app.
