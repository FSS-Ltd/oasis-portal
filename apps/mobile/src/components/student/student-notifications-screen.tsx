import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { C } from '../smoke/mobile-theme';
import { Card, ErrorText, InlineSpinner, MutedText, SectionTitle } from '../smoke/smoke-ui';
import { StudentNotificationDetail } from './student-notification-detail';
import { StudentNotificationsList } from './student-notifications-list';
import {
  studentNotificationAccessBlockedCopy,
  type StudentNotification,
} from './student-notifications-utils';

interface StudentNotificationsScreenProps {
  error: string | null;
  loading: boolean;
  markReadError: string | null;
  notifications: readonly StudentNotification[] | undefined;
  pendingNotificationId: string | null;
  refreshFailed: boolean;
  unreadCount: number;
  onMarkRead: (notificationId: string) => void;
}

export function StudentNotificationsScreen({
  error,
  loading,
  markReadError,
  notifications,
  pendingNotificationId,
  refreshFailed,
  unreadCount,
  onMarkRead,
}: StudentNotificationsScreenProps) {
  const notificationRows = useMemo(() => notifications ?? [], [notifications]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const preferredId = notificationRows[0]?.id ?? null;
    setSelectedId((current) => {
      if (current && notificationRows.some((notification) => notification.id === current)) {
        return current;
      }
      return preferredId;
    });
  }, [notificationRows]);

  const selectedNotification =
    notificationRows.find((notification) => notification.id === selectedId) ?? null;

  if (loading && notificationRows.length === 0) {
    return (
      <Card style={styles.stateCard}>
        <InlineSpinner label="Loading updates" />
      </Card>
    );
  }

  if (error && notificationRows.length === 0) {
    return (
      <Card style={styles.stateCard}>
        <SectionTitle>Updates unavailable</SectionTitle>
        <MutedText>This account cannot open updates right now.</MutedText>
        <MutedText>{studentNotificationAccessBlockedCopy.join(' · ')}</MutedText>
        <ErrorText>{error}</ErrorText>
      </Card>
    );
  }

  return (
    <View style={styles.stack}>
      {loading ? (
        <Card style={styles.stateCard}>
          <InlineSpinner label="Loading updates" />
        </Card>
      ) : null}

      {error ? (
        <Card style={styles.errorCard}>
          <SectionTitle>Updates unavailable</SectionTitle>
          <ErrorText>{error}</ErrorText>
        </Card>
      ) : null}

      {refreshFailed ? (
        <Card style={styles.errorCard}>
          <SectionTitle>Refresh failed</SectionTitle>
          <ErrorText>Refresh failed. Pull down to try again.</ErrorText>
        </Card>
      ) : null}

      {markReadError ? <ErrorText>{markReadError}</ErrorText> : null}

      <Card style={styles.heroCard}>
        <Text style={styles.eyebrow}>Updates</Text>
        <SectionTitle>Latest updates</SectionTitle>
        <MutedText>
          Merits, shop confirmations, club notices, and Learning Centre announcements.
        </MutedText>
        <View style={styles.heroStats}>
          <HeroStat label="Unread" value={String(unreadCount)} />
          <HeroStat label="Total updates" value={String(notificationRows.length)} />
        </View>
      </Card>

      <StudentNotificationsList
        notifications={notificationRows}
        onMarkRead={onMarkRead}
        onSelect={(notification) => {
          setSelectedId(notification.id);
        }}
        pendingNotificationId={pendingNotificationId}
        selectedId={selectedId}
      />

      <StudentNotificationDetail
        notification={selectedNotification}
        onMarkRead={onMarkRead}
        pending={pendingNotificationId === selectedNotification?.id}
      />
    </View>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.heroStat}>
      <Text style={styles.heroStatValue}>{value}</Text>
      <Text style={styles.heroStatLabel}>{label}</Text>
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
    gap: 14,
    padding: 16,
  },
  heroStat: {
    backgroundColor: C.blueLight,
    borderColor: C.borderLight,
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    gap: 3,
    minWidth: 116,
    padding: 10,
  },
  heroStatLabel: {
    color: C.textSecondary,
    fontSize: 11,
    fontWeight: '800',
  },
  heroStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  heroStatValue: {
    color: C.navy,
    fontSize: 16,
    fontWeight: '900',
  },
  stack: {
    gap: 14,
  },
  stateCard: {
    gap: 10,
    padding: 16,
  },
});
