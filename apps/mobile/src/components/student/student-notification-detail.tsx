import { StyleSheet, Text, View } from 'react-native';
import { C } from '../core/mobile-theme';
import { Badge, Card, MutedText, SectionTitle, MobileButton } from '../core/mobile-ui';
import {
  formatStudentNotificationDate,
  studentNotificationKindLabel,
  type StudentNotification,
} from './student-notifications-utils';

interface StudentNotificationDetailProps {
  notification: StudentNotification | null;
  pending: boolean;
  onMarkRead: (notificationId: string) => void;
}

export function StudentNotificationDetail({
  notification,
  pending,
  onMarkRead,
}: StudentNotificationDetailProps) {
  if (!notification) {
    return (
      <Card style={styles.detailCard}>
        <SectionTitle>Update detail</SectionTitle>
        <MutedText>Select an update to inspect the full message.</MutedText>
      </Card>
    );
  }

  return (
    <Card style={styles.detailCard}>
      <View style={styles.detailHeader}>
        <View style={styles.detailTitleGroup}>
          <Text style={styles.eyebrow}>Update detail</Text>
          <SectionTitle>{notification.title}</SectionTitle>
        </View>
        <Badge variant={notification.read ? 'success' : 'crimson'}>
          {notification.read ? 'Read' : 'Unread'}
        </Badge>
      </View>

      <View style={styles.metaGrid}>
        <DetailMeta label="Type" value={studentNotificationKindLabel(notification.kind)} />
        <DetailMeta label="Sent" value={formatStudentNotificationDate(notification.createdAt)} />
      </View>

      <Text style={styles.body}>{notification.body}</Text>

      {!notification.read ? (
        <MobileButton
          disabled={pending}
          label={pending ? 'Marking...' : 'Mark read'}
          onPress={() => {
            onMarkRead(notification.id);
          }}
          variant="blue"
        />
      ) : null}
    </Card>
  );
}

function DetailMeta({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaCard}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    color: C.textPrimary,
    fontSize: 13,
    lineHeight: 19,
  },
  detailCard: {
    gap: 14,
    padding: 16,
  },
  detailHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  detailTitleGroup: {
    flex: 1,
    gap: 3,
  },
  eyebrow: {
    color: C.crimson,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  metaCard: {
    backgroundColor: C.blueLight,
    borderColor: C.borderLight,
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    gap: 3,
    minWidth: 116,
    padding: 10,
  },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metaLabel: {
    color: C.textSecondary,
    fontSize: 11,
    fontWeight: '800',
  },
  metaValue: {
    color: C.navy,
    fontSize: 13,
    fontWeight: '900',
  },
});
