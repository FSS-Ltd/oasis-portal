import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { api, type RouterOutputs } from '../../lib/trpc';
import { C } from '../core/mobile-theme';
import { Badge, Card, ErrorText, MutedText, MobileButton } from '../core/mobile-ui';

export type StaffNotice = RouterOutputs['notice']['listForStaff'][number];

function formatDateTime(value: Date | string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(value));
}

export function StaffNoticesPanel({ notices }: { notices: StaffNotice[] }) {
  const utils = api.useUtils();
  const [pendingNoticeId, setPendingNoticeId] = useState<string | null>(null);
  const markRead = api.notice.markRead.useMutation({
    onSettled: () => {
      setPendingNoticeId(null);
    },
    onSuccess: async () => {
      await Promise.all([
        utils.notice.listForStaff.invalidate(),
        utils.staffHome.summary.invalidate(),
      ]);
    },
  });

  if (notices.length === 0) {
    return (
      <Card style={styles.emptyCard}>
        <Text style={styles.emptyTitle}>No staff notices</Text>
        <MutedText>Current staff noticeboard updates will appear here.</MutedText>
      </Card>
    );
  }

  return (
    <View style={styles.noticeList}>
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
            <MobileButton
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
  noticeList: {
    gap: 12,
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
});
