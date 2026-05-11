import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { C } from './mobile-theme';
import type { Recipient } from './parent-message-types';
import { ErrorText, MutedText } from './smoke-ui';

interface NewThreadViewProps {
  activeRecipientId: string;
  body: string;
  formError: string | null;
  onBack: () => void;
  onSend: () => void;
  openThreadError: string | undefined;
  pending: boolean;
  recipients: Recipient[];
  sendError: string | undefined;
  setBody: (value: string) => void;
  setRecipientId: (value: string) => void;
  setSubject: (value: string) => void;
  subject: string;
}

export function NewThreadView({
  activeRecipientId,
  body,
  formError,
  onBack,
  onSend,
  openThreadError,
  pending,
  recipients,
  sendError,
  setBody,
  setRecipientId,
  setSubject,
  subject,
}: NewThreadViewProps) {
  const canSend = Boolean(activeRecipientId && subject.trim() && body.trim() && !pending);

  return (
    <View style={styles.screen}>
      <View style={styles.newThreadHeader}>
        <Pressable
          accessibilityLabel="Cancel new message"
          accessibilityRole="button"
          onPress={onBack}
          style={styles.backButton}
        >
          <Text style={styles.backButtonText}>Cancel</Text>
        </Pressable>
        <Text style={styles.newThreadTitle}>New Message</Text>
        <Pressable
          accessibilityRole="button"
          disabled={!canSend}
          onPress={onSend}
          style={[styles.headerSendButton, canSend ? null : styles.sendButtonDisabled]}
        >
          <Text style={styles.headerSendButtonText}>{pending ? 'Sending' : 'Send'}</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.newThreadContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.formSection}>
          <Text style={styles.fieldLabel}>To</Text>
          {recipients.length === 0 ? (
            <MutedText>No message recipients are currently available.</MutedText>
          ) : (
            <View style={styles.recipientList}>
              {recipients.map((recipient) => {
                const active = activeRecipientId === recipient.id;
                return (
                  <Pressable
                    accessibilityRole="button"
                    key={recipient.id}
                    onPress={() => {
                      setRecipientId(recipient.id);
                    }}
                    style={[styles.recipientRow, active ? styles.recipientRowActive : null]}
                  >
                    <View style={styles.recipientAvatar}>
                      <Text style={styles.recipientAvatarText}>
                        {recipient.fullName.slice(0, 1)}
                      </Text>
                    </View>
                    <View style={styles.recipientText}>
                      <Text style={styles.recipientName}>{recipient.fullName}</Text>
                      <Text style={styles.recipientRole}>{recipient.role}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        <View style={styles.formSection}>
          <Text style={styles.fieldLabel}>Subject</Text>
          <TextInput
            accessibilityLabel="Message subject"
            maxLength={160}
            onChangeText={setSubject}
            placeholder="What is this about?"
            placeholderTextColor={C.textMuted}
            style={styles.subjectInput}
            value={subject}
          />
        </View>

        <View style={styles.formSection}>
          <Text style={styles.fieldLabel}>Message</Text>
          <TextInput
            accessibilityLabel="Message body"
            maxLength={4000}
            multiline
            onChangeText={setBody}
            placeholder="Write your message..."
            placeholderTextColor={C.textMuted}
            style={styles.bodyInput}
            textAlignVertical="top"
            value={body}
          />
        </View>

        {formError ? <ErrorText>{formError}</ErrorText> : null}
        {openThreadError ? <ErrorText>{openThreadError}</ErrorText> : null}
        {sendError ? <ErrorText>{sendError}</ErrorText> : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  backButton: {
    justifyContent: 'center',
    minHeight: 36,
    paddingRight: 8,
  },
  backButtonText: {
    color: C.blue,
    fontSize: 14,
    fontWeight: '700',
  },
  bodyInput: {
    backgroundColor: C.surface,
    borderColor: C.border,
    borderRadius: 14,
    borderWidth: 1,
    color: C.textPrimary,
    fontSize: 15,
    lineHeight: 21,
    minHeight: 150,
    padding: 14,
  },
  fieldLabel: {
    color: C.textSecondary,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  formSection: {
    gap: 8,
  },
  headerSendButton: {
    justifyContent: 'center',
    minHeight: 36,
  },
  headerSendButtonText: {
    color: C.blue,
    fontSize: 14,
    fontWeight: '800',
  },
  newThreadContent: {
    gap: 18,
    paddingBottom: 24,
    paddingTop: 8,
  },
  newThreadHeader: {
    alignItems: 'center',
    borderBottomColor: C.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 12,
  },
  newThreadTitle: {
    color: C.navy,
    fontSize: 16,
    fontWeight: '800',
  },
  recipientAvatar: {
    alignItems: 'center',
    backgroundColor: C.navy,
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  recipientAvatarText: {
    color: C.surface,
    fontSize: 14,
    fontWeight: '800',
  },
  recipientList: {
    gap: 8,
  },
  recipientName: {
    color: C.navy,
    fontSize: 14,
    fontWeight: '800',
  },
  recipientRole: {
    color: C.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  recipientRow: {
    alignItems: 'center',
    backgroundColor: C.surface,
    borderColor: C.border,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 12,
  },
  recipientRowActive: {
    backgroundColor: C.blueLight,
    borderColor: C.blueMid,
  },
  recipientText: {
    flex: 1,
    minWidth: 0,
  },
  screen: {
    flex: 1,
    gap: 12,
  },
  sendButtonDisabled: {
    opacity: 0.45,
  },
  subjectInput: {
    backgroundColor: C.surface,
    borderColor: C.border,
    borderRadius: 14,
    borderWidth: 1,
    color: C.textPrimary,
    fontSize: 15,
    minHeight: 46,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
});
