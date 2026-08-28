import { Pressable, StyleSheet, Text, View } from 'react-native';
import { C } from '../core/mobile-theme';
import { Card, ErrorText, InlineSpinner, MutedText, SectionTitle } from '../core/mobile-ui';
import type { RouterOutputs } from '../../lib/trpc';

type ParentNotification = RouterOutputs['parentNotification']['list'][number];

interface ParentNotificationsScreenProps {
  error: string | null;
  loading: boolean;
  markReadError: string | null;
  notifications: readonly ParentNotification[] | undefined;
  pendingNotificationId: string | null;
  unreadCount: number;
  onMarkRead: (notificationId: string) => void;
  onOpenInvoice: (invoiceId: string) => void;
}

function formatDate(value: Date | string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

function invoiceIdFromHref(href: string | null): string | null {
  if (!href) return null;
  const match = /[?&]invoiceId=([^&]+)/u.exec(href);
  return match ? decodeURIComponent(match[1] ?? '') : null;
}

export function ParentNotificationsScreen({
  error,
  loading,
  markReadError,
  notifications,
  pendingNotificationId,
  unreadCount,
  onMarkRead,
  onOpenInvoice,
}: ParentNotificationsScreenProps) {
  const rows = notifications ?? [];

  if (loading && rows.length === 0) {
    return (
      <Card style={styles.stateCard}>
        <InlineSpinner label="Loading notifications" />
      </Card>
    );
  }

  return (
    <View style={styles.stack}>
      {error ? (
        <Card style={styles.errorCard}>
          <SectionTitle>Notifications unavailable</SectionTitle>
          <ErrorText>{error}</ErrorText>
        </Card>
      ) : null}

      {markReadError ? <ErrorText>{markReadError}</ErrorText> : null}

      <Card style={styles.heroCard}>
        <Text style={styles.eyebrow}>Notifications</Text>
        <SectionTitle>Latest updates</SectionTitle>
        <MutedText>Invoices and parent portal updates.</MutedText>
        <View style={styles.heroStats}>
          <HeroStat label="Unread" value={String(unreadCount)} />
          <HeroStat label="Total" value={String(rows.length)} />
        </View>
      </Card>

      {rows.length === 0 ? (
        <Card style={styles.stateCard}>
          <SectionTitle>No notifications yet</SectionTitle>
          <MutedText>Invoice updates will appear here when they are issued.</MutedText>
        </Card>
      ) : (
        rows.map((notification) => {
          const invoiceId = invoiceIdFromHref(notification.href);
          return (
            <Card
              key={notification.id}
              style={[styles.notificationCard, !notification.read ? styles.unreadCard : null]}
            >
              <View style={styles.notificationHead}>
                <Text style={styles.kind}>Invoice</Text>
                <Text style={styles.date}>{formatDate(notification.createdAt)}</Text>
              </View>
              <SectionTitle>{notification.title}</SectionTitle>
              <MutedText>{notification.body}</MutedText>
              <View style={styles.actions}>
                {invoiceId ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      if (!notification.read) onMarkRead(notification.id);
                      onOpenInvoice(invoiceId);
                    }}
                    style={styles.actionButton}
                  >
                    <Text style={styles.actionButtonText}>Open invoice</Text>
                  </Pressable>
                ) : null}
                {!notification.read ? (
                  <Pressable
                    accessibilityRole="button"
                    disabled={pendingNotificationId === notification.id}
                    onPress={() => {
                      onMarkRead(notification.id);
                    }}
                    style={styles.secondaryButton}
                  >
                    <Text style={styles.secondaryButtonText}>
                      {pendingNotificationId === notification.id ? 'Marking...' : 'Mark read'}
                    </Text>
                  </Pressable>
                ) : (
                  <Text style={styles.readLabel}>Read</Text>
                )}
              </View>
            </Card>
          );
        })
      )}
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
  actionButton: {
    backgroundColor: C.crimson,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
  actions: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  date: {
    color: C.textSecondary,
    fontSize: 11,
    fontWeight: '800',
  },
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
    borderRadius: 8,
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
  kind: {
    color: C.crimson,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  notificationCard: {
    gap: 10,
    padding: 16,
  },
  notificationHead: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  readLabel: {
    color: C.textSecondary,
    fontSize: 12,
    fontWeight: '900',
  },
  secondaryButton: {
    borderColor: C.border,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  secondaryButtonText: {
    color: C.navy,
    fontSize: 12,
    fontWeight: '900',
  },
  stack: {
    gap: 14,
  },
  stateCard: {
    gap: 10,
    padding: 16,
  },
  unreadCard: {
    borderColor: C.crimson,
  },
});
