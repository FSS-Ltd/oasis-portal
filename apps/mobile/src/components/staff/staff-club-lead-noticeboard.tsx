import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { C } from '../smoke/mobile-theme';
import { Badge, Card, Field, MutedText, SmokeButton } from '../smoke/smoke-ui';
import {
  formatClubDateTime,
  validateNoticeDraft,
  type StaffClubNotification,
  type StaffClubNoticeDraft,
} from './staff-club-lead-utils';

export function StaffClubLeadNoticeboard({
  error,
  loading,
  notifications,
  onSubmit,
  posting,
}: {
  error: string | null;
  loading: boolean;
  notifications: StaffClubNotification[];
  onSubmit: (draft: StaffClubNoticeDraft) => Promise<boolean>;
  posting: boolean;
}) {
  const [draft, setDraft] = useState<StaffClubNoticeDraft>({ body: '', title: '' });
  const [validation, setValidation] = useState<string | null>(null);

  async function submit() {
    const nextValidation = validateNoticeDraft(draft);
    setValidation(nextValidation);
    if (nextValidation) return;
    const posted = await onSubmit(draft);
    if (posted) {
      setDraft({ body: '', title: '' });
    }
  }

  return (
    <View style={styles.stack}>
      <Card style={styles.card}>
        <Text style={styles.cardTitle}>Post club notice</Text>
        <Field
          label="Title"
          onChangeText={(title) => {
            setDraft((current) => ({ ...current, title }));
          }}
          placeholder="Session reminder"
          value={draft.title}
        />
        <Field
          label="Body"
          multiline
          onChangeText={(body) => {
            setDraft((current) => ({ ...current, body }));
          }}
          placeholder="Write the update for students and guardians"
          value={draft.body}
        />
        {validation ? <Text style={styles.validationText}>{validation}</Text> : null}
        <SmokeButton
          disabled={posting}
          label={posting ? 'Posting notice...' : 'Post notice'}
          onPress={() => {
            void submit();
          }}
          variant="navy"
        />
      </Card>

      <Card style={styles.card}>
        <View style={styles.headerRow}>
          <Text style={styles.cardTitle}>Notice history</Text>
          <Badge variant="blue">{String(notifications.length)}</Badge>
        </View>
        {loading ? <MutedText>Loading club notices...</MutedText> : null}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {!loading && !error && notifications.length === 0 ? (
          <MutedText>No notices have been posted for this club.</MutedText>
        ) : null}
        {notifications.slice(0, 8).map((notification) => (
          <View key={notification.id} style={styles.noticeRow}>
            <Text style={styles.noticeTitle}>{notification.title}</Text>
            <MutedText>
              {formatClubDateTime(notification.sentAt)} by {notification.sentByName}
            </MutedText>
          </View>
        ))}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 12,
    padding: 16,
  },
  cardTitle: {
    color: C.navy,
    fontSize: 14,
    fontWeight: '900',
  },
  errorText: {
    color: C.danger,
    fontSize: 12,
    fontWeight: '700',
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  noticeRow: {
    borderTopColor: C.borderLight,
    borderTopWidth: 1,
    gap: 3,
    paddingTop: 10,
  },
  noticeTitle: {
    color: C.navy,
    fontSize: 13,
    fontWeight: '900',
  },
  stack: {
    gap: 10,
  },
  validationText: {
    color: C.danger,
    fontSize: 12,
    fontWeight: '700',
  },
});
