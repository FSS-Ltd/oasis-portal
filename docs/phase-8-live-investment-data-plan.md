# Phase 8 - Twelve Data stock and ETF market data plan

**Status:** Planned
**Last updated:** 2026-06-05
**Parent plan:** [`/oasis-platform-plan.md`](/oasis-platform-plan.md) Delivery phases
**Project context:** [`/PROJECT_Oasis_Context.md`](/PROJECT_Oasis_Context.md)
**Related architecture:** [`/docs/architecture/component-relationships.md`](/docs/architecture/component-relationships.md)

---

## Purpose

Phase 8 replaces student investment demo prices with server-side stock and ETF
market data from Twelve Data.

Students should see realistic market movement translated into merits without
the interface pretending that Oasis is providing financial advice, brokerage, or
cash-equivalent investment returns. One merit remains equal to GBP 10 for all
server-side valuation. A learning multiplier can scale visible percentage
movement so children can see growth and loss patterns in days or weeks instead
of waiting years.

This is a docs-only plan. No schema, API, route, cron, generated graph, or UI
code is implemented by this PR.

---

## Source Of Truth Decision

Twelve Data is the source of truth for stock and ETF prices, quote timestamps,
day changes, and market-open status in Phase 8.

Decision:

- Use Twelve Data for all stock and ETF quote and history data.
- Do not offer FX, crypto, commodities, options, leveraged products, CFDs, or
  brokerage-style trading.
- Do not use unofficial market-data wrappers in production.
- Do not call provider APIs from browsers or mobile clients.
- Store normalized provider snapshots before student pages read prices.
- Treat cached Twelve Data snapshots as the fallback during provider outages.
  Do not blend prices from another provider unless a later ADR explicitly
  replaces this source-of-truth decision.

If non-GBP stocks or ETFs are included, currency conversion is only an internal
valuation step into GBP merits. It must not create an FX trading product or an
FX instrument list for students.

Current provider facts checked on 2026-06-05:

- Twelve Data Basic is free and lists `8 API (800 a day) + 8 trial WS` credits
  on the official pricing page.
- Twelve Data support documents that endpoint credit usage is calculated as
  `Data Weight x Number of Symbols`.
- Twelve Data batch requests reduce HTTP overhead but still consume credits per
  symbol.
- Twelve Data lists the London Stock Exchange `XLON` main market as
  `08:00 - 16:30` Monday to Friday in the `Europe/London` timezone.
- London Stock Exchange's own FAQ states that London Stock Exchange trading
  hours are `8:00 to 16:30`.

Sources:

- https://twelvedata.com/pricing
- https://support.twelvedata.com/en/articles/5615854-credits
- https://support.twelvedata.com/en/articles/5203360-batch-api-requests
- https://twelvedata.com/exchanges/XLON?group=core
- https://www.londonstockexchange.com/personal-investing/faqs

Free tiers and market-data entitlements change. Re-check the Twelve Data plan,
selected symbol coverage, and display terms at PR-8.1 start before writing the
provider adapter.

---

## Current State

- Phase 4 implemented the append-only merit ledger, investment NAV, buy/sell
  workflows, and withdrawal fee model.
- The student investment surface currently has local demo instruments and
  conversion helpers in
  `apps/web/src/components/student/invest/student-invest-data.ts`.
- That demo data already carries `meritGbp = 10`, seeded price series,
  intraday movement, holdings, and stock/ETF examples.
- Product ownership stays with the existing finance module:
  `apps/api/src/routers/investment.ts`,
  `packages/domain/src/investmentSim.ts`, and
  `packages/domain/src/investmentTransactions.ts`.
- Any production implementation must preserve the append-only ledger decision in
  [`/docs/adr/0004-merit-ledger-double-entry.md`](/docs/adr/0004-merit-ledger-double-entry.md).

---

## Phase-Level Acceptance Criteria

Phase 8 is complete when:

1. Stock and ETF quotes are fetched only by the server.
2. Twelve Data API keys and provider details are never exposed to browsers or
   mobile apps.
3. All price-to-merit conversion is calculated server-side using
   `1 merit = GBP 10`.
4. Any required currency conversion is internal valuation only, not an FX
   trading feature.
5. The Twelve Data adapter is typed, testable, rate-limited, cached, and
   replaceable only through an explicit provider-decision change.
6. The platform stores provider snapshots needed for audit, stale fallback, and
   repeatable portfolio valuation.
7. The visible learning multiplier is applied to returns consistently for both
   gains and losses.
