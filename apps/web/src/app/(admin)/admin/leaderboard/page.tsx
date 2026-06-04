import { canUseAdminOperations, isFullAdmin } from '@oasis/domain';
import { MotionPage } from '@/components/admin/motion';
import { getAdminShellUser } from '@/components/admin/require-full-admin';
import { LeaderboardClient } from '@/components/leaderboard/leaderboard-client';

export default async function AdminLeaderboardPage() {
  const user = await getAdminShellUser();

  return (
    <MotionPage>
      <LeaderboardClient
        canManageCharityGoal={isFullAdmin(user)}
        canViewFullLeaderboard={canUseAdminOperations(user)}
        includeAdminDemerits={isFullAdmin(user) || user.tags.includes('leaderboard-admin')}
        portal="admin"
      />
    </MotionPage>
  );
}
