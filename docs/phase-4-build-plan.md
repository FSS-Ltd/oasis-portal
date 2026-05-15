# Phase 4 - Merit economy, shop, leaderboards, and reports: sprint & PR plan

**Status:** PR-4.3 in progress
**Last updated:** 2026-05-15
**Parent plan:** [`/oasis-platform-plan.md`](/oasis-platform-plan.md) Delivery phases
**Project context:** [`/PROJECT_Oasis_Context.md`](/PROJECT_Oasis_Context.md)

---

## Context

Phase 4 delivers the post-brief MVP expansion: three-account merit wallet,
weekly tithe, investment simulator, in-app shop, leaderboards, student mobile
view, and term reports.

Important current state:

- Behaviour logging already creates basic `MeritLedger` rows for Merit and
  Demerit entries.
- Domain helpers and tests exist for merit ledger, tithe, investment simulator,
  shop, leaderboards, clubs, and reports.
- API router PR-4.0 implemented `meritLedger` balances, activity, and
  transfers.
- API router PR-4.1 implemented weekly tithe config and idempotent weekly runs.
- Investment router production workflows are implemented through PR-4.2.
- Routers for `shop`, `leaderboard`, and `report` still need production
  workflows.

Phase 4 is where those placeholders become production workflows.

---

## Acceptance criteria

Phase 4 is complete when:

1. Merit balances are derived from append-only ledger rows and never
   denormalised as source of truth.
2. Students/parents/full-admin users can view Spend, Saving, and Investment
   balances within their access scope.
3. Allowed users can transfer between Spend, Saving, and Investment using
   atomic ledger transactions.
4. Weekly tithe config supports 10/15/20 percent, defaults safely, and produces
   idempotent weekly runs.
5. Investment NAV ticks are deterministic by seed, stored daily, and buy/sell
   flows apply the configured withdrawal fee.
6. Shop admins can manage items, prices, VAT, stock, and active state.
7. Shopkeepers can record purchases that atomically debit Spend and decrement
   stock.
8. Leaderboards support Top Tithers, Top Investors, Top Savers, and
   admin-gated Highest Demerits.
9. Student mobile view exposes balances, merit activity, PACE results,
   transfers, tithe settings, leaderboards, and shop browsing.
10. Head can generate, review, and send term reports from current snapshot data.
11. All finance/shop/report writes are audited and tested against double-entry
    invariants.
12. End-of-phase checks pass: `pnpm lint`, `pnpm typecheck`, `pnpm test`,
    `pnpm --filter @oasis/web build`, mobile typecheck, DB/RLS smoke, encryption
    verification, and focused e2e where credentials are configured.

---

## Sprint 1 - Merit wallet API

Goal: expose current ledger balances and safe transfers before adding tithe,
investment, shop, and reports.

### PR-4.0 - `feat(api): merit wallet balances and transfers` MERGED

Merged via PR #134 on 2026-05-15.

Scope:

- Implement `meritLedger.balances`, `meritLedger.activity`, and
  `meritLedger.transfer`.
- Reuse domain ledger helpers instead of duplicating accounting rules.
- Allow full-admin users to read/act for any active student.
- Allow parents to read linked children, but not move funds unless policy
  explicitly allows it in this PR.
- Allow student self access only where a Student user is linked to the student.
- Enforce non-negative Spend/Saving transfer constraints.
- Keep Investment transfers delegated to investment buy/sell procedures where
  unit accounting is required.
- Audit transfer attempts and successful transfers.

Tests:

- Balances derive from ledger rows.
- Merit/Demerit rows created by behaviour logging appear in wallet activity.
- Transfer creates balanced ledger rows.
- Insufficient balance is rejected.
- Parent/student scope is enforced.
- Audit rows are written.

Verification:

- `pnpm --filter @oasis/api test -- meritLedger.router.test.ts behaviour.router.test.ts`
- `pnpm --filter @oasis/domain test -- meritLedger.test.ts`
- `pnpm --filter @oasis/api typecheck`
- `pnpm lint`
- `pnpm typecheck`

---

## Sprint 2 - Tithe and investment

Goal: implement the biblical money-management engine behind the wallet.

### PR-4.1 - `feat(api): weekly tithe config and run` MERGED

Merged via PR #136 on 2026-05-15.

