import { MotionPage } from '@/components/admin/motion';
import { getParentMessageResponderUser } from '@/components/admin/require-full-admin';
import { MessageCentre } from '@/components/messages/message-centre';

export default async function AdminMessagesPage() {
  await getParentMessageResponderUser();

  return (
    <MotionPage>
      <MessageCentre mode="admin" />
    </MotionPage>
  );
}
