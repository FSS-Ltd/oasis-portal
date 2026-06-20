import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useClerk } from '@clerk/clerk-expo';
import { api, type RouterOutputs } from '../../lib/trpc';
import { C } from '../core/mobile-theme';
import { PortalMobileHeader } from '../core/portal-mobile-shell';
import { StaffIncidentFormCard } from './staff-incident-form';
import { StaffIncidentReviewPanel } from './staff-incident-review-panel';
import { StaffIncidentStudentPicker } from './staff-incident-student-picker';
import {
  dateFromKey,
  formatIncidentDate,
  hasIncidentFormErrors,
  incidentDateTime,
  newIncidentForm,
  validateIncidentForm,
  type IncidentFormState,
} from './staff-incident-utils';

type SessionUser = NonNullable<RouterOutputs['health']['me']['user']>;
type StaffIncident = RouterOutputs['incident']['listStaff'][number];

function latestOwnDraft(
  reports: StaffIncident[],
  user: SessionUser | undefined,
): StaffIncident | null {
  if (!user) return null;
  return (
    reports.find((report) => report.status === 'Draft' && report.recordedById === user.id) ?? null
  );
}

function draftInput(form: IncidentFormState) {
  const immediateActions = form.evidenceNotes.trim()
    ? `${form.immediateActions.trim()}\n\nEvidence notes: ${form.evidenceNotes.trim()}`
    : form.immediateActions.trim();

  return {
    activity: form.activity.trim() || undefined,
    confidentiality: form.confidentiality,
    directDisclosure: form.directDisclosure.trim() || undefined,
    dslNotified: form.dslNotified,
    emergencyServicesContacted: form.emergencyServicesContacted,
    factualAccount: form.factualAccount.trim(),
    firstAidGiven: form.firstAidGiven,
    headSignOffRequired: true,
    hospitalTreatment: form.hospitalTreatment,
    immediateActions,
    injurySustained: form.injurySustained,
    location: form.location.trim(),
    occurredAt: incidentDateTime(form),
    offSite: form.type === 'OffSiteTrip',
    parentCarerNotified: form.parentCarerNotified,
    parentVisibilityRequested: form.parentVisibilityRequested,
    pastorPrincipalEscalation: false,
    riddorCheck:
      form.hospitalTreatment || form.emergencyServicesContacted || form.severity === 'Critical',
    severity: form.severity,
    socialCarePoliceReferral: form.type === 'SafeguardingConcern' && form.dslNotified,
    staffIds: [],
    studentIds: form.selectedStudentIds,
    type: form.type,
    witnesses: form.witnesses.trim() || undefined,
    witnessStaffIds: [],
  };
}

