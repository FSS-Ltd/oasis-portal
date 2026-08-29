import { z } from 'zod';

export const paceInventoryOrderStatus = z.enum(['Ordered', 'InTransit', 'Delivered']);

export const paceInventoryOrderInput = z.object({
  paceNumber: z.number().int().min(1001),
  quantity: z.number().int().min(1),
});

export const paceInventoryStatusInput = z.object({
  orderId: z.string().trim().min(1),
  status: paceInventoryOrderStatus,
});

export const diagnosticOutcome = z.enum(['Pass', 'Fail']);

export const diagnosticResultInput = z.object({
  studentId: z.string().trim().min(1),
  subjectId: z.string().trim().min(1),
  level: z.number().int().min(1).max(5),
  outcome: diagnosticOutcome,
});

export function firstPaceNumberForDiagnosticLevel(level: number): number {
  return 1001 + ((level - 1) * 12);
}

export function requiresPaceReorder(current: number, delivered: number | null): boolean {
  return delivered !== null && current >= delivered - 2;
}
