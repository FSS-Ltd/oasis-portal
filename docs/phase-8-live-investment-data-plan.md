# Phase 8 - Live investment data and merit conversion PR plan

**Status:** Planned
**Last updated:** 2026-06-05
**Parent plan:** [`/oasis-platform-plan.md`](/oasis-platform-plan.md) Delivery phases
**Project context:** [`/PROJECT_Oasis_Context.md`](/PROJECT_Oasis_Context.md)
**Related architecture:** [`/docs/architecture/component-relationships.md`](/docs/architecture/component-relationships.md)

---

## Purpose

Phase 8 replaces the student investment demo data with server-side market data
that is safe for an educational merit economy.

Students should see real market movement translated into merits without the
interface pretending that Oasis is providing financial advice, brokerage, or
cash-equivalent investment returns. One merit remains equal to GBP 10 for all
server-side conversion. A learning multiplier can scale visible percentage
movement so children can see growth and loss patterns in days or weeks instead
of waiting years.

This is a docs-only plan. No schema, API, route, cron, or UI code is implemented
by this PR.

---

## Current State

- Phase 4 implemented the append-only merit ledger, investment NAV, buy/sell
  workflows, and withdrawal fee model.
- The student investment surface currently has mock instruments and local
  conversion helpers in
  `apps/web/src/components/student/invest/student-invest-data.ts`.
- That mock data already carries `meritGbp = 10`, seeded price series,
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

1. Live or delayed stock/ETF quotes are fetched only by the server.
2. API keys and provider details are never exposed to browsers or mobile apps.
3. All price-to-merit conversion is calculated server-side using
   `1 merit = GBP 10`.
4. Non-GBP instruments are converted to GBP server-side before merit conversion.
5. The provider adapter is typed, testable, rate-limited, cached, and replaceable
   without changing student UI contracts.
6. The platform stores provider snapshots needed for audit, fallback, and
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
12. Provider outages degrade to cached or last-known snapshots with a clear
    stale-data state.

---

## Provider Research Snapshot

Free financial data tiers change often. These were checked on 2026-06-05 and
must be re-checked before implementation.

| Provider | Current free tier signal | Fit for Oasis | Notes |
| --- | --- | --- | --- |
| Twelve Data | Official pricing lists Free as 8 API credits per minute and 800 per day. | Best free primary candidate for a small curated instrument list. | Supports market data and reference data. Needs API key. Source: https://twelvedata.com/pricing |
| Financial Modeling Prep | Official FAQ says free plan allows up to 250 market data API requests per day. | Good secondary candidate or fallback for daily quotes/history. | Needs API key. Check endpoint entitlement before choosing. Source: https://site.financialmodelingprep.com/faqs?code=marketHours |
| Alpha Vantage | Official premium page says free endpoints exist, but standard free usage is 25 requests per day. | Useful for prototypes, weak for production unless the watchlist is very small. | Needs API key. Batch and caching would be mandatory. Source: https://www.alphavantage.co/premium/ |
| Marketstack | Official pricing says Free supports 100 requests per month, end-of-day data, and one year of history. | Too tight for live-feeling student charts, but possible as a fallback for end-of-day snapshots. | Needs API key. Free tier is not suitable for frequent refresh. Source: https://marketstack.com/pricing |
| Finnhub | Official quote docs provide real-time US stock quotes and warn against constant polling. Search/pricing pages show a free tier, but current free quota should be confirmed in-account before implementation. | Strong candidate for US stocks if the confirmed free quota and licensing fit. | Needs API key. Prefer websocket only if a paid/licensed plan is chosen. Source: https://api.finnhub.io/docs/api/quote |
| Stooq | Public historical datasets include UK and US stocks/ETFs. | Useful as no-key historical fallback, not as the primary live source. | Terms and acceptable automated use need review before production. Source: https://stooq.com/db/h/ |
| Frankfurter | Public FX API requires no key and tracks daily exchange rates from central banks. | Best free FX source for USD/EUR to GBP conversion when provider quotes are not GBP. | Daily reference rates are enough for educational valuation. Source: https://frankfurter.dev/ |