export function StaffIncidentScreen({
  onBack,
  user,
}: {
  onBack: () => void;
  user: SessionUser | undefined;
}) {
  const { signOut } = useClerk();
  const utils = api.useUtils();
  const [form, setForm] = useState<IncidentFormState>(() => newIncidentForm());
  const [submitted, setSubmitted] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [savedDraftId, setSavedDraftId] = useState<string | null>(null);
  const roster = api.attendance.forDate.useQuery(
    { date: dateFromKey(form.occurredDate) },
    { retry: false },
  );
  const incidents = api.incident.listStaff.useQuery(undefined, { retry: false });
  const staffOptions = api.incident.listStaffOptions.useQuery(undefined, { retry: false });
  const reports = incidents.data ?? [];
  const savedDraft =
    (savedDraftId ? reports.find((report) => report.id === savedDraftId) : null) ??
    latestOwnDraft(reports, user);
  const errors = useMemo(() => validateIncidentForm(form), [form]);

  const createDraft = api.incident.createDraft.useMutation({
    onError: (error) => {
      setStatusMessage(error.message);
    },
    onSuccess: async (draft) => {
      setSavedDraftId(draft.id);
      setSubmitted(false);
      setStatusMessage(`Incident draft saved: ${draft.reportNumber}`);
      await Promise.all([
        utils.incident.listStaff.invalidate(),
        utils.staffHome.summary.invalidate(),
      ]);
    },
  });

  const submitForHeadReview = api.incident.submitForHeadReview.useMutation({
    onError: (error) => {
      setStatusMessage(error.message);
    },
    onSuccess: async (draft) => {
      setSavedDraftId(draft.id);
      setStatusMessage('Incident submitted for Head review.');
      await Promise.all([
        utils.incident.listStaff.invalidate(),
        utils.staffHome.summary.invalidate(),
      ]);
    },
  });

  async function refresh() {
    await Promise.all([roster.refetch(), incidents.refetch(), staffOptions.refetch()]);
  }

  function toggleStudent(studentId: string) {
    setForm((current) => ({
      ...current,
      selectedStudentIds: current.selectedStudentIds.includes(studentId)
        ? current.selectedStudentIds.filter((id) => id !== studentId)
        : [...current.selectedStudentIds, studentId],
    }));
  }

  function saveDraft() {
    setSubmitted(true);
    setStatusMessage(null);
    if (hasIncidentFormErrors(errors)) return;
    createDraft.mutate(draftInput(form));
  }

  function submitDraft(reportId: string) {
    setStatusMessage(null);
    submitForHeadReview.mutate({ reportId });
  }

  return (
    <SafeAreaView style={styles.shell}>
      <PortalMobileHeader
        actionAccessibilityLabel="Sign out of staff account"
        actionLabel="Out"
        avatarLabel="S"
        eyebrow="Staff Portal"
        onActionPress={() => {
          void signOut();
        }}
        subtitle={`${user?.role ?? 'Staff'} · Incidents`}
        title="Oasis Learning Centre"
        variant="dark"
      />
      <View style={styles.content}>
        <View style={styles.topRow}>
          <Pressable
            accessibilityLabel="Back to staff home"
            accessibilityRole="button"
            onPress={onBack}
            style={styles.backButton}
          >
            <Text style={styles.backButtonText}>Back</Text>
          </Pressable>
          <View style={styles.titleGroup}>
            <Text style={styles.eyebrow}>Incident reporting</Text>
            <Text style={styles.title}>Draft and submit safeguarding records</Text>
          </View>
        </View>

        <View style={styles.dateCard}>
          <Text style={styles.dateLabel}>{formatIncidentDate(form.occurredDate)}</Text>
          <Text style={styles.dateMeta}>
            Review, sign-off, escalation, and parent release stay in the web Head workflow.
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              onRefresh={() => {
                void refresh();
              }}
              refreshing={
                roster.isFetching ||
                incidents.isFetching ||
                staffOptions.isFetching ||
                createDraft.isPending ||
                submitForHeadReview.isPending
              }
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {statusMessage ? (
            <View
              style={[
                styles.statusMessage,
                createDraft.error || submitForHeadReview.error
                  ? styles.errorMessage
                  : styles.successMessage,
              ]}
            >
              <Text
                style={[
                  styles.statusMessageText,
                  createDraft.error || submitForHeadReview.error
                    ? styles.errorMessageText
                    : styles.successMessageText,
                ]}
              >
                {statusMessage}
              </Text>
            </View>
          ) : null}

          <StaffIncidentStudentPicker
            error={roster.error?.message ?? null}
            loading={roster.isLoading}
            onToggle={toggleStudent}
            rows={roster.data ?? []}
            selectedStudentIds={form.selectedStudentIds}
          />
          {submitted && errors.selectedStudentIds ? (
            <Text style={styles.validationText}>{errors.selectedStudentIds}</Text>
          ) : null}

          <StaffIncidentFormCard
            errors={errors}
            form={form}
            onChange={setForm}
            onSaveDraft={saveDraft}
            saving={createDraft.isPending}
            submitted={submitted}
          />

          <StaffIncidentReviewPanel
            draft={savedDraft}
            form={form}
            loading={incidents.isLoading}
            onSubmitForReview={submitDraft}
            submitting={submitForHeadReview.isPending}
          />
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  backButton: {
    alignItems: 'center',
    borderColor: C.border,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: 12,
  },
  backButtonText: {
    color: C.blue,
    fontSize: 13,
    fontWeight: '800',
  },
  content: {
    flex: 1,
    gap: 14,
    padding: 16,
  },
  dateCard: {
    backgroundColor: C.surface,
    borderColor: C.border,
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
    padding: 12,
  },
  dateLabel: {
    color: C.navy,
    fontSize: 15,
    fontWeight: '900',
  },
  dateMeta: {
    color: C.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
  errorMessage: {
    backgroundColor: C.dangerBg,
    borderColor: C.dangerMid,
  },
  errorMessageText: {
    color: C.danger,
  },
  eyebrow: {
    color: C.textMuted,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  scrollContent: {
    gap: 12,
    paddingBottom: 28,
  },
  shell: {
    backgroundColor: C.bg,
    flex: 1,
  },
  statusMessage: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
  },
  statusMessageText: {
    fontSize: 12,
    fontWeight: '800',
  },
  successMessage: {
    backgroundColor: C.successBg,
    borderColor: C.successMid,
  },
  successMessageText: {
    color: C.success,
  },
  title: {
    color: C.navy,
    fontSize: 20,
    fontWeight: '900',
    lineHeight: 24,
  },
  titleGroup: {
    flex: 1,
    gap: 2,
  },
  topRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  validationText: {
    color: C.danger,
    fontSize: 12,
    fontWeight: '700',
  },
});
