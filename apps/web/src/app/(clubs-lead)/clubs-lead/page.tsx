import { Suspense } from 'react';
import { MotionPage } from '@/components/admin/motion';
import { getClubsLeadUser } from '@/components/admin/require-full-admin';
import { ClubsLeadPortalClient } from '@/components/clubs/clubs-lead-portal-client';

export default async function ClubsLeadPage() {
  await getClubsLeadUser();

  return (
    <MotionPage>
      <Suspense fallback={<div className="empty-state">Loading Clubs Lead portal...</div>}>
        <ClubsLeadPortalClient />
      </Suspense>
    </MotionPage>
  );
}
