import { notFound } from 'next/navigation';
import { ROTA_VISIBLE } from '@oasis/domain/portal-visibility';
import { MotionPage } from '@/components/admin/motion';
import {
  getLinkedChildPortalUser,
  getParentVolunteerAccess,
} from '@/components/admin/require-full-admin';
import { ParentVolunteerClient } from '@/components/parent/parent-volunteer-client';
import { assertParentVolunteerRouteAccess } from '@/components/parent/parent-volunteer-route-access';

export default async function ParentVolunteerPage() {
  if (!ROTA_VISIBLE) notFound();
  const user = await getLinkedChildPortalUser();
  assertParentVolunteerRouteAccess(await getParentVolunteerAccess(user));

  return (
    <MotionPage>
      <ParentVolunteerClient />
    </MotionPage>
  );
}