8. The UI can show raw market movement and learning-adjusted movement without
   confusing the two.
9. Children cannot create real-money trades, external brokerage orders, or
   cash-equivalent withdrawals.
10. Parents and staff can understand the multiplier policy from internal docs
    and support copy.
11. Existing merit ledger invariants still pass for buy, sell, transfer,
    withdrawal fee, and investment return entries.
12. Provider outages degrade to cached or last-known Twelve Data snapshots with
    a clear stale-data state.

---

## Trading Session Policy

Use the standard London Stock Exchange main-market session for server refreshes
and open/closed display:

- Timezone: `Europe/London`.
- Regular open: Monday to Friday, `08:00`.
- Regular close: Monday to Friday, `16:30`.
- Closed: weekends, configured London Stock Exchange holidays, and configured
  half-day close periods.
- Pre-market and post-market data must not drive student valuation in v1.
- If Twelve Data reports a market status that conflicts with the local calendar,
  preserve both facts in logs and prefer the conservative closed/stale state for
  student-facing displays.

Implementation notes:

- The server should own the trading calendar decision.
- Store both provider timestamp and server fetch timestamp.
- Student pages should show `Open`, `Closed`, or `Stale` from server state.
- Cached values can remain visible while closed, labelled with the latest
  snapshot time.
- The first implementation can use a maintained holiday configuration. A later
  PR can add Twelve Data exchange schedule reads if the endpoint is available on
  the selected plan.

---

## Free-Tier Pull Budget

Twelve Data Basic currently allows:

- `8` API credits per minute.
- `800` API credits per UTC day.
- Quote batching by symbol, where each symbol still consumes credit.

Assumption for planning:

- A quote for one stock or ETF symbol costs `1` API credit.
- The curated student universe is capped at `8` enabled instruments in v1.
- One full-universe quote batch therefore costs `8` API credits and fits the
  per-minute limit.

The standard LSE session is `08:00-16:30`, which is `510` minutes.

For `N` enabled stock/ETF instruments:

```text
creditsPerFullRefresh = N
maxFullRefreshesPerDay = floor(800 / N)
averageOpenSessionIntervalMinutes = 510 / maxFullRefreshesPerDay
```

Recommended v1 operating point:

```text
enabledInstruments = 8
creditsPerFullRefresh = 8
maxFullRefreshesPerDay = floor(800 / 8) = 100
averageOpenSessionInterval = 510 / 100 = 5.1 minutes
```

This is the closest live-feeling full-list refresh cadence available inside the
current free daily quota. A fixed every-5-minutes schedule across the whole
session would attempt about 103 full-list refreshes and use about 824 credits,
so the implementation should not use an uncapped five-minute cron.

Recommended scheduler:

- Refresh only during the London regular session.
- Spread up to `100` full-list refreshes between `08:00` and `16:30`
  `Europe/London`.
- Use a dynamic due-time scheduler with a persisted daily counter rather than a
  naive every-five-minutes cron.
- Enforce both `credits_used_today < 800` and `credits_used_this_minute <= 8`
  before calling Twelve Data.
- Stop automated refreshes when the market is closed.
- Keep a manual admin refresh path behind RBAC, but make it consume the same
  quota budget and audit the action.
- Persist `api-credits-used` and `api-credits-left` response headers when
  available so drift from the planning assumption is visible.

Reference intervals by curated instrument count:

| Enabled instruments | Credits per full refresh | Max full refreshes per day | Average interval during LSE open |
| ------------------: | -----------------------: | -------------------------: | -------------------------------: |
|                   4 |                        4 |                        200 |                     2.55 minutes |
|                   6 |                        6 |                        133 |                     3.83 minutes |
|                   8 |                        8 |                        100 |                     5.10 minutes |

If the curated list needs more than 8 instruments, split the list into rotating
cohorts. That should be treated as a product tradeoff because each instrument
will be less fresh than the full-list v1 cadence.

---

## Product Rules

### Instrument Policy

Start with a small curated stock/ETF list:

- Broad ETFs first: global equity, S&P 500, FTSE 100, gold or bond proxy.
- A small number of recognisable stocks for engagement: Apple, Microsoft,
  Nvidia, Disney, Nike, Coca-Cola.
- No FX pairs.
- No crypto.
- No penny stocks.
- No leveraged or inverse ETFs.
- No options, CFDs, spread betting, or synthetic trading products.
- No meme-only assets or assets selected primarily for volatility.

