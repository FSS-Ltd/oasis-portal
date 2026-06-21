import type { RouterInputs, RouterOutputs } from '../../lib/trpc';

export type StudentDashboard = RouterOutputs['student']['dashboard'];
export type StudentWallet = RouterOutputs['student']['wallet'];
export type StudentWalletHistoryEntry = StudentWallet['history'][number];
export type StudentWalletAccount =
  | 'Spend'
  | 'Saving'
  | 'Investment'
  | 'ShopReserved'
  | 'TithePaid'
  | 'Given';
export type TransferAccount = 'Spend' | 'Saving';
export type TitheStatus = RouterOutputs['tithe']['getStatus'];
export type TithePreferenceInput = RouterInputs['tithe']['updatePreference'];
export type TitheCadence = TitheStatus['config']['cadence'];
export type TithePaymentMode = TitheStatus['config']['mode'];

export interface WalletAccountRow {
  account: StudentWalletAccount;
  detail: string;
  label: string;
}

export interface WalletActivitySummary {
  earned: number;
  spent: number;
  net: number;
}

export interface WalletTransferValidationInput {
  amount: number | null;
  balances: Pick<StudentWallet['balances'], TransferAccount>;
  from: TransferAccount;
}

export const walletAccountRows: readonly WalletAccountRow[] = [
  { account: 'Spend', detail: 'Ready for shop rewards', label: 'Spend' },
  { account: 'Saving', detail: 'Saved for later', label: 'Saving' },
  { account: 'Investment', detail: 'Longer-term growth', label: 'Investment' },
  { account: 'ShopReserved', detail: 'Held for shop orders', label: 'Shop holds' },
  { account: 'TithePaid', detail: 'Given as tithe', label: 'TithePaid' },
  { account: 'Given', detail: 'Given to charity', label: 'Charity' },
];

export const weeklyDayOptions: readonly { label: string; value: number }[] = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

const shortDateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
});

export function formatMerits(value: number): string {
  return `${value.toLocaleString('en-GB')} merits`;
}

export function formatSignedMerits(value: number): string {
  const absolute = Math.abs(value).toLocaleString('en-GB');
  if (value > 0) return `+${absolute}`;
  if (value < 0) return `-${absolute}`;
  return '0';
}

export function formatWalletDate(value: Date | string): string {
  return shortDateFormatter.format(new Date(value));
}

export function parseTransferAmount(value: string): number | null {
  const trimmed = value.trim();
  if (!/^[1-9]\d*$/.test(trimmed)) return null;
  return Number(trimmed);
}

export function parsePositiveMeritAmount(value: string): number | null {
  return parseTransferAmount(value);
}

export function walletTransferValidation({
  amount,
  balances,
  from,
}: WalletTransferValidationInput): string | null {
  if (amount === null) return 'Enter a positive whole number of merits.';
  if (from === 'Spend' && amount > balances[from]) return 'Not enough Spend merits.';
  if (from === 'Saving' && amount > balances[from]) return 'Not enough Saving merits.';
  return null;
}

export function summarizeWalletActivity(
  history: readonly StudentWalletHistoryEntry[],
  days: number,
  now = new Date(),
): WalletActivitySummary {
  const cutoff = now.getTime() - days * 24 * 60 * 60 * 1000;
  return history.reduce<WalletActivitySummary>(
    (summary, entry) => {
      if (new Date(entry.createdAt).getTime() < cutoff) return summary;
      if (entry.amount > 0) summary.earned += entry.amount;
      if (entry.amount < 0) summary.spent += Math.abs(entry.amount);
      summary.net += entry.amount;
      return summary;
    },
    { earned: 0, net: 0, spent: 0 },
  );
}

export function nextLearningSignal(dashboard: StudentDashboard): { detail: string; title: string } {
  if (!dashboard.profile.academicScreensEnabled) {
    return {
      detail: 'Academic screens will open when this year group is ready.',
      title: 'Learning dashboard warming up',
    };
  }

  const nextPace = dashboard.pace.currentPaces[0];
  if (nextPace) {
    return {
      detail: `${nextPace.subjectName} PACE ${String(nextPace.currentPaceNumber)}`,
      title: 'Next learning signal',
    };
  }

  return {
    detail: 'No active PACE assignments are due right now.',
    title: 'Next learning signal',
  };
}
