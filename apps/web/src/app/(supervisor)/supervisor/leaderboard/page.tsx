import { MotionPage } from '@/components/admin/motion';
import { getStaffUser } from '@/components/admin/require-full-admin';
import { LeaderboardClient } from '@/components/leaderboard/leaderboard-client';

export default async function SupervisorLeaderboardPage() {
  await getStaffUser();

  return (
    <MotionPage>
      <LeaderboardClient portal="supervisor" />
    </MotionPage>
  );
}