Implementation should support disabling an instrument without deleting history.

PR-8.2 seed decision:

- Seed the first storage migration with 8 US Basic-compatible educational
  instruments because Twelve Data Basic currently states real-time US equities
  and ETFs most clearly.
- Initial ETFs: `VOO`, `VT`, `BND`, `GLD`.
- Initial stocks: `AAPL`, `MSFT`, `NVDA`, `DIS`.
- Add requested LSE-listed UCITS/income ETFs in a follow-up seed migration after
  verifying Twelve Data market pages: `VUSA`, `CSP1`, `EQQQ`, `JEPQ`, and
  `JEPI`.
- Refresh more than 8 enabled instruments in cohorts of 8 so the free-tier
  per-minute credit cap is respected.
- Keep the storage schema provider-agnostic enough to disable or replace seeded
  instruments without deleting historical snapshots.

### Merit Conversion

Server-side constants:

- `MERIT_GBP_VALUE = 10`
- `gbpValue = quotePrice * units * gbpConversionRate`
- `meritValue = gbpValue / MERIT_GBP_VALUE`
- `costMerits = costGbp / MERIT_GBP_VALUE`
- `rawProfitMerits = meritValue - costMerits`

Rules:

- Store and compute monetary source values in minor units or decimal-safe
  values. Do not use floating point for ledger amounts.
- Never ask the client to convert prices, currency values, or GBP values into
  merits.
- Store provider timestamp, source currency, source price, conversion rate, and
  converted GBP value with every valuation snapshot used for portfolio display.
- Ledger movements remain merit-denominated. Provider data informs valuation,
  not direct cash movement.

### Learning Multiplier

The multiplier scales returns, not the underlying market price.

Default policy:

- `LEARNING_RETURN_MULTIPLIER = 10`
- `DAILY_VISIBLE_RETURN_CAP_RATE = +/-0.08`
- `WEEKLY_VISIBLE_RETURN_CAP_RATE = +/-0.18`
- `MONTHLY_VISIBLE_RETURN_CAP_RATE = +/-0.35`
- Losses are multiplied the same way as gains.

Formula:

```text
rawReturnRate = (currentGbpPrice - costBasisGbpPrice) / costBasisGbpPrice
learningReturnRate = clamp(rawReturnRate * multiplier, capRateForSelectedRange)
learningValueMerits = costMerits * (1 + learningReturnRate)
learningProfitMerits = learningValueMerits - costMerits
```

Design intent:

- A real 0.8 percent move can feel like an 8 percent learning move.
- A 10 merit holding can visibly move by around 0.8 merits instead of 0.08
  merits.
- A real loss is also amplified, so risk still feels real.
- Caps prevent volatile stocks from looking like random jackpots.
- The raw market percentage remains available for an "actual market move"
  label, while the multiplied value is labelled as the "learning growth" view.

Guardrail:

- Do not silently apply the multiplier to stored source prices.
- Do not use the multiplier to mint Spend merits automatically.
- Do not let children mistake learning-adjusted returns for real cash or real
  investment performance.

---

## Proposed Architecture

### Server Components

- `MarketDataProvider` interface:
  - `getQuotes(symbols)`
  - `getHistory(symbol, range)`
  - `getInstrumentProfile(symbol)`
- Provider adapter:
  - `TwelveDataMarketDataProvider`
- Domain helpers:
  - `convertQuoteToMerits`
  - `applyLearningReturnMultiplier`
  - `portfolioValuationFromSnapshots`
  - `staleMarketDataStatus`
  - `isLondonStockMarketOpen`
- API surface:
  - Extend existing `investment` router.
  - Do not create a broad new student market router unless the responsibility
    becomes separate from investment account valuation.
- Scheduled refresh:
  - Pull curated instrument quotes on the server.
  - Cache quotes in DB so student page loads do not call provider APIs directly.
  - Keep provider refresh independent from user traffic.

### Data Shape

Likely additive tables or models:

- `InvestmentInstrument`
  - `symbol`
  - `displayName`
  - `type`
  - `exchange`
  - `currency`
  - `providerSymbol`
  - `enabled`
  - `riskBand`
  - `sortOrder`
- `MarketDataSnapshot`
  - `instrumentId`
  - `provider`
  - `providerTimestamp`
  - `serverFetchedAt`
  - `sourceCurrency`
  - `sourcePrice`
  - `gbpConversionRate`
  - `gbpPrice`
  - `previousCloseGbp`
  - `dayChangePct`
  - `rawPayloadHash`
  - `providerCreditsUsed`
  - `providerCreditsLeft`
  - `createdAt`
