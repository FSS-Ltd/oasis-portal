import { StyleSheet, Text, View } from 'react-native';
import { C } from '../core/mobile-theme';
import { Badge, Card, MutedText, SectionTitle, MobileButton } from '../core/mobile-ui';
import {
  formatStudentNotificationDate,
  studentNotificationKindLabel,
  type StudentNotification,
} from './student-notifications-utils';

interface StudentNotificationsListProps {
  notifications: readonly StudentNotification[];
  pendingNotificationId: string | null;
  selectedId: string | null;
  onMarkRead: (notificationId: string) => void;
  onSelect: (notification: StudentNotification) => void;
}

export function StudentNotificationsList({
  notifications,
  pendingNotificationId,
  selectedId,
  onMarkRead,
  onSelect,
}: StudentNotificationsListProps) {
  return (
    <Card style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleGroup}>
          <Text style={styles.eyebrow}>Inbox</Text>
          <SectionTitle>Notification centre</SectionTitle>
        </View>
        <Badge variant="blue">{String(notifications.length)}</Badge>
      </View>

      {notifications.length === 0 ? (
        <View style={styles.emptyBlock}>
          <Text style={styles.emptyTitle}>No student updates yet</Text>
          <MutedText>Updates will appear here when they are sent.</MutedText>
        </View>
      ) : (
        notifications.map((notification) => (
          <NotificationRow
            key={notification.id}
            notification={notification}
            onMarkRead={onMarkRead}
            onSelect={onSelect}
            pending={pendingNotificationId === notification.id}
            selected={selectedId === notification.id}
          />
        ))
      )}
    </Card>
  );
}

function NotificationRow({
  notification,
  pending,
  selected,
  onMarkRead,
  onSelect,
}: {
  notification: StudentNotification;
  pending: boolean;
  selected: boolean;
  onMarkRead: (notificationId: string) => void;
  onSelect: (notification: StudentNotification) => void;
}) {
  return (
    <View
      style={[
        styles.notificationRow,
        !notification.read ? styles.notificationRowUnread : null,
        selected ? styles.notificationRowSelected : null,
      ]}
    >
      <View style={styles.notificationCopy}>
        <View style={styles.notificationMetaRow}>
          <Badge variant={notification.read ? 'success' : 'crimson'}>
            {notification.read ? 'Read' : 'Unread'}
          </Badge>
          <Text style={styles.notificationKind}>
            {studentNotificationKindLabel(notification.kind)}
          </Text>
        </View>
        <Text style={styles.notificationTitle}>{notification.title}</Text>
        <Text style={styles.notificationDate}>
          {formatStudentNotificationDate(notification.createdAt)}
        </Text>
      </View>
      <View style={styles.actionColumn}>
        <MobileButton
          compact
          label={selected ? 'Open' : 'View'}
          onPress={() => {
            onSelect(notification);
          }}
          variant={selected ? 'navy' : 'secondary'}
        />
        {!notification.read ? (
          <MobileButton
            compact
            disabled={pending}
            label={pending ? 'Marking...' : 'Mark read'}
            onPress={() => {
              onMarkRead(notification.id);
            }}
            variant="blue"
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  actionColumn: {
    gap: 8,
  },
  emptyBlock: {
    backgroundColor: C.bg,
    borderColor: C.borderLight,
    borderRadius: 10,
    borderWidth: 1,
    gap: 4,
    padding: 12,
  },
  emptyTitle: {
    color: C.navy,
    fontSize: 13,
    fontWeight: '900',
  },
  eyebrow: {
    color: C.crimson,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  notificationCopy: {
    flex: 1,
    gap: 5,
  },
  notificationDate: {
    color: C.textMuted,
    fontSize: 11,
    fontWeight: '800',
  },
  notificationKind: {
    color: C.textSecondary,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  notificationMetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  notificationRow: {
    alignItems: 'center',
    borderColor: C.borderLight,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 12,
  },
  notificationRowSelected: {
    backgroundColor: C.blueLight,
    borderColor: C.blueMid,
  },
  notificationRowUnread: {
    borderLeftColor: C.crimson,
    borderLeftWidth: 3,
  },
  notificationTitle: {
    color: C.navy,
    fontSize: 13,
    fontWeight: '900',
    lineHeight: 18,
  },
  sectionCard: {
    gap: 12,
    padding: 16,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  sectionTitleGroup: {
    flex: 1,
    gap: 3,
  },
});
