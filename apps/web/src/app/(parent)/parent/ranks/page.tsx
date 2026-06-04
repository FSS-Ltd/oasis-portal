import { MotionPage } from '@/components/admin/motion';
import { getLinkedChildPortalUser } from '@/components/admin/require-full-admin';
import { LeaderboardClient } from '@/components/leaderboard/leaderboard-client';

export default async function ParentRanksPage() {
  await getLinkedChildPortalUser();

  return (
    <MotionPage>
      <LeaderboardClient portal="parent" />
    </MotionPage>
  );
}