- `InvestmentValuationSnapshot`
  - `studentId`
  - `instrumentId`
  - `units`
  - `costBasisGbp`
  - `rawValueMerits`
  - `rawReturnRate`
  - `learningMultiplier`
  - `learningValueMerits`
  - `learningReturnRate`
  - `snapshotAt`

Schema decision to confirm during implementation:

- If existing Phase 4 investment tables already cover instrument and valuation
  storage, extend them instead of adding duplicate models.
- If current investment storage is only NAV-based, add provider snapshots as a
  separate source table and keep ledger tables untouched.

---

## Sprint Plan

### PR-8.0 - `docs: finalise Twelve Data market data plan`

Goal:

- Create this Phase 8 plan.

Scope:

- Documentation only.
- Record Twelve Data as the source of truth, stock/ETF-only instrument policy,
  London trading session rules, free-tier pull budget, merit conversion rules,
  multiplier policy, PR sequence, risks, and verification expectations.

Done criteria:

- Phase 8 has a reviewable implementation sequence.
- No code, schema, generated graph, route, cron, or UI files are changed.

### PR-8.1 - `feat: add Twelve Data provider contracts`

Goal:

- Define typed server-side contracts for stock/ETF quote, history, and
  instrument profile data.

Scope:

- Add provider interfaces and normalized DTOs.
- Add fixture-backed provider tests.
- Add environment variable names for the Twelve Data API key.
- Add no real provider calls in unit tests.

Done criteria:

- Twelve Data responses normalize to GBP-ready server DTOs.
- Invalid, missing, stale, and rate-limited responses are represented without
  using `any`.
- Tests cover provider normalization and error mapping.

### PR-8.2 - `feat: store investment instruments and market snapshots`

Goal:

- Add the storage layer needed to audit and cache Twelve Data snapshots.

Scope:

- Add or extend instrument and snapshot models.
- Seed the initial curated stock/ETF list.
- Store quote timestamp, source currency, source price, conversion rate, and GBP
  price.
- Add indexes for latest snapshot per instrument and historical chart reads.
- Add RLS policies if snapshots become tenant/user-scoped.
- Add a small server-side storage service for enabled instrument reads, latest
  snapshot reads, and normalized quote snapshot persistence.
- Do not add live provider calls, cron wiring, student UI reads, or new tRPC
  endpoints in this PR.

Done criteria:

- Snapshots can be replayed for portfolio valuation.
- Instrument enable/disable does not delete history.
- Migration applies cleanly.
- Prisma and RLS checks pass.
- The seeded list includes `VOO`, `VT`, `BND`, `GLD`, `AAPL`, `MSFT`, `NVDA`,
  `DIS`, `VUSA`, `CSP1`, `EQQQ`, `JEPQ`, and `JEPI`, with server refreshes
  expected to cascade through cohorts of 8.

### PR-8.3 - `feat: fetch Twelve Data quotes server-side`

Goal:

- Pull Twelve Data quotes on the server and cache them before student pages read
  them.

Scope:

- Implement the Twelve Data market data adapter.
- Implement any required internal conversion to GBP.
- Add rate limiting, timeout, retry-with-backoff, and stale-cache fallback.
- Add automated server refresh using the free-tier budget policy in this plan.
- Refresh enabled instruments in stable `sortOrder` cohorts of up to 8 symbols,
  because Twelve Data Basic is limited to 8 credits per minute and each quote
  symbol consumes credit.
- Persist quota counters and provider credit headers per refresh batch, not per
  page request.
- Add admin-triggered refresh behind RBAC and quota checks.
- Audit provider refresh failures without storing secrets.

Done criteria:

- Student page reads never trigger direct provider calls.
- Provider quota cannot be exhausted by page refreshes.
- More than 8 enabled instruments refresh by cascading batches without exceeding
  the per-minute credit cap.
- Stale data state is returned when provider fetch fails.
- API keys stay server-only.

### PR-8.4 - `feat: convert Twelve Data values to merits`

Goal:

- Centralize GBP-to-merit valuation in the backend.

Scope:

- Add domain helpers for `1 merit = GBP 10`.
- Convert holdings, cost basis, current value, daily movement, and chart series
  into merit-denominated API responses.
- Use decimal-safe math for ledger and valuation outputs.
- Add tests for GBP, non-GBP-to-GBP valuation, rounding, zero units, stale
  snapshots, and missing conversion rates.

