import { MotionPage } from '@/components/admin/motion';
import { getLinkedChildPortalUser } from '@/components/admin/require-full-admin';
import { MessageCentre } from '@/components/messages/message-centre';

export default async function ParentMessagesPage() {
  await getLinkedChildPortalUser();

  return (
    <MotionPage>
      <MessageCentre mode="parent" />
    </MotionPage>
  );
}
