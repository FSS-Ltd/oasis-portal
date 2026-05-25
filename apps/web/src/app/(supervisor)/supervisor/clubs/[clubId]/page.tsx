import { MotionPage } from '@/components/admin/motion';
import { getLinkedChildPortalUser } from '@/components/admin/require-full-admin';
import { LinkedChildClubDetailClient } from '@/components/clubs/linked-child-club-detail-client';

export default async function SupervisorClubDetailPage({
  params,
}: {
  params: Promise<{ clubId: string }>;
}) {
  await getLinkedChildPortalUser();
  const { clubId } = await params;

  return (
    <MotionPage>
      <LinkedChildClubDetailClient backHref="/supervisor/clubs" clubId={clubId} />
    </MotionPage>
  );
}