Done criteria:

- Client receives merit values, not raw provider-only prices.
- Rounding is deterministic and documented.
- Non-GBP instruments produce correct merit values after internal conversion.

### PR-8.5 - `feat: add investment learning multiplier`

Goal:

- Apply the educational multiplier to visible returns without corrupting source
  market values.

Scope:

- Add domain helper for learning-adjusted return calculations.
- Apply the multiplier to gains and losses.
- Add range-based caps.
- Include raw return and learning return in API responses.
- Add tests for positive, negative, flat, extreme, and capped returns.

Done criteria:

- Multiplied returns are consistent across chart, holdings, and portfolio
  summary.
- Raw and learning-adjusted values are both available.
- Multiplier never changes stored provider prices or ledger source rows.

### PR-8.6 - `feat: update student investment UI for live valuations`

Goal:

- Replace demo investment values with server-sourced valuations.

Scope:

- Use existing student investment components where possible.
- Show loading, stale, provider-error, empty-holdings, disabled-instrument,
  market-open, and market-closed states.
- Label learning-adjusted growth clearly.
- Keep student-safe copy: educational, not advice.
- Reference `design/Oasis Learning Center.zip` before UI changes.

Done criteria:

- No client-side provider keys or quote conversion logic.
- UI handles stale and closed-market data without crashing.
- Raw market movement and learning growth are not visually confused.
- Mobile and desktop layouts remain consistent with the Oasis reference design.

### PR-8.7 - `test: verify live investment data accounting`

Goal:

- Prove Phase 8 does not break the merit ledger or investment account
  invariants.

Scope:

- Add integration tests for buy, sell, valuation, stale data, multiplier, quota
  guard, and provider fallback flows.
- Add end-of-phase verification commands.
- Update the investment section of the runbook for provider outage, exhausted
  credits, closed market, and stale quote incidents.

Done criteria:

- Ledger correlation IDs still balance.
- Buy/sell rows remain append-only.
- Stale provider data cannot create duplicate or unbalanced ledger movement.
- Runbook has clear operational steps for provider failures.

---

## Security, Privacy, And Compliance Guardrails

- Treat stock and ETF data as educational content, not regulated advice.
- Add internal and student-facing language that values are virtual merits, not
  cash investments.
- Do not show external account linking, real brokerage calls, deposits, or
  withdrawals.
- Keep all API keys in server environment variables.
- Do not store raw provider payloads unless there is a clear retention reason.
  Prefer a hash plus normalized fields.
- Avoid symbols or products that could be inappropriate for children.
- Respect Twelve Data licensing and display terms before production launch.

---

## Verification Expectations

Each implementation PR should run only the relevant checks for its scope. The
expected end-of-phase checks are:

- `pnpm --filter @oasis/domain test -- investmentTransactions.test.ts`
- `pnpm --filter @oasis/domain test -- investmentSim.test.ts`
- new market-data domain tests
- `pnpm --filter @oasis/api test -- investment.router.test.ts`
- new Twelve Data adapter tests with fixtures
- `pnpm --filter @oasis/domain typecheck`
- `pnpm --filter @oasis/api typecheck`
- `pnpm --filter @oasis/web typecheck`
- `pnpm --filter @oasis/domain lint`
- `pnpm --filter @oasis/api lint`
- `pnpm --filter @oasis/web lint`
- `pnpm --filter @oasis/web build`
- `pnpm db:migrate` for any Prisma migration PR
- `git diff --check`
- `graphify update .` after code changes

This docs-only PR does not require typecheck, lint, build, or tests beyond
Markdown inspection and diff review.

---

## Open Questions

1. Should the multiplier be global, age-band-specific, or instrument-risk-based?
2. Should parents and Head users be allowed to change the multiplier, or should
   it remain a platform constant?
3. Should learning-adjusted gains ever become spendable merits, or should they
   stay visual until a sell/transfer is explicitly made?
4. Which exact stock/ETF symbols are covered by the selected Twelve Data plan
   and licensing terms?
5. Should Phase 8 keep the existing single global NAV concept for simple
   investing, or move fully to instrument-level holdings?

Recommended decisions before implementation:

- Keep the multiplier global for v1.
- Keep learning-adjusted gains visual until a normal investment sell occurs.
- Keep the curated instrument list capped at 8 enabled stock/ETF instruments for
  v1.
- Re-check Twelve Data terms, limits, and symbol entitlements at PR-8.1 start.
