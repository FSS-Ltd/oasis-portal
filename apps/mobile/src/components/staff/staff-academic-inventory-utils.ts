export function canOpenAcademicInventory(user: { role?: string } | undefined): boolean {
  return user?.role === 'Head';
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
