import { MotionPage } from '@/components/admin/motion';
import { assertStaffUser } from '@/components/admin/require-full-admin';
import { MessageCentre } from '@/components/messages/message-centre';

export default async function SupervisorMessagesPage() {
  await assertStaffUser();

  return (
    <MotionPage>
      <MessageCentre mode="supervisor" />
    </MotionPage>
  );
}