Recommendation:

- Start with Twelve Data as the primary quote/history provider because the free
  quota is large enough for a small curated list.
- Add Financial Modeling Prep as a secondary adapter only if its free endpoints
  cover the selected instruments.
- Use Frankfurter for FX conversion into GBP.
- Keep Alpha Vantage and Marketstack as low-volume fallback options, not the
  default path.
- Avoid unofficial Yahoo Finance wrappers for production. They are useful for
  exploration but do not give a stable contract or clear platform terms.

---

## Product Rules

### Merit Conversion

Server-side constants:

- `MERIT_GBP_VALUE = 10`
- `gbpValue = quotePrice * units * gbpFxRate`
- `meritValue = gbpValue / MERIT_GBP_VALUE`
- `costMerits = costGbp / MERIT_GBP_VALUE`
- `rawProfitMerits = meritValue - costMerits`

Rules:

- Store and compute monetary source values in minor units or decimal-safe
  values. Do not use floating point for ledger amounts.
- Never ask the client to convert prices, FX rates, or GBP values into merits.
- Store provider timestamp, source currency, source price, FX rate, and converted
  GBP value with every valuation snapshot used for portfolio display.
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
- Caps prevent volatile stocks from looking like a game of random jackpots.
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
- Provider adapters:
  - `TwelveDataMarketDataProvider`
  - optional `FinancialModelingPrepMarketDataProvider`
  - optional `CachedMarketDataProvider`
- FX adapter:
  - `FrankfurterFxProvider`
- Domain helpers:
  - `convertQuoteToMerits`
  - `applyLearningReturnMultiplier`
  - `portfolioValuationFromSnapshots`
  - `staleMarketDataStatus`
- API surface:
  - Extend existing `investment` router.
  - Do not create a broad new student market router unless the responsibility
    becomes separate from investment account valuation.
- Scheduled refresh:
  - Pull curated instrument quotes on a cron cadence.
  - Cache quotes in DB so student page loads do not call provider APIs directly.

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
  - `sourceCurrency`
  - `sourcePrice`
  - `gbpFxRate`
  - `gbpPrice`
  - `previousCloseGbp`
  - `dayChangePct`
  - `rawPayloadHash`
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

## Instrument Policy

Start with a small curated list to stay within free API limits:

- Broad ETFs first: global, S&P 500, FTSE 100, gold or bond proxy.
- A small number of recognisable stocks for engagement: Apple, Microsoft,
  Nvidia, Disney, Nike, Coca-Cola.
- Avoid penny stocks, leveraged products, options, crypto, meme-only assets, and
  anything that creates a gambling feel.

Implementation should support disabling an instrument without deleting history.

---

## Sprint Plan

### PR-8.0 - `docs: plan live investment data phase`

Goal:

- Create this Phase 8 plan.

Scope:

- Documentation only.
- Record provider options, merit conversion rules, multiplier policy, PR
  sequence, risks, and verification expectations.

Done criteria:

- Phase 8 has a reviewable implementation sequence.
- No code, schema, generated graph, or UI files are changed.

### PR-8.1 - `feat: add market data provider contracts`

Goal:

- Define typed server-side contracts for quote, history, instrument profile, and
  FX data.

Scope:

- Add provider interfaces and normalized DTOs.
- Add fixture-backed provider tests.
- Add environment variable names for provider keys.
- Add no real provider calls in unit tests.

Done criteria:

- Provider responses normalize to GBP-ready server DTOs.
- Invalid, missing, stale, and rate-limited responses are represented without
  using `any`.
- Tests cover provider normalization and error mapping.

### PR-8.2 - `feat: store investment instruments and market snapshots`

Goal:

- Add the storage layer needed to audit and cache provider data.

Scope:

- Add or extend instrument and snapshot models.
- Seed the initial curated instrument list.
- Store quote timestamp, source currency, source price, FX rate, and GBP price.
- Add indexes for latest snapshot per instrument and historical chart reads.
- Add RLS policies if snapshots become tenant/user-scoped.

