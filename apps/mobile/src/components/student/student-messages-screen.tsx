import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { api } from '../../lib/trpc';
import { MobileMessagesPanel } from '../messages/mobile-messages-panel';
import type { ConversationSummary } from '../messages/mobile-message-types';
import { C } from '../core/mobile-theme';
import { Card, ErrorText, InlineSpinner, MutedText, SectionTitle } from '../core/mobile-ui';
import {
  isPastoralStudentMessageRecipient,
  isStudentMessagingDisabledMessage,
  studentMessageAccessBlockedCopy,
} from './student-messages-utils';

interface StudentMessagesScreenProps {
  conversations: ConversationSummary[];
  conversationsError: string | null;
  hasMore: boolean;
  loading: boolean;
  loadingMore: boolean;
  refreshing: boolean;
  onLoadMore: () => void;
  onRefresh: () => Promise<void>;
}

export function StudentMessagesScreen({
  conversations,
  conversationsError,
  hasMore,
  loading,
  loadingMore,
  refreshing,
  onLoadMore,
  onRefresh,
}: StudentMessagesScreenProps) {
  const studentDirectContacts = api.message.listRecipients.useQuery(
    { kind: 'StudentDirect' },
    { retry: false },
  );
  const studentDirectStaffRecipients = useMemo(
    () => (studentDirectContacts.data ?? []).filter(isPastoralStudentMessageRecipient),
    [studentDirectContacts.data],
  );
  const recipientsError = studentDirectContacts.error?.message ?? null;
  const error = conversationsError ?? recipientsError;
  const blocked = isStudentMessagingDisabledMessage(error);
  const loadingContacts = studentDirectContacts.isLoading;

  async function refreshPanel() {
    await Promise.all([onRefresh(), studentDirectContacts.refetch()]);
  }

  if (
    (loading || loadingContacts) &&
    conversations.length === 0 &&
    studentDirectStaffRecipients.length === 0
  ) {
    return (
      <Card style={styles.stateCard}>
        <InlineSpinner label="Loading student messages" />
      </Card>
    );
  }

  if (blocked) {
    return (
      <Card style={styles.stateCard}>
        <SectionTitle>Messaging blocked</SectionTitle>
        <MutedText>Messaging is disabled for your account right now.</MutedText>
        <MutedText>{studentMessageAccessBlockedCopy.join(' · ')}</MutedText>
        {error ? <ErrorText>{error}</ErrorText> : null}
      </Card>
    );
  }

  if (error && conversations.length === 0 && studentDirectStaffRecipients.length === 0) {
    return (
      <Card style={styles.stateCard}>
        <SectionTitle>Messages unavailable</SectionTitle>
        <MutedText>This account cannot open student messages right now.</MutedText>
        <ErrorText>{error}</ErrorText>
      </Card>
    );
  }

  return (
    <View style={styles.stack}>
      {loading || loadingContacts ? (
        <Card style={styles.stateCard}>
          <InlineSpinner label="Loading student messages" />
        </Card>
      ) : null}

      {error ? (
        <Card style={styles.errorCard}>
          <SectionTitle>Messages unavailable</SectionTitle>
          <ErrorText>{error}</ErrorText>
        </Card>
      ) : null}

      <Card style={styles.heroCard}>
        <Text style={styles.eyebrow}>Student communications</Text>
        <SectionTitle>Messages</SectionTitle>
        <MutedText>Pastoral and centre messages with the Head or Pastor.</MutedText>
      </Card>

      <MobileMessagesPanel
        conversationKind="StudentDirect"
        conversations={conversations}
        hasMore={hasMore}
        loadingMore={loadingMore}
        onLoadMore={onLoadMore}
        onRefresh={refreshPanel}
        recipients={studentDirectStaffRecipients}
        refreshing={refreshing || studentDirectContacts.isFetching}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  errorCard: {
    borderColor: C.dangerMid,
    gap: 8,
    padding: 16,
  },
  eyebrow: {
    color: C.crimson,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  heroCard: {
    gap: 10,
    padding: 16,
  },
  stack: {
    gap: 14,
  },
  stateCard: {
    gap: 10,
    padding: 16,
  },
});
