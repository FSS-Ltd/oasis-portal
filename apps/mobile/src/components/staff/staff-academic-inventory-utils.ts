export function canOpenAcademicInventory(user: { role?: string } | undefined): boolean {
  return user?.role === 'Head';
}

/** Every PACE from first to last, or null when either end is invalid or out of order. */
export function attemptedPaceRange(first: string, last: string): number[] | null {
  const from = paceNumberValue(first);
  const to = paceNumberValue(last);
  if (from === null || to === null || from > to) return null;
  return Array.from({ length: to - from + 1 }, (_, index) => from + index);
}

export function describePlacement(placement: {
  learningGaps: readonly number[];
  performanceLevelPace: number | null;
}): string {
  const gaps = placement.learningGaps.length
    ? `PACEs # ${placement.learningGaps.join(', ')}`
    : 'none';
  const advance =
    placement.performanceLevelPace === null
      ? 'Passed every PACE.'
      : `Advance from PACE # ${String(placement.performanceLevelPace)}.`;
  return `Learning gaps: ${gaps}. ${advance}`;
}

export function paceNumberValue(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const paceNumber = Number(trimmed);
  return Number.isSafeInteger(paceNumber) && paceNumber >= 1001 && paceNumber <= 1144
    ? paceNumber
    : null;
}

export type OrderStatus = 'Ordered' | 'InTransit' | 'Delivered';
export type NextOrderStatus = Exclude<OrderStatus, 'Ordered'> | null;

export function nextOrderStatus(status: OrderStatus): NextOrderStatus {
  if (status === 'Ordered') return 'InTransit';
  return status === 'InTransit' ? 'Delivered' : null;
}