Done criteria:

- Snapshots can be replayed for portfolio valuation.
- Instrument enable/disable does not delete history.
- Migration applies cleanly.
- Prisma and RLS checks pass.

### PR-8.3 - `feat: fetch live investment quotes server-side`

Goal:

- Pull provider data on the server and cache it before student pages read it.

Scope:

- Implement the primary market data adapter.
- Implement FX conversion to GBP.
- Add rate limiting, timeout, retry-with-backoff, and stale-cache fallback.
- Add cron or admin-triggered refresh path.
- Audit provider refresh failures without storing secrets.

Done criteria:

- Student page reads never trigger direct provider calls.
- Provider quota cannot be exhausted by page refreshes.
- Stale data state is returned when provider fetch fails.
- API keys stay server-only.

### PR-8.4 - `feat: convert live investment values to merits`

Goal:

- Centralize GBP-to-merit valuation in the backend.

Scope:

- Add domain helpers for `1 merit = GBP 10`.
- Convert holdings, cost basis, current value, daily movement, and chart series
  into merit-denominated API responses.
- Use decimal-safe math for ledger and valuation outputs.
- Add tests for GBP, USD-to-GBP, rounding, zero units, stale snapshots, and
  missing FX rates.

Done criteria:

- Client receives merit values, not raw provider-only prices.
- Rounding is deterministic and documented.
- Non-GBP instruments produce correct merit values after FX conversion.

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

- Replace mock investment values with server-sourced valuations.

Scope:

- Use existing student investment components where possible.
- Show loading, stale, provider-error, empty-holdings, and disabled-instrument
  states.
- Label learning-adjusted growth clearly.
- Keep student-safe copy: educational, not advice.
- Reference `design/Oasis Learning Center.zip` before UI changes.

Done criteria:

- No client-side provider keys or quote conversion logic.
- UI handles stale data without crashing.
- Raw market movement and learning growth are not visually confused.
- Mobile and desktop layouts remain consistent with the Oasis reference design.

### PR-8.7 - `test: verify live investment data accounting`

Goal:

- Prove Phase 8 does not break the merit ledger or investment account
  invariants.

Scope:

- Add integration tests for buy, sell, valuation, stale data, multiplier, and
  provider fallback flows.
- Add end-of-phase verification commands.
- Update the investment section of the runbook for provider outage and stale
  quote incidents.

Done criteria:

- Ledger correlation IDs still balance.
- Buy/sell rows remain append-only.
- Stale provider data cannot create duplicate or unbalanced ledger movement.
- Runbook has clear operational steps for provider failures.

---

## Security, Privacy, and Compliance Guardrails

- Treat stock data as educational content, not regulated advice.
- Add internal and student-facing language that values are virtual merits, not
  cash investments.
- Do not show external account linking, real brokerage calls, deposits, or
  withdrawals.
- Keep all API keys in server environment variables.
- Do not store raw provider payloads unless there is a clear retention reason.
  Prefer a hash plus normalized fields.
- Avoid symbols or products that could be inappropriate for children.
- Respect provider licensing and display terms before production launch.

---

## Verification Expectations

Each implementation PR should run only the relevant checks for its scope. The
expected end-of-phase checks are:

- `pnpm --filter @oasis/domain test -- investmentTransactions.test.ts`
- `pnpm --filter @oasis/domain test -- investmentSim.test.ts`
- new market-data domain tests
- `pnpm --filter @oasis/api test -- investment.router.test.ts`
- new provider adapter tests with fixtures
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
4. Which provider's terms allow the exact planned student display and retention
   model?
5. Should Phase 8 keep the existing single global NAV concept for simple
   investing, or move fully to instrument-level holdings?

Recommended decisions before implementation:

- Keep the multiplier global for v1.
- Keep learning-adjusted gains visual until a normal investment sell occurs.
- Keep the curated instrument list small enough to fit the free provider quota.
- Re-check provider terms and limits at PR-8.1 start.
