import { Pressable, StyleSheet, Text, View } from 'react-native';
import { type RouterOutputs } from '../../lib/trpc';
import { C } from '../smoke/mobile-theme';
import { Badge, Card, MutedText } from '../smoke/smoke-ui';
import {
  incidentStatusLabel,
  incidentTypeLabels,
  reportabilitySummary,
  type IncidentFormState,
} from './staff-incident-utils';

type StaffIncident = RouterOutputs['incident']['listStaff'][number];

export function StaffIncidentReviewPanel({
  draft,
  form,
  loading,
  onSubmitForReview,
  submitting,
}: {
  draft: StaffIncident | null;
  form: IncidentFormState;
  loading: boolean;
  onSubmitForReview: (reportId: string) => void;
  submitting: boolean;
}) {
  return (
    <Card style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.rowBody}>
          <Text style={styles.cardTitle}>Ready for Head review</Text>
          <MutedText>Save a draft, then submit it for the existing Head workflow.</MutedText>
        </View>
        <Badge variant="blue">{draft ? incidentStatusLabel(draft.status) : 'Draft'}</Badge>
      </View>

      <View style={styles.summaryBox}>
        <Text style={styles.summaryTitle}>{incidentTypeLabels[form.type]}</Text>
        <Text style={styles.summaryText}>{reportabilitySummary(form)}</Text>
      </View>

      {loading ? <MutedText>Loading recent incident drafts...</MutedText> : null}
      {draft ? (
        <View style={styles.draftCard}>
          <Text style={styles.draftNumber}>{draft.reportNumber}</Text>
          <Text style={styles.draftMeta}>
            {draft.students.map((student) => student.fullName).join(', ') || 'No students linked'}
          </Text>
          <Text style={styles.draftMeta}>{incidentStatusLabel(draft.status)}</Text>
        </View>
      ) : (
        <MutedText>No saved mobile draft yet.</MutedText>
      )}

      <Pressable
        accessibilityRole="button"
        disabled={!draft || draft.status !== 'Draft' || submitting}
        onPress={() => {
          if (draft) onSubmitForReview(draft.id);
        }}
        style={[
          styles.submitButton,
          !draft || draft.status !== 'Draft' || submitting ? styles.submitButtonDisabled : null,
        ]}
      >
        <Text style={styles.submitButtonText}>
          {submitting ? 'Submitting...' : 'Submit for Head review'}
        </Text>
      </Pressable>
    </Card>
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
  draftCard: {
    backgroundColor: C.bg,
    borderColor: C.border,
    borderRadius: 10,
    borderWidth: 1,
    gap: 3,
    padding: 10,
  },
  draftMeta: {
    color: C.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  draftNumber: {
    color: C.navy,
    fontSize: 14,
    fontWeight: '900',
  },
  headerRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  rowBody: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  submitButton: {
    alignItems: 'center',
    backgroundColor: C.crimson,
    borderColor: C.crimson,
    borderRadius: 8,
    borderWidth: 1.5,
    justifyContent: 'center',
    minHeight: 42,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  submitButtonDisabled: {
    opacity: 0.45,
  },
  submitButtonText: {
    color: C.surface,
    fontSize: 13,
    fontWeight: '900',
  },
  summaryBox: {
    backgroundColor: C.crimsonLight,
    borderColor: C.crimsonLight,
    borderRadius: 10,
    borderWidth: 1,
    gap: 3,
    padding: 10,
  },
  summaryText: {
    color: C.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
  summaryTitle: {
    color: C.crimson,
    fontSize: 13,
    fontWeight: '900',
  },
});
