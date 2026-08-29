export function canOpenAcademicInventory(user: { role?: string } | undefined): boolean {
  return user?.role === 'Head';
}

export function diagnosticPlacementLabel(level: number): string {
  return `Level ${String(level)} starts at PACE #${String(1001 + (level - 1) * 12)}`;
}

export type OrderStatus = 'Ordered' | 'InTransit' | 'Delivered';
export type NextOrderStatus = Exclude<OrderStatus, 'Ordered'> | null;

export function nextOrderStatus(status: OrderStatus): NextOrderStatus {
  if (status === 'Ordered') return 'InTransit';
  return status === 'InTransit' ? 'Delivered' : null;
}
