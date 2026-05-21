'use client';

import { toast } from 'sonner';
import { friendlyErrorMessage } from '@/lib/user-facing-errors';

export { friendlyErrorMessage };

export function showSuccessToast(message: string): void {
  toast.success(message);
}

export function showErrorToast(error: unknown, fallback?: string): void {
  toast.error(friendlyErrorMessage(error, fallback));
}

