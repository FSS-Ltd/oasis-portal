import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { api } from '../../lib/trpc';
import { C } from '../core/mobile-theme';
import {
  Badge,
  Card,
  ErrorText,
  Field,
  MutedText,
  SectionTitle,
  MobileButton,
} from '../core/mobile-ui';
import {
  formatParentSlipDate,
  parentPermissionSlipCategoryLabels,
  paymentBadgeVariant,
  paymentLabel,
  responseBadgeVariant,
  responseLabel,
  type ParentPermissionSlipRow,
} from './parent-permission-slips-utils';

interface ResponseFormState {
  agreed: boolean;
  answers: Record<string, string>;
  decision: 'Declined' | 'Signed' | null;
  declineReason: string;
  emergencyContact: string;
  medicalInfo: string;
  parentName: string;
}

interface ParentPermissionSlipDetailProps {
  row: ParentPermissionSlipRow;
  onBack: () => void;
}

function emptyResponseForm(): ResponseFormState {
  return {
    agreed: false,
    answers: {},
    decision: null,
    declineReason: '',
    emergencyContact: '',
    medicalInfo: '',
    parentName: '',
  };
}

export function ParentPermissionSlipDetail({ onBack, row }: ParentPermissionSlipDetailProps) {
  const utils = api.useUtils();
  const [form, setForm] = useState<ResponseFormState>(() => emptyResponseForm());
  const [submittedDecision, setSubmittedDecision] = useState<ResponseFormState['decision']>(null);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const { recipient, slip } = row;
  const submitResponse = api.permissionSlip.submitParentResponse.useMutation();
  const parentMarkPaid = api.permissionSlip.parentMarkPaid.useMutation();
  const canRespond = recipient.responseStatus === 'Pending' && !slip.inactive;
  const allRequiredAnswersComplete = useMemo(
    () =>
      slip.questions.every(
        (question) => !question.required || Boolean(form.answers[question.id]?.trim()),
      ),
    [form.answers, slip.questions],
  );
  const canSubmit =
    canRespond &&
    Boolean(form.decision) &&
    Boolean(form.parentName.trim()) &&
    (form.decision === 'Declined' ||
      (form.agreed &&
        (!slip.requireMedical || Boolean(form.medicalInfo.trim())) &&
        (!slip.requireEmergencyContact || Boolean(form.emergencyContact.trim())) &&
        allRequiredAnswersComplete));

  async function submitDecision() {
    if (!form.decision || !canSubmit) return;
    setOperationError(null);
    setStatus(null);
    try {
      await submitResponse.mutateAsync({
        answers: slip.questions.map((question) => ({
          answer: form.answers[question.id]?.trim() ?? '',
          questionId: question.id,
        })),
        decision: form.decision,
        declineReason: form.declineReason.trim() || undefined,
        emergencyContact: form.emergencyContact.trim() || undefined,
        medicalInfo: form.medicalInfo.trim() || undefined,
        parentName: form.parentName.trim(),
        slipId: slip.id,
        studentId: recipient.studentId,
      });
      await utils.permissionSlip.listParent.invalidate();
      setSubmittedDecision(form.decision);
    } catch (error) {
      setOperationError(
        error instanceof Error ? error.message : 'Permission slip response could not be submitted.',
      );
    }
  }

  async function markPaid() {
    setOperationError(null);
    setStatus(null);
    try {
      await parentMarkPaid.mutateAsync({ slipId: slip.id, studentId: recipient.studentId });
      await utils.permissionSlip.listParent.invalidate();
      setStatus('Payment sent for confirmation.');
    } catch (error) {
      setOperationError(
        error instanceof Error ? error.message : 'Payment could not be marked paid.',
      );
    }
  }

  if (submittedDecision) {
    return (
      <Card style={styles.successCard}>
        <Badge variant={submittedDecision === 'Signed' ? 'success' : 'danger'}>
          {submittedDecision === 'Signed' ? 'Permission granted' : 'Response recorded'}
        </Badge>
        <SectionTitle>
          {submittedDecision === 'Signed' ? 'Permission granted' : 'Response recorded'}
        </SectionTitle>
        <MutedText>
          {submittedDecision === 'Signed'
            ? `Your e-signature has been recorded for ${recipient.student.fullName}.`
            : `${recipient.student.fullName} will not take part.`}
        </MutedText>
        <MobileButton label="Back to permission slips" onPress={onBack} variant="primary" />
      </Card>
    );
  }

  return (
    <View style={styles.stack}>
      <MobileButton compact label="Back to permission slips" onPress={onBack} variant="secondary" />
      <Card style={styles.heroCard}>
        <View style={styles.badges}>
          <Badge variant="blue">{parentPermissionSlipCategoryLabels[slip.category]}</Badge>
          <Badge variant={responseBadgeVariant(recipient.responseStatus)}>
            {responseLabel(recipient.responseStatus)}
          </Badge>
          <Badge variant={paymentBadgeVariant(recipient.paymentStatus)}>
            {paymentLabel(recipient.paymentStatus)}
          </Badge>
          {slip.inactive ? <Badge variant="neutral">Expired</Badge> : null}
        </View>
        <Text style={styles.title}>{slip.title}</Text>
        <MutedText>
          {recipient.student.fullName} · Respond by {formatParentSlipDate(slip.deadline)}
        </MutedText>
      </Card>

      <Card style={styles.metaCard}>
        <SectionTitle>Trip and activity details</SectionTitle>
        <View style={styles.metaGrid}>
          {slip.eventDate ? (
            <Meta label="Event date" value={formatParentSlipDate(slip.eventDate)} />
          ) : null}
          {slip.departureTime ? <Meta label="Departure" value={slip.departureTime} /> : null}
          {slip.returnTime ? <Meta label="Return" value={slip.returnTime} /> : null}
          {slip.location ? <Meta label="Location" value={slip.location} /> : null}
          {slip.transport ? <Meta label="Transport" value={slip.transport} /> : null}
          {slip.cost ? <Meta label="Cost" value={slip.cost} /> : null}
        </View>
        {slip.description ? <Text style={styles.bodyText}>{slip.description}</Text> : null}
      </Card>

      {slip.bringItems.length > 0 ? (
        <Card style={styles.metaCard}>
          <SectionTitle>What to bring</SectionTitle>
          {slip.bringItems.map((item) => (
            <Text key={item.id} style={styles.bullet}>
              • {item.label}
            </Text>
          ))}
        </Card>
      ) : null}

      <Card style={styles.consentCard}>
        <Text style={styles.consentLabel}>Consent statement</Text>
        <Text style={styles.bodyText}>{slip.consentText}</Text>
      </Card>

      {!canRespond ? (
        <Card style={styles.metaCard}>
          <SectionTitle>
            {recipient.responseStatus === 'Pending' ? 'Expired' : 'Already answered'}
          </SectionTitle>
          <MutedText>
            {recipient.responseStatus === 'Pending'
              ? 'This permission slip is past its response deadline.'
              : 'This permission slip response has already been recorded.'}
          </MutedText>
        </Card>
      ) : (
        <Card style={styles.formCard}>
          <SectionTitle>Your decision</SectionTitle>
          <View style={styles.decisionGrid}>
            <MobileButton
              compact
              label="Give permission"
              onPress={() => {
                setForm((current) => ({ ...current, decision: 'Signed' }));
              }}
              variant={form.decision === 'Signed' ? 'success' : 'secondary'}
            />
            <MobileButton
              compact
              label="Decline permission"
              onPress={() => {
                setForm((current) => ({ ...current, decision: 'Declined' }));
              }}
              variant={form.decision === 'Declined' ? 'danger' : 'secondary'}
            />
          </View>

          {form.decision === 'Signed' && slip.requireMedical ? (
            <Field
              label="Medical or allergy information"
              multiline
              onChangeText={(medicalInfo) => {
                setForm((current) => ({ ...current, medicalInfo }));
              }}
              value={form.medicalInfo}
            />
          ) : null}
          {form.decision === 'Signed' && slip.requireEmergencyContact ? (
            <Field
              label="Emergency contact"
              onChangeText={(emergencyContact) => {
                setForm((current) => ({ ...current, emergencyContact }));
              }}
              placeholder="Name, phone, relationship"
              value={form.emergencyContact}
            />
          ) : null}
          {form.decision === 'Declined' ? (
            <Field
              label="Reason"
              multiline
              onChangeText={(declineReason) => {
                setForm((current) => ({ ...current, declineReason }));
              }}
              value={form.declineReason}
            />
          ) : null}
          {form.decision === 'Signed'
            ? slip.questions.map((question) => (
                <Field
                  key={question.id}
                  label={question.required ? `${question.label} *` : question.label}
                  onChangeText={(answer) => {
                    setForm((current) => ({
                      ...current,
                      answers: { ...current.answers, [question.id]: answer },
                    }));
                  }}
                  value={form.answers[question.id] ?? ''}
                />
              ))
            : null}
          {form.decision ? (
            <Field
              label="Your full name"
              onChangeText={(parentName) => {
                setForm((current) => ({ ...current, parentName }));
              }}
              value={form.parentName}
            />
          ) : null}
          {form.decision === 'Signed' && form.parentName.trim() ? (
            <View style={styles.signaturePreview}>
              <Text style={styles.signatureLabel}>Signed name preview</Text>
              <Text style={styles.signatureName}>{form.parentName}</Text>
              <MutedText>
                Typing your name acts as your e-signature for this permission slip.
              </MutedText>
            </View>
          ) : null}
          {form.decision === 'Signed' ? (
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: form.agreed }}
              onPress={() => {
                setForm((current) => ({ ...current, agreed: !current.agreed }));
              }}
              style={styles.agreement}
            >
              <View style={[styles.checkbox, form.agreed ? styles.checkboxChecked : null]}>
                {form.agreed ? <Text style={styles.checkboxMark}>✓</Text> : null}
              </View>
              <Text style={styles.agreementText}>
                I confirm I have read the consent statement and agree on behalf of{' '}
                <Text style={styles.bold}>{recipient.student.fullName}</Text>.
              </Text>
            </Pressable>
          ) : null}
          <MobileButton
            disabled={!canSubmit || submitResponse.isPending}
            label={
              submitResponse.isPending
                ? 'Submitting...'
                : form.decision === 'Declined'
                  ? 'Submit decline'
                  : 'Submit signed slip'
            }
            onPress={() => {
              void submitDecision();
            }}
          />
        </Card>
      )}

      {recipient.responseStatus === 'Signed' && recipient.paymentStatus === 'Unpaid' ? (
        <Card style={styles.paymentCard}>
          <SectionTitle>Payment required</SectionTitle>
          <MutedText>The slip is signed. Mark payment once you have paid the office.</MutedText>
          <MobileButton
            disabled={parentMarkPaid.isPending}
            label={parentMarkPaid.isPending ? 'Saving...' : 'Mark as paid'}
            onPress={() => {
              void markPaid();
            }}
            variant="primary"
          />
        </Card>
      ) : null}
      {recipient.paymentStatus === 'PaymentPending' ? (
        <Card style={styles.paymentCard}>
          <SectionTitle>Payment waiting for confirmation</SectionTitle>
          <MutedText>The slip will show as paid after a Head or Pastor confirms it.</MutedText>
        </Card>
      ) : null}
      {recipient.paymentStatus === 'Paid' ? <Badge variant="success">Paid</Badge> : null}
      {status ? <Badge variant="blue">{status}</Badge> : null}
      {operationError ? <ErrorText>{operationError}</ErrorText> : null}
    </View>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaCell}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  agreement: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
  },
  agreementText: {
    color: C.textSecondary,
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  bodyText: {
    color: C.textPrimary,
    fontSize: 13,
    lineHeight: 20,
  },
  bold: {
    color: C.navy,
    fontWeight: '800',
  },
  bullet: {
    color: C.textPrimary,
    fontSize: 13,
    lineHeight: 20,
  },
  checkbox: {
    alignItems: 'center',
    backgroundColor: C.surface,
    borderColor: C.border,
    borderRadius: 6,
    borderWidth: 1.5,
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  checkboxChecked: {
    backgroundColor: C.crimson,
    borderColor: C.crimson,
  },
  checkboxMark: {
    color: C.surface,
    fontSize: 13,
    fontWeight: '900',
  },
  consentCard: {
    backgroundColor: C.blueLight,
    borderColor: C.blueMid,
    gap: 8,
    padding: 16,
  },
  consentLabel: {
    color: C.navy,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  decisionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  formCard: {
    gap: 14,
    padding: 16,
  },
  heroCard: {
    gap: 9,
    padding: 16,
  },
  metaCard: {
    gap: 10,
    padding: 16,
  },
  metaCell: {
    backgroundColor: C.bg,
    borderColor: C.borderLight,
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    gap: 3,
    minWidth: 118,
    padding: 10,
  },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metaLabel: {
    color: C.textMuted,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  metaValue: {
    color: C.navy,
    fontSize: 13,
    fontWeight: '800',
  },
  paymentCard: {
    gap: 10,
    padding: 16,
  },
  signatureLabel: {
    color: C.textSecondary,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  signatureName: {
    color: C.navy,
    fontSize: 20,
    fontWeight: '900',
  },
  signaturePreview: {
    backgroundColor: C.bg,
    borderColor: C.borderLight,
    borderRadius: 10,
    borderWidth: 1,
    gap: 4,
    padding: 12,
  },
  stack: {
    gap: 14,
  },
  successCard: {
    gap: 12,
    padding: 18,
  },
  title: {
    color: C.navy,
    fontSize: 21,
    fontWeight: '900',
  },
});
