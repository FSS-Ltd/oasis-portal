import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { api, type RouterOutputs } from '../../lib/trpc';
import { C } from './mobile-theme';
import { Badge, Card, ErrorText, MutedText, SectionTitle, SmokeButton } from './smoke-ui';

type Notice = RouterOutputs['notice']['listForParents'][number];

function formatDateTime(value: Date | string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
  }).format(new Date(value));
}

export function ParentNoticesPanel({ notices }: { notices: Notice[] }) {
  const utils = api.useUtils();
  const [pendingNoticeId, setPendingNoticeId] = useState<string | null>(null);
  const markRead = api.notice.markRead.useMutation({
    onSettled: () => {
      setPendingNoticeId(null);
    },
    onSuccess: async () => {
      await utils.notice.listForParents.invalidate();
    },
  });

  return (
    <Card>
      <SectionTitle>Parent notices</SectionTitle>
      {notices.length === 0 ? <MutedText>No parent notices returned.</MutedText> : null}
      {notices.map((notice) => (
        <View key={notice.id} style={styles.noticeCard}>
          <View style={styles.rowTitleLine}>
            <Badge variant={notice.read ? 'success' : 'blue'}>
              {notice.read ? 'Read' : 'Unread'}
            </Badge>
            <MutedText>{formatDateTime(notice.createdAt)}</MutedText>
          </View>
          <Text style={styles.rowTitle}>{notice.title}</Text>
          <MutedText>{notice.body}</MutedText>
          {!notice.read ? (
            <SmokeButton
              compact
              disabled={pendingNoticeId === notice.id && markRead.isPending}
              label={
                pendingNoticeId === notice.id && markRead.isPending ? 'Marking...' : 'Mark read'
              }
              onPress={() => {
                setPendingNoticeId(notice.id);
                markRead.mutate({ noticeId: notice.id });
              }}
              variant="blue"
            />
          ) : null}
        </View>
      ))}
      {markRead.error ? <ErrorText>{markRead.error.message}</ErrorText> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  noticeCard: {
    borderBottomColor: C.borderLight,
    borderBottomWidth: 1,
    gap: 9,
    paddingBottom: 12,
  },
  rowTitle: {
    color: C.navy,
    fontSize: 13,
    fontWeight: '800',
  },
  rowTitleLine: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
  },
});
