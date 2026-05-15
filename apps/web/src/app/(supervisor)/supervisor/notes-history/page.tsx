import { MotionPage } from '@/components/admin/motion';
import { assertStaffUser } from '@/components/admin/require-full-admin';
import { SupervisorNotesHistoryClient } from '@/components/child-log/supervisor-notes-history-client';

export default async function SupervisorNotesHistoryPage() {
  await assertStaffUser();

  return (
    <MotionPage>
      <SupervisorNotesHistoryClient />
    </MotionPage>
  );
}
