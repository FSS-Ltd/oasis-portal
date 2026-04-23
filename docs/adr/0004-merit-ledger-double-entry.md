# ADR 0004: Merit economy as an append-only double-entry ledger

- **Status:** Accepted
- **Date:** 2026-04-23

## Context

The merit economy has three student accounts (Spend, Saving, Investment),
plus virtual accounts for TithePaid, Given (awards posted by staff), and a
FeeSink (withdrawal fees). We must support:

- Awarding merits and demerits (demerit = fixed −5 to Spend).
- Weekly tithe at 10/15/20% of gross merits earned that week.
- Transfers Spend ↔ Saving ↔ Investment.
- Shop purchases (atomic debit Spend + decrement stock).
- Investment simulation (cost basis vs. current NAV).
- Leaderboards (TopTithers, TopInvestors, TopSavers, HighestDemerits).

Balances computed ad-hoc from "last balance + delta" columns drift as soon
as any update, refund, or retro-correction happens. We need an auditable,
reconstructable history.

## Decision

Model the economy as an **append-only double-entry ledger**:

- One table, `MeritLedgerEntry`, with `studentId`, `account`
  (`MeritAccount` enum), signed `amount`, `reason`, `correlationId`, and
  `createdAt`. Never updated, never deleted.
- Every business operation (award, demerit, tithe, transfer, purchase,
  investment buy/sell, withdrawal fee) produces a set of rows whose sum on
  a given `correlationId` is **zero** — enforced by `packages/domain/src/
  meritLedger.ts` row builders and validated at write time.
- Balances are derived by summing rows per `(studentId, account)`, with
  optional materialized views for hot queries.

## Consequences

- **Positive:** Every merit can be traced to the entry that created it.
  Refunds are new rows, not destructive edits. Leaderboards and reports
  derive from the same source — no "balance vs. transactions" mismatch.
  Auditable by auditors.
- **Negative:** Writes are chattier (N rows per op). Balance reads for
  large histories need either summation-on-read with indexes or a
  rollup table. Schema v1 indexes `(studentId, account, createdAt)` to
  keep reads cheap; a nightly rollup is a Phase 3 optimisation.
- **Reversible?** Adding new accounts or correlationId shapes is additive.
  Collapsing to a balance-column model would require a full replay.
