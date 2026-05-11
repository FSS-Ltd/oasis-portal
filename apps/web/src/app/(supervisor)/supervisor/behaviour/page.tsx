import { MotionPage } from '@/components/admin/motion';
import { BehaviourLogClient } from '@/components/behaviour/behaviour-log-client';
import { assertStaffUser } from '@/components/admin/require-full-admin';

export default async function SupervisorBehaviourPage() {
  await assertStaffUser();

  return (
    <MotionPage>
      <BehaviourLogClient canLogBehaviour sensitiveMode="demerit-only" />
    </MotionPage>
  );
}