Scope:

- Implement `tithe.getConfig`, `tithe.setPercentage`, and `tithe.runWeek`.
- Default percentage to 10 unless an existing row says otherwise.
- Allow Head/full-admin and linked parents to view/update percentage; student
  update rights depend on Director policy and should be explicit in the PR.
- Compute weekly tithe from gross positive merits in the period.
- Make weekly runs idempotent by student/week.
- Create balanced ledger rows for tithe debit and `TithePaid` credit.
- Audit config changes and weekly run results.

Tests:

- 10/15/20 validation.
- Idempotent run per student/week.
- Gross positive merits only; demerits do not reduce tithe base.
- Ledger rows balance.
- RBAC for Head/parent/student policy.

### PR-4.2 - `feat(api): investment NAV and account transactions` MERGED

Merged via PR #138 on 2026-05-15.

Scope:

- Implement `investment.account`, `investment.navHistory`,
  `investment.buy`, `investment.sell`, and `investment.tickNav`.
- Use the existing deterministic investment simulator domain helper.
- Store one NAV row per day and make ticks idempotent.
- Buy uses Spend merits to buy units at latest NAV.
- Sell converts units back to Spend minus the 5 percent configured fee.
- Add `InvestmentReturn` ledger accounting so NAV gains/losses balance without
  corrupting Investment cost basis.
- Audit buy/sell/tick operations.

Tests:

- NAV tick is deterministic for the configured seed.
- Duplicate same-day tick does not create duplicate NAV rows.
- Buy creates investment units and balanced ledger rows.
- Sell applies withdrawal fee and balanced ledger rows.
- Insufficient Spend/units are rejected.

Verification for Sprint 2:

- `pnpm --filter @oasis/api test -- tithe.router.test.ts investment.router.test.ts`
- `pnpm --filter @oasis/domain test -- tithe.test.ts investmentSim.test.ts`
- `pnpm --filter @oasis/api typecheck`
- `pnpm lint`
- `pnpm typecheck`

---

## Sprint 3 - Shop

Goal: make the Merit Shop operational with safe inventory and Spend debit
rules.

### PR-4.3 - `feat(api): shop item management` IN PROGRESS

Scope:

- Implement `shop.listItems`, `shop.createItem`, and `shop.updateItem`.
- Gate item create/update/deactivate to full-admin or `shopadmin`.
- Store price ex-VAT, VAT rate, derived price inc-VAT, stock count, active
  state, and optional photo URL.
- Validate price and stock as non-negative integers.
- Audit item create/update/deactivate.

Tests:

- `shopadmin` and full-admin can manage items.
- `shopkeeper`, Supervisor, Parent, and Student cannot manage items.
- VAT-inclusive price is calculated consistently.
- Inactive items stay out of purchase lists by default.

### PR-4.4 - `feat(api): shopkeeper purchase flow` PLANNED

Scope:

- Implement `shop.purchase`.
- Gate purchase recording to full-admin or `shopkeeper`.
- Require active student, active item, positive units, and sufficient stock.
- Atomically decrement stock and debit student Spend ledger.
- Reject purchases that would make Spend negative.
- Audit purchase and ledger movement.

Tests:

- Shopkeeper records a purchase.
- Stock decrements once.
- Spend is debited through balanced ledger rows.
- Insufficient stock and insufficient Spend are rejected.
- Concurrent purchase path remains atomic.

### PR-4.5 - `feat(web): shop admin and shopkeeper UI` PLANNED

Scope:

- Add shop admin item management for full-admin/`shopadmin`.
- Add shopkeeper purchase flow: select student, select item, quantity, confirm.
- Show stock, inactive, insufficient balance, and success states.
- Add parent/student read-only receipt/list views only if API support is already
  in place; otherwise defer to student mobile view PR.

Tests:

- Shopadmin creates/updates/deactivates an item.
- Shopkeeper records a purchase.
- Unauthorized users cannot access shop admin/purchase routes.
- Error states are visible and do not clear the form unexpectedly.

Verification for Sprint 3:

- `pnpm --filter @oasis/api test -- shop.router.test.ts`
- `pnpm --filter @oasis/domain test -- shop.test.ts`
- `pnpm --filter @oasis/web typecheck`
- `pnpm lint`
- `pnpm --filter @oasis/web build`

