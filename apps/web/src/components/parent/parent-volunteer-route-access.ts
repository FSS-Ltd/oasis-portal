import { notFound } from 'next/navigation';
import { canUseParentVolunteerNavigation, type ParentVolunteerAccess } from '@oasis/domain';

export function assertParentVolunteerRouteAccess(access: ParentVolunteerAccess): void {
  if (!canUseParentVolunteerNavigation(access)) notFound();
}
