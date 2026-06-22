import { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { api } from '../../lib/trpc';
import { C } from '../core/mobile-theme';
import {
  Badge,
  Card,
  ErrorText,
  Field,
  InlineSpinner,
  MobileButton,
  MutedText,
  SectionTitle,
} from '../core/mobile-ui';
import {
  communityGroupMeta,
  communityMessageStatus,
  formatCommunityMessageDate,
  isCommunityBlockedMessage,
  type StudentCommunityGroup,
  type StudentCommunityMessage,
} from './student-community-utils';
import { StudentCommunityContacts } from './student-community-contacts';

const maxMessageLength = 2000;

export function StudentCommunityScreen() {
  const utils = api.useUtils();
  const groupsQuery = api.community.listStudentGroups.useQuery(undefined, { retry: false });
  const groups = groupsQuery.data?.groups ?? [];
  const currentStudentId = groupsQuery.data?.currentStudentId ?? null;
  const blocked = groupsQuery.data?.communityMessagingBlocked ?? false;
  const blockedReason = groupsQuery.data?.communityMessagingBlockedReason ?? null;
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [body, setBody] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [sendStatus, setSendStatus] = useState<string | null>(null);
  const selectedGroup = useMemo(
    () => groups.find((group) => group.id === selectedGroupId) ?? groups[0] ?? null,
    [groups, selectedGroupId],
  );
  const activeGroupId = selectedGroup?.id ?? '';
  const messagesQuery = api.community.listGroupMessages.useQuery(
    { groupId: activeGroupId },
    {
      enabled: Boolean(activeGroupId && selectedGroup?.joined),
      retry: false,
    },
  );
  const joinGroup = api.community.joinGroup.useMutation();
  const sendMessage = api.community.sendMessage.useMutation();
  const messages = messagesQuery.data?.messages ?? [];
  const composerDisabled = blocked || !selectedGroup?.joined || sendMessage.isPending;

  useEffect(() => {
    if (!selectedGroupId && groups[0]) setSelectedGroupId(groups[0].id);
  }, [groups, selectedGroupId]);

  async function refreshCommunity(groupId = activeGroupId) {
    await utils.community.listStudentGroups.invalidate();
    if (groupId) await utils.community.listGroupMessages.invalidate({ groupId });
  }

  async function handleJoinGroup(groupId: string) {
    setFormError(null);
    setSendStatus(null);
    try {
      await joinGroup.mutateAsync({ groupId });
      await refreshCommunity(groupId);
    } catch (error) {
      setFormError(`Join failed: ${messageFromUnknown(error)}`);
    }
  }

  async function handleSendMessage() {
    const trimmedBody = body.trim();
    if (!activeGroupId || !trimmedBody) {
      setFormError('Choose a group and enter a message.');
      setSendStatus(null);
      return;
    }
    if (trimmedBody.length > maxMessageLength) {
      setFormError('Community messages must be 2000 characters or fewer.');
      setSendStatus(null);
      return;
    }

    setFormError(null);
    setSendStatus(null);
    try {
      await sendMessage.mutateAsync({ body: trimmedBody, groupId: activeGroupId });
      setBody('');
      setSendStatus('Sent');
      await refreshCommunity(activeGroupId);
    } catch (error) {
      const message = messageFromUnknown(error);
      setFormError(
        isCommunityBlockedMessage(message)
          ? 'Messaging is disabled for your account right now.'
          : `Send failed: ${message}`,
      );
    }
  }

  if (groupsQuery.isLoading) {
    return (
      <Card style={styles.stateCard}>
        <InlineSpinner label="Loading community" />
      </Card>
    );
  }

  if (groupsQuery.error) {
    return (
      <Card style={styles.stateCard}>
        <SectionTitle>Community unavailable</SectionTitle>
        <ErrorText>{groupsQuery.error.message}</ErrorText>
      </Card>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.stack}
    >
      <Card style={styles.heroCard}>
        <View style={styles.rowBetween}>
          <View style={styles.copy}>
            <Text style={styles.eyebrow}>Student Community</Text>
            <SectionTitle>Community</SectionTitle>
          </View>
          <Badge variant="blue">{String(groups.length)}</Badge>
        </View>
        <MutedText>Text-only groups for Oasis students.</MutedText>
      </Card>

      <Card style={styles.card}>
        <View style={styles.rowBetween}>
          <View style={styles.copy}>
            <Text style={styles.eyebrow}>Groups</Text>
            <SectionTitle>Choose group</SectionTitle>
          </View>
          {groupsQuery.isFetching ? <Badge variant="blue">Refreshing</Badge> : null}
        </View>
        {groups.length === 0 ? <MutedText>Community groups will appear here.</MutedText> : null}
        {groups.map((group) => (
          <CommunityGroupButton
            active={group.id === activeGroupId}
            group={group}
            key={group.id}
            onSelect={(groupId) => {
              setSelectedGroupId(groupId);
              setFormError(null);
              setSendStatus(null);
            }}
          />
        ))}
      </Card>

      <Card style={styles.card}>
        {selectedGroup ? (
          <>
            <View style={styles.rowBetween}>
              <View style={styles.copy}>
                <Text style={styles.eyebrow}>
                  {selectedGroup.isCentral ? 'Central space' : 'Group chat'}
                </Text>
                <SectionTitle>{selectedGroup.title}</SectionTitle>
                <MutedText>
                  {selectedGroup.description ?? communityGroupMeta(selectedGroup)}
                </MutedText>
              </View>
              {!selectedGroup.joined ? (
                <MobileButton
                  compact
                  disabled={joinGroup.isPending}
                  label={joinGroup.isPending ? 'Joining...' : 'Join Group'}
                  onPress={() => {
                    void handleJoinGroup(selectedGroup.id);
                  }}
                  variant="navy"
                />
              ) : null}
            </View>
            <StudentCommunityContacts group={selectedGroup} currentStudentId={currentStudentId} />
          </>
        ) : null}

        {!selectedGroup ? (
          <MutedText>No groups yet.</MutedText>
        ) : !selectedGroup.joined ? (
          <MutedText>Join this group to read and send messages.</MutedText>
        ) : (
          <>
            {messagesQuery.isLoading ? <InlineSpinner label="Loading messages" /> : null}
            {messagesQuery.error ? <ErrorText>{messagesQuery.error.message}</ErrorText> : null}
            <View style={styles.messages}>
              {messages.length === 0 && !messagesQuery.isLoading ? (
                <MutedText>No community messages yet.</MutedText>
              ) : null}
              {messages.map((message) => (
                <CommunityMessageBubble
                  currentStudentId={currentStudentId}
                  key={message.id}
                  message={message}
                />
              ))}
            </View>

            {blocked ? (
              <Card style={styles.blockedCard}>
                <Text style={styles.blockedTitle}>Messaging blocked</Text>
                <MutedText>
                  {blockedReason ?? 'Messaging is disabled for your account right now.'}
                </MutedText>
              </Card>
            ) : null}

            <Field
              label="Community message"
              multiline
              onChangeText={(value) => {
                setBody(value);
                setFormError(null);
                setSendStatus(null);
              }}
              placeholder={blocked ? 'Messaging disabled' : 'Message'}
              value={body}
            />
            <View style={styles.actions}>
              <MobileButton
                compact
                disabled={composerDisabled || body.trim().length === 0}
                label={sendMessage.isPending ? 'Sending...' : 'Send'}
                onPress={() => {
                  void handleSendMessage();
                }}
                variant="navy"
              />
              <MobileButton
                compact
                disabled={groupsQuery.isFetching || messagesQuery.isFetching}
                label="Refresh"
                onPress={() => {
                  void refreshCommunity();
                }}
                variant="secondary"
              />
            </View>
            {sendStatus ? <Badge variant="success">{sendStatus}</Badge> : null}
          </>
        )}

        {formError ? <ErrorText>{formError}</ErrorText> : null}
        {joinGroup.error && !formError ? <ErrorText>{joinGroup.error.message}</ErrorText> : null}
        {sendMessage.error && !formError ? <ErrorText>{sendMessage.error.message}</ErrorText> : null}
      </Card>
    </KeyboardAvoidingView>
  );
}

function CommunityGroupButton({
  active,
  group,
  onSelect,
}: {
  active: boolean;
  group: StudentCommunityGroup;
  onSelect: (groupId: string) => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={() => {
        onSelect(group.id);
      }}
      style={[styles.groupRow, active ? styles.groupRowActive : null]}
    >
      <View style={styles.copy}>
        <Text style={styles.groupTitle}>{group.title}</Text>
        <Text style={styles.groupMeta}>{communityGroupMeta(group)}</Text>
      </View>
      {!group.joined ? <Badge variant="warning">Join</Badge> : null}
    </Pressable>
  );
}

function CommunityMessageBubble({
  currentStudentId,
  message,
}: {
  currentStudentId: string | null;
  message: StudentCommunityMessage;
}) {
  const mine = message.senderStudentId === currentStudentId;
  return (
    <View style={[styles.messageBubble, mine ? styles.messageBubbleMine : null]}>
      <View style={styles.rowBetween}>
        <Text style={styles.messageSender}>{mine ? 'You' : message.sender.fullName}</Text>
        <Text style={styles.messageDate}>{formatCommunityMessageDate(message.createdAt)}</Text>
      </View>
      <Text style={styles.messageBody}>{message.body}</Text>
      {mine ? <Text style={styles.messageStatus}>{communityMessageStatus(message)}</Text> : null}
    </View>
  );
}

function messageFromUnknown(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Community action could not be completed.';
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  blockedCard: {
    backgroundColor: C.warningBg,
    gap: 6,
    padding: 12,
  },
  blockedTitle: {
    color: C.warning,
    fontSize: 12,
    fontWeight: '900',
  },
  card: {
    gap: 12,
    padding: 16,
  },
  copy: {
    flex: 1,
    gap: 3,
  },
  eyebrow: {
    color: C.crimson,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  groupMeta: {
    color: C.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  groupRow: {
    alignItems: 'center',
    borderColor: C.border,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 12,
  },
  groupRowActive: {
    backgroundColor: C.blueLight,
    borderColor: C.blue,
  },
  groupTitle: {
    color: C.navy,
    fontSize: 13,
    fontWeight: '900',
  },
  heroCard: {
    gap: 10,
    padding: 16,
  },
  messageBody: {
    color: C.textPrimary,
    fontSize: 13,
    lineHeight: 19,
  },
  messageBubble: {
    backgroundColor: C.bg,
    borderColor: C.borderLight,
    borderRadius: 10,
    borderWidth: 1,
    gap: 6,
    padding: 12,
  },
  messageBubbleMine: {
    backgroundColor: C.blueLight,
    borderColor: C.blueMid,
  },
  messageDate: {
    color: C.textMuted,
    fontSize: 10,
    fontWeight: '700',
  },
  messageSender: {
    color: C.navy,
    fontSize: 12,
    fontWeight: '900',
  },
  messages: {
    gap: 8,
  },
  messageStatus: {
    color: C.textSecondary,
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'right',
  },
  rowBetween: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  stack: {
    gap: 14,
  },
  stateCard: {
    gap: 10,
    padding: 16,
  },
});
