import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { api, type RouterOutputs } from '../../lib/trpc';
import { C } from './mobile-theme';
import { Badge, Card, ErrorText, MutedText, SmokeButton } from './smoke-ui';

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
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Notices</Text>
        <Text style={styles.subtitle}>Updates from the centre team.</Text>
      </View>

      {notices.length === 0 ? (
        <Card style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No notices</Text>
          <MutedText>Parent notices from Oasis will appear here.</MutedText>
        </Card>
      ) : null}

      {notices.map((notice) => (
        <Card
          key={notice.id}
          style={[styles.noticeCard, !notice.read ? styles.noticeCardUnread : null]}
        >
          <View style={styles.noticeMetaRow}>
            <Badge variant={notice.read ? 'success' : 'blue'}>
              {notice.read ? 'Read' : 'Unread'}
            </Badge>
            <Text style={styles.noticeDate}>{formatDateTime(notice.createdAt)}</Text>
          </View>
          <Text style={styles.noticeTitle}>{notice.title}</Text>
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
        </Card>
      ))}
      {markRead.error ? <ErrorText>{markRead.error.message}</ErrorText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  emptyCard: {
    alignItems: 'center',
    gap: 8,
    padding: 22,
  },
  emptyTitle: {
    color: C.navy,
    fontSize: 17,
    fontWeight: '800',
  },
  header: {
    gap: 3,
  },
  noticeCard: {
    gap: 10,
    padding: 16,
  },
  noticeCardUnread: {
    borderLeftColor: C.crimson,
    borderLeftWidth: 3,
  },
  noticeDate: {
    color: C.textMuted,
    fontSize: 11,
    fontWeight: '800',
  },
  noticeMetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  noticeTitle: {
    color: C.navy,
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 20,
  },
  screen: {
    gap: 12,
  },
  subtitle: {
    color: C.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  title: {
    color: C.navy,
    fontSize: 22,
    fontWeight: '800',
  },
});
