import { MotionPage } from '@/components/admin/motion';
import { getLinkedChildPortalUser } from '@/components/admin/require-full-admin';
import { LinkedChildClubDetailClient } from '@/components/clubs/linked-child-club-detail-client';

export default async function AdminMyClubDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ clubId: string }>;
  searchParams: Promise<{ studentId?: string }>;
}) {
  await getLinkedChildPortalUser();
  const { clubId } = await params;
  const { studentId } = await searchParams;

  if (!studentId) throw new Error('studentId is required');

  return (
    <MotionPage>
      <LinkedChildClubDetailClient
        backHref="/admin/my-clubs"
        clubId={clubId}
        studentId={studentId}
      />
    </MotionPage>
  );
}
