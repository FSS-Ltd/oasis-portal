# Mobile and PWA Web Parity Audit

Date: 2026-06-21

## Current Differences

### Parent Portal

- Web has: Home, Calendar, Permission Slips, Clubs, Fees/Invoices, Shop, Ranks, Reports, Incidents, Settings, My Profile, Registration, Messages, Noticeboard.
- Mobile now has: Home, Child, Noticeboard, Messages, Reports/Ranks, Incidents, Clubs, Shop, Fees/Invoices, Calendar, Permission Slips, Profile/Registration, Settings.
- Remaining difference: web separates Ranks and Reports, and separates Profile and Registration. Mobile combines those into natural mobile flows to keep the bottom navigation usable.

### Student Portal

- Web has: Home, Updates, Wallet, Merit Markets, PACE, Homework, Community, Attendance, Clubs, Faith, Ranks, Shop.
- Mobile now has: Home, Wallet, Learning, Activity, Clubs/Faith, Shop, Markets, Community, Updates.
- Remaining differences:
  - PACE, Attendance, and Ranks are grouped into Learning rather than separate bottom-nav entries.
  - Homework is grouped into Activity rather than a separate bottom-nav entry.
  - Clubs and Faith are grouped into one mobile flow.
- Completed parity slices:
  - Shop is reachable from student mobile More and the Home reward-shop card.
  - Wallet supports tithe preferences, manual tithe payment, charity giving, and Spend/Saving transfers.
  - Merit Markets supports portfolio overview, cash funding, browse, buy/sell trading, and Daily/Weekly/Month/3 months trend toggles.
  - Community supports groups, student contacts, join/send/refresh states, and blocked messaging states.
  - Student direct Messages were removed from the production student portal on web and mobile; student interaction now happens through Community groups.

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
   - Completed with `api.tithe.getStatus`, tithe preference controls, manual `payDue`, charity giving, and updated wallet wiring tests.

4. Merit Markets parity
   - Completed with mobile `Markets` under More, portfolio summary, cash funding, market browsing, buy/sell review flows, and range trend toggles.

5. Community parity
   - Completed with mobile `Community` under More, student contacts, group join/send/refresh states, and removal of ambiguous student direct Messages.

6. Verification
   - Run mobile typecheck/test gates after each slice.
   - Run `pnpm --filter @oasis/mobile build:web` and `pnpm --filter @oasis/mobile pwa:check` before calling PWA parity complete.
   - Keep native Expo build checks in the release gate because the PWA path is the same Expo app.
