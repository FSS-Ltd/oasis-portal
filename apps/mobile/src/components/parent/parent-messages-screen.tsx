import { MobileMessagesPanel } from '../messages/mobile-messages-panel';
import type { ConversationSummary, Recipient } from '../messages/mobile-message-types';

export function ParentMessagesScreen({
  conversations,
  hasMore,
  loadingMore,
  onLoadMore,
  onRefresh,
  onThreadOpenChange,
  recipients,
  refreshing,
}: {
  conversations: ConversationSummary[];
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  onRefresh: () => Promise<void>;
  onThreadOpenChange: (open: boolean) => void;
  recipients: Recipient[];
  refreshing: boolean;
}) {
  return (
    <MobileMessagesPanel
      conversationKind="ParentStaff"
      conversations={conversations}
      hasMore={hasMore}
      loadingMore={loadingMore}
      onLoadMore={onLoadMore}
      onRefresh={onRefresh}
      onThreadOpenChange={onThreadOpenChange}
      recipients={recipients}
      refreshing={refreshing}
    />
  );
}
