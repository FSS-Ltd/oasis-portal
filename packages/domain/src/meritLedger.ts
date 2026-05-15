/**
 * Merit ledger — append-only double-entry (ADR-004).
 *
 * Every movement is a row in `MeritLedger` with signed `delta` and a specific
 * `MeritAccount`. Balances are always `sum(delta) WHERE account = X`.
 * Nothing is stored denormalised.
 */

export const MERIT_ACCOUNTS = [
  'Spend',
  'Saving',
  'Investment',
  'InvestmentReturn',
  'TithePaid',
  'Given',
  'FeeSink',
] as const;
export type MeritAccount = (typeof MERIT_ACCOUNTS)[number];

export const DEMERIT_COST = 5;

export interface LedgerRow {
  studentId: string;
  account: MeritAccount;
  delta: number;
  reason: string;
  relatedEntryId?: string;
}

export interface Balances {
  Spend: number;
  Saving: number;
  Investment: number;
  InvestmentReturn: number;
  TithePaid: number;
  Given: number;
  FeeSink: number;
}

export function emptyBalances(): Balances {
  return {
    Spend: 0,
    Saving: 0,
    Investment: 0,
    InvestmentReturn: 0,
    TithePaid: 0,
    Given: 0,
    FeeSink: 0,
  };
}

export function applyRows(rows: readonly Pick<LedgerRow, 'account' | 'delta'>[]): Balances {
  const b = emptyBalances();
  for (const row of rows) {
    b[row.account] += row.delta;
  }
  return b;
}

/**
 * Ledger rows for earning merits (BehaviourType.Merit).
 * Credits Spend account by N.
 */
export function rowsForMerit(params: {
  studentId: string;
  amount: number;
  reason: string;
  behaviourEntryId: string;
}): LedgerRow[] {
  if (!Number.isInteger(params.amount) || params.amount <= 0) {
    throw new Error('merit amount must be a positive integer');
  }
  return [
    {
      studentId: params.studentId,
      account: 'Spend',
      delta: params.amount,
      reason: params.reason,
      relatedEntryId: params.behaviourEntryId,
    },
  ];
}

/**
 * Ledger rows for a demerit.
 * Debits Spend by the chosen positive amount, defaulting to DEMERIT_COST.
 */
export function rowsForDemerit(params: {
  studentId: string;
  amount?: number;
  reason: string;
  behaviourEntryId: string;
}): LedgerRow[] {
  const amount = params.amount ?? DEMERIT_COST;
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error('demerit amount must be a positive integer');
  }
  return [
    {
      studentId: params.studentId,
      account: 'Spend',
      delta: -amount,
      reason: params.reason,
      relatedEntryId: params.behaviourEntryId,
    },
  ];
}

/**
 * Student-initiated transfer between two of the student's own accounts.
 * Validates non-negative amount and that source and destination differ.
 * Balance-sufficiency check is the caller's responsibility (needs DB read).
 */
export function rowsForTransfer(params: {
  studentId: string;
  from: MeritAccount;
  to: MeritAccount;
  amount: number;
  reason: string;
}): LedgerRow[] {
  if (!Number.isInteger(params.amount) || params.amount <= 0) {
    throw new Error('transfer amount must be a positive integer');
  }
  if (params.from === params.to) {
    throw new Error('transfer source and destination must differ');
  }
  return [
    {
      studentId: params.studentId,
      account: params.from,
      delta: -params.amount,
      reason: `transfer:${params.reason}`,
    },
    {
      studentId: params.studentId,
      account: params.to,
      delta: params.amount,
      reason: `transfer:${params.reason}`,
    },
  ];
}

export interface MeritActivity {
  meritsEarned: number;
  demeritsCount: number;
  demeritsMerits: number;
  net: number;
}

/**
 * Per-period activity for Student/Parent/Supervisor dashboards.
 * Input: rows filtered by period in the caller (e.g. last 7 or 30 days).
 * Operates on behaviour entries, not ledger rows, because the "merits earned"
 * view ignores transfers and titheing.
 */
export function getMeritActivity(
  entries: readonly { type: 'Merit' | 'Demerit' | 'General'; meritDelta: number }[],
): MeritActivity {
  let meritsEarned = 0;
  let demeritsCount = 0;
  let demeritsMerits = 0;
  for (const e of entries) {
    if (e.type === 'Merit') meritsEarned += e.meritDelta;
    else if (e.type === 'Demerit') {
      demeritsCount += 1;
      demeritsMerits += Math.abs(e.meritDelta);
    }
  }
  return {
    meritsEarned,
    demeritsCount,
    demeritsMerits,
    net: meritsEarned - demeritsMerits,
  };
}
