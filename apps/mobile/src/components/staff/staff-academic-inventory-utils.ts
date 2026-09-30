export function canOpenAcademicInventory(user: { role?: string } | undefined): boolean {
  return user?.role === 'Head';
}

export function diagnosticPlacementLabel(level: number): string {
  return `Level ${String(level)} starts at PACE #${String(1001 + (level - 1) * 12)}`;
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
