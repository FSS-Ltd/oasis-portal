import { MessageCentre } from '@/components/messages/message-centre';

export default function StudentMessagesPage() {
  return (
    <main className="page-shell">
      <MessageCentre mode="student" />
    </main>
  );
}