---

## Sprint 4 - Leaderboards and student mobile

### PR-4.6 - `feat(api): merit leaderboards` PLANNED

Scope:

- Implement `leaderboard.get`.
- Support `TopTithers`, `TopInvestors`, `TopSavers`, and `HighestDemerits`.
- Allow public staff/parent/student access to positive leaderboards within
  policy.
- Gate `HighestDemerits` to full-admin or `leaderboard-admin`.
- Avoid leaking extra PII; return only display name/year group needed for the
  board.
- Consider daily snapshots if live aggregation is too expensive.

Tests:

- Each leaderboard ranks correctly.
- Highest Demerits is denied for untagged users.
- Ties and zero-data states are deterministic.
- Sensitive behaviour notes are never included.

### PR-4.7 - `feat(mobile): student merit and results view` PLANNED

Scope:

- Add Student mobile shell after Clerk sign-in and role resolution.
- Show balances across Spend, Saving, and Investment.
- Show week/month merit activity.
- Show PACE results.
- Allow approved transfers and tithe percentage changes per policy.
- Show leaderboard tab.
- Show shop browsing tab; purchasing remains shopkeeper flow unless policy says
  otherwise.

Tests:

- Mobile typecheck.
- Student can load own data only.
- Student cannot load another student's data.
- Transfer/tithe actions follow API policy.

Verification for Sprint 4:

- `pnpm --filter @oasis/api test -- leaderboard.router.test.ts meritLedger.router.test.ts`
- `pnpm --filter @oasis/domain test -- leaderboard.test.ts`
- `pnpm --filter @oasis/mobile typecheck`
- `pnpm lint`
- Manual or automated mobile smoke.

---

## Sprint 5 - Term reports

Goal: compile the centre's termly report from the data captured throughout the
portal.

### PR-4.8 - `feat(api): term report draft/review/send` PLANNED

Scope:

- Implement `report.draft`, `report.review`, `report.send`, and
  `report.listForStudent`.
- Compile report data from attendance, PACE, behaviour, notes, merit activity,
  and Head summary.
- Store immutable report snapshot once sent so historical reports do not drift.
- Encrypt compiled report body/snapshot if it contains PII.
- Gate draft/review/send to full-admin users.
- Allow parents to list/read sent reports for their linked children.
- Audit draft/review/send/read actions.

Tests:

- Draft compiles expected snapshot data.
- Review updates Head summary without sending.
- Send freezes the snapshot and records sent timestamp.
- Parent can read sent report for linked child only.
- Report body/snapshot is encrypted at rest.

### PR-4.9 - `feat(web): term report review and send UI` PLANNED

Scope:

- Add Head/admin report dashboard.
- Add student report draft view, editable Head summary, review state, and send
  action.
- Add parent sent-report list/read view.
- Add email notification hook for sent report.
- Keep bulk PDF export out of scope unless required for the centre handoff.

Tests:

- Head drafts, reviews, and sends a report.
- Parent can view sent report for linked child.
- Parent cannot view draft report or another child's report.
- Email notification path is covered by API/template tests.

---

## Sprint 6 - Phase 4 verification

### PR-4.10 - `test: Phase 4 verification suite` PLANNED

Scope:

- Add accounting invariant tests across merit, tithe, investment, shop, and
  behaviour ledger writes.
- Add e2e web coverage for shop admin/shopkeeper and report review/send.
- Add mobile smoke for student balances, PACE results, transfers/tithe, and
  leaderboards.
- Re-run DB/RLS smoke and encryption dump verification.
- Update this plan with merged status and carry-forward items.

Verification:

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm --filter @oasis/web build`
- `pnpm --filter @oasis/mobile typecheck`
- `pnpm db:integration`
- `pnpm api:smoke-context-rls`
- `pnpm verify:encryption`
- Credentialed Playwright/mobile checks where available.

---

## Assumptions and defaults

- Default tithe percentage remains 10 unless Director decides otherwise.
- Investment simulator defaults remain 10 percent annual drift, approximately
  15 percent volatility, and 5 percent withdrawal fee until Director signs off
  different values.
- Shop VAT default remains a Director decision and should be locked before
  PR-4.3.
- Ledger rows are append-only; never update/delete financial history.
- Full 2FA enforcement remains Phase 5.
