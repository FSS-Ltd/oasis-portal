import { MobileMessagesPanel } from '../messages/mobile-messages-panel';
import type { ConversationSummary, Recipient } from '../messages/mobile-message-types';

export function ParentMessagesScreen({
  conversations,
  hasMore,
  loadingMore,
  onLoadMore,
  onRefresh,
  recipients,
  refreshing,
}: {
  conversations: ConversationSummary[];
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  onRefresh: () => Promise<void>;
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
      recipients={recipients}
      refreshing={refreshing}
    />
  );
}
