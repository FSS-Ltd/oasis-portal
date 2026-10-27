import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  availablePacesAhead,
  DIAGNOSTIC_LEVEL_MAX,
  derivePacePlacement,
  isDiagnosticChartTest,
  type DiagnosticTest,
} from '@oasis/domain';
import { type RouterOutputs } from '../../lib/trpc';
import { C } from '../core/mobile-theme';
import { Badge, Card, ErrorText, Field, MobileButton, MutedText } from '../core/mobile-ui';
import { StaffDiagnosticChart } from './staff-academic-diagnostic-chart';
import {
  attemptedPaceRange,
  describePlacement,
  paceNumberValue,
} from './staff-academic-inventory-utils';

type InventorySummary = RouterOutputs['academicInventory']['summary'];
type InventoryStudent = InventorySummary['students'][number];
type InventoryAssignment = InventoryStudent['subjects'][number];
type InventoryAlert = InventorySummary['alerts'][number];
type DiagnosticOutcome = 'Fail' | 'Pass';
export type InventoryStatusMessage = { message: string; tone: 'error' | 'success' };

export const diagnosticLevels = Array.from(
  { length: DIAGNOSTIC_LEVEL_MAX },
  (_, index) => index + 1,
);
export type DiagnosticLevel = number;
const diagnosticTestOptions: ReadonlyArray<{ value: DiagnosticTest; label: string }> = [
  { value: 'Math', label: 'Math' },
  { value: 'English', label: 'English' },
  { value: 'WordBuilding', label: 'Word Building' },
  { value: 'Reading', label: 'Reading' },
];
export type DiagnosticSubmission =
  | { test: 'Math' | 'English'; attemptedPaceNumbers: number[]; circledPaceNumbers: number[] }
  | { test: 'WordBuilding' | 'Reading'; level: number; outcome: DiagnosticOutcome };
const diagnosticOutcomes: DiagnosticOutcome[] = ['Pass', 'Fail'];

function assignmentLabel(assignment: InventoryAssignment): string {
  return `${assignment.subject.code} · ${assignment.subject.name}`;
}

export function AcademicInventoryHeading({ onBack }: { onBack: () => void }) {
  return (
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
        <Text style={styles.eyebrow}>Academic inventory</Text>
        <Text style={styles.title}>PACE orders and diagnostics</Text>
      </View>
    </View>
  );
}

export function InventoryStatusNotice({ status }: { status: InventoryStatusMessage }) {
  const error = status.tone === 'error';
  return (
    <View
      accessibilityLiveRegion={error ? 'assertive' : 'polite'}
      accessibilityRole="alert"
      style={[styles.statusNotice, error ? styles.errorNotice : styles.successNotice]}
    >
      <Text style={[styles.statusText, error ? styles.errorText : styles.successText]}>
        {status.message}
      </Text>
    </View>
  );
}

export function InventoryAlerts({
  onCreateOrder,
  summary,
}: {
  onCreateOrder: (alert: InventoryAlert) => void;
  summary: InventorySummary;
}) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const grouped = new Map<string, InventoryAlert[]>();
  for (const alert of summary.alerts) {
    grouped.set(alert.studentId, [...(grouped.get(alert.studentId) ?? []), alert]);
  }
  const children = [...grouped].sort(([leftId, leftAlerts], [rightId, rightAlerts]) => {
    const remaining =
      Math.min(...leftAlerts.map((alert) => alert.remainingPaceCount)) -
      Math.min(...rightAlerts.map((alert) => alert.remainingPaceCount));
    const left = summary.students.find((row) => row.id === leftId)?.fullName ?? '';
    const right = summary.students.find((row) => row.id === rightId)?.fullName ?? '';
    return remaining || left.localeCompare(right) || leftId.localeCompare(rightId);
  });
  useEffect(() => {
    const lastPage = Math.max(1, Math.ceil(children.length / pageSize));
    if (page > lastPage) setPage(lastPage);
  }, [children.length, page, pageSize]);
  return (
    <Card style={styles.compactCard}>
      <View style={styles.rowBetween}>
        <Text style={styles.cardTitle}>Reorder alerts</Text>
        <Badge variant={summary.alerts.length > 0 ? 'warning' : 'success'}>
          {String(children.length)} children
        </Badge>
      </View>
      {summary.alerts.length === 0 ? (
        <MutedText>No recorded PACE supply is below the reorder threshold.</MutedText>
      ) : (
        children.slice((page - 1) * pageSize, page * pageSize).map(([studentId, alerts]) => {
          const student = summary.students.find((row) => row.id === studentId);
          return (
            <View key={studentId} style={styles.alertGroup}>
              <Text style={styles.rowTitle}>{student?.fullName ?? 'Student'}</Text>
              {alerts.map((alert) => {
                const assignment = student?.subjects.find(
                  (row) => row.subjectId === alert.subjectId,
                );
                return (
                  <View key={alert.subjectId} style={styles.alertRow}>
                    <View style={styles.rowBody}>
                      <MutedText>
                        {assignment ? assignmentLabel(assignment) : 'Assigned subject'}
                      </MutedText>
                      <Text style={styles.alertPace}>
                        Current #{String(alert.currentPaceNumber)} ·{' '}
                        {alert.remainingPaceCount === 0
                          ? 'No future supply recorded'
                          : `${String(alert.remainingPaceCount)} future PACEs supplied`}
                      </Text>
                      {alert.pendingOrders.length > 0 ? (
                        <MutedText>
                          Awaiting delivery:{' '}
                          {alert.pendingOrders
                            .map(
                              (order) =>
                                `#${String(order.paceNumber)} ${order.status === 'InTransit' ? 'in transit' : 'ordered'}`,
                            )
                            .join(' · ')}
                        </MutedText>
                      ) : null}
                    </View>
                    <MobileButton
                      accessibilityLabel={`Create order for ${student?.fullName ?? 'student'}, ${assignment ? assignmentLabel(assignment) : 'assigned subject'}`}
                      label="Create order"
                      onPress={() => {
                        onCreateOrder(alert);
                      }}
                      variant="navy"
                    />
                  </View>
                );
              })}
            </View>
          );
        })
      )}
      <View style={styles.alertPages}>
        <Text accessibilityLiveRegion="polite" style={styles.fieldLabel}>
          {String(children.length === 0 ? 0 : (page - 1) * pageSize + 1)}–
          {String(Math.min(page * pageSize, children.length))} of {String(children.length)}
        </Text>
        <MobileButton
          compact
          disabled={page <= 1}
          label="Previous"
          onPress={() => {
            setPage(page - 1);
          }}
          variant="secondary"
        />
        <MobileButton
          compact
          disabled={page >= Math.ceil(children.length / pageSize)}
          label="Next"
          onPress={() => {
            setPage(page + 1);
          }}
          variant="secondary"
        />
      </View>
      <View style={styles.alertPages}>
        <Text style={styles.fieldLabel}>Children per page</Text>
        {[5, 10, 20].map((size) => (
          <MobileButton
            compact
            key={size}
            label={String(size)}
            onPress={() => {
              setPageSize(size);
              setPage(1);
            }}
            variant={size === pageSize ? 'navy' : 'secondary'}
          />
        ))}
      </View>
    </Card>
  );
}

export function InventoryOrderForm({
  assignment,
  errorMessage,
  onChangePaceNumber,
  onSubmit,
  paceNumber,
  pending,
  student,
  submitted,
}: {
  assignment: InventoryAssignment | null;
  errorMessage?: string | null;
  onChangePaceNumber: (value: string) => void;
  onSubmit: () => void;
  paceNumber: string;
  pending: boolean;
  student: InventoryStudent | null;
  submitted: boolean;
}) {
  const validation = !student
    ? 'Select a student.'
    : !assignment
      ? 'Select an assigned subject.'
      : paceNumberValue(paceNumber) === null
        ? 'Enter a whole PACE number from 1001 to 1144.'
        : null;
  return (
    <Card style={styles.compactCard}>
      <Text style={styles.cardTitle}>Create PACE order</Text>
      <Field
        disabled={pending}
        keyboardType="numeric"
        label="PACE number"
        onChangeText={onChangePaceNumber}
        placeholder="1001"
        value={paceNumber}
      />
      {submitted && validation ? <ErrorText>{validation}</ErrorText> : null}
      {errorMessage ? <ErrorText>{errorMessage}</ErrorText> : null}
      <MobileButton
        disabled={pending || validation !== null}
        label={pending ? 'Creating order...' : 'Create order'}
        onPress={onSubmit}
        variant="navy"
      />
    </Card>
  );
}

export function InventorySupplyStatus({
  assignment,
  student,
  summary,
}: {
  assignment: InventoryAssignment | null;
  student: InventoryStudent | null;
  summary: InventorySummary;
}) {
  if (!assignment || !student) return null;
  const supplied = availablePacesAhead(
    assignment.currentPaceNumber,
    summary.supply
      .filter((row) => row.studentId === student.id && row.subjectId === assignment.subjectId)
      .map((row) => row.paceNumber),
  );
  const pending = summary.orders.filter(
    (row) =>
      row.studentId === student.id &&
      row.subjectId === assignment.subjectId &&
      row.status !== 'Delivered' &&
      row.paceNumber > assignment.currentPaceNumber,
  );
  return (
    <Card style={styles.compactCard}>
      <Text style={styles.cardTitle}>Current PACE #{String(assignment.currentPaceNumber)}</Text>
      <Text style={styles.fieldLabel}>Available now</Text>
      <MutedText>
        {supplied.length > 0
          ? supplied.map((paceNumber) => `#${String(paceNumber)}`).join(' · ')
          : 'No future supply recorded'}
      </MutedText>
      <Text style={styles.fieldLabel}>Awaiting delivery</Text>
      <MutedText>
        {pending.length > 0
          ? pending
              .map(
                (order) =>
                  `#${String(order.paceNumber)} ${order.status === 'InTransit' ? 'in transit' : 'ordered'}`,
              )
              .join(' · ')
          : 'No orders awaiting delivery'}
      </MutedText>
    </Card>
  );
}

export function InventoryQuickOrderModal({
  assignment,
  errorMessage,
  onChangePaceNumber,
  onClose,
  onSubmit,
  paceNumber,
  pending,
  student,
  submitted,
  visible,
}: {
  assignment: InventoryAssignment | null;
  errorMessage: string | null;
  onChangePaceNumber: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
  paceNumber: string;
  pending: boolean;
  student: InventoryStudent | null;
  submitted: boolean;
  visible: boolean;
}) {
  return (
    <Modal
      animationType="slide"
      onRequestClose={() => {
        if (!pending) onClose();
      }}
      presentationStyle="overFullScreen"
      transparent
      visible={visible}
    >
      <SafeAreaView style={styles.modalBackdrop}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardAvoidingView}
        >
          <View accessibilityViewIsModal style={styles.modalSheet}>
            <ScrollView
              contentContainerStyle={styles.modalContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.modalHeader}>
                <MobileButton
                  disabled={pending}
                  label="Cancel"
                  onPress={onClose}
                  variant="secondary"
                />
                <View style={styles.modalHeading}>
                  <Text style={styles.eyebrow}>Quick order</Text>
                  <Text accessibilityRole="header" style={styles.cardTitle}>
                    Create PACE order
                  </Text>
                </View>
              </View>
              <Card style={styles.compactCard}>
                <Text style={styles.cardTitle}>{student?.fullName ?? 'Student'}</Text>
                <MutedText>
                  {assignment
                    ? assignmentLabel(assignment)
                    : 'This subject assignment is unavailable.'}
                </MutedText>
                {assignment ? (
                  <MutedText>Current PACE #{String(assignment.currentPaceNumber)}</MutedText>
                ) : null}
              </Card>
              <InventoryOrderForm
                assignment={assignment}
                errorMessage={errorMessage}
                onChangePaceNumber={onChangePaceNumber}
                onSubmit={onSubmit}
                paceNumber={paceNumber}
                pending={pending}
                student={student}
                submitted={submitted}
              />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

export function InventoryDiagnosticCard({
  level,
  onChangeLevel,
  onChangeOutcome,
  onSubmit,
  outcome,
  pending,
  student,
  submitted,
}: {
  level: DiagnosticLevel;
  onChangeLevel: (level: DiagnosticLevel) => void;
  onChangeOutcome: (outcome: DiagnosticOutcome) => void;
  onSubmit: (submission: DiagnosticSubmission | null) => void;
  outcome: DiagnosticOutcome;
  pending: boolean;
  student: InventoryStudent | null;
  submitted: boolean;
}) {
  const [test, setTest] = useState<DiagnosticTest>('Math');
  const [firstPace, setFirstPace] = useState('1001');
  const [lastPace, setLastPace] = useState('');
  const [circled, setCircled] = useState<number[]>([]);
  const chartTest = isDiagnosticChartTest(test);
  const attempted = attemptedPaceRange(firstPace, lastPace) ?? [];
  const circledInRange = circled.filter((paceNumber) => attempted.includes(paceNumber));
  const placement = attempted.length > 0 ? derivePacePlacement(attempted, circledInRange) : null;
  const rangeInvalid = chartTest && lastPace.trim() !== '' && attempted.length === 0;
  const validation = !student
    ? 'Select a student.'
    : chartTest && attempted.length === 0
      ? 'Enter the first and last PACE attempted (1001 to 1144).'
      : null;

  function submit() {
    // A null submission lets the screen show the validation message.
    if (validation) {
      onSubmit(null);
      return;
    }
    if (test === 'Math' || test === 'English') {
      onSubmit({
        test,
        attemptedPaceNumbers: attempted,
        circledPaceNumbers: [...circledInRange].sort((a, b) => a - b),
      });
      return;
    }
    onSubmit({ test, level, outcome });
  }

  return (
    <Card style={styles.compactCard}>
      <Text style={styles.cardTitle}>Diagnostic test</Text>
      <MutedText>Records a result for {student?.fullName ?? 'the selected student'}.</MutedText>
      <Text style={styles.fieldLabel}>Test</Text>
      <View style={styles.segmentedRow}>
        {diagnosticTestOptions.map((option) => (
          <SegmentButton
            active={test === option.value}
            disabled={pending}
            key={option.value}
            label={option.label}
            onPress={() => {
              setTest(option.value);
            }}
          />
        ))}
      </View>
      {chartTest ? (
        <>
          <Field
            disabled={pending}
            keyboardType="numeric"
            label="First PACE"
            onChangeText={setFirstPace}
            value={firstPace}
          />
          <Field
            disabled={pending}
            keyboardType="numeric"
            label="Last PACE attempted"
            onChangeText={setLastPace}
            value={lastPace}
          />
          {rangeInvalid ? (
            <ErrorText>Use PACEs from 1001 to 1144, with the last at or after the first.</ErrorText>
          ) : null}
          {attempted.length > 0 ? (
            <>
              <MutedText>Tap every PACE scored below the minimum to circle it.</MutedText>
              <StaffDiagnosticChart
                attempted={attempted}
                circled={circledInRange}
                disabled={pending}
                onToggle={(paceNumber) => {
                  setCircled((current) =>
                    current.includes(paceNumber)
                      ? current.filter((value) => value !== paceNumber)
                      : [...current, paceNumber],
                  );
                }}
              />
              {placement ? (
                <Text accessibilityLiveRegion="polite" style={styles.fieldLabel}>
                  {describePlacement(placement)}
                </Text>
              ) : null}
            </>
          ) : null}
        </>
      ) : (
        <>
          {test === 'Reading' ? (
            <MutedText>
              Reading is not a subject. Its level sets where this student starts Science and Social
              Studies.
            </MutedText>
          ) : null}
          <Text style={styles.fieldLabel}>Level</Text>
          <View style={styles.segmentedRow}>
            {diagnosticLevels.map((value) => (
              <SegmentButton
                active={level === value}
                disabled={pending}
                key={value}
                label={String(value)}
                onPress={() => {
                  onChangeLevel(value);
                }}
              />
            ))}
          </View>
          <Text style={styles.fieldLabel}>Outcome</Text>
          <View style={styles.segmentedRow}>
            {diagnosticOutcomes.map((value) => (
              <SegmentButton
                active={outcome === value}
                disabled={pending}
                key={value}
                label={value}
                onPress={() => {
                  onChangeOutcome(value);
                }}
              />
            ))}
          </View>
        </>
      )}
      {submitted && validation ? <ErrorText>{validation}</ErrorText> : null}
      <MobileButton
        disabled={pending}
        label={pending ? 'Recording diagnostic...' : 'Record diagnostic'}
        onPress={submit}
        variant="navy"
      />
    </Card>
  );
}

function SegmentButton({
  active,
  disabled,
  label,
  onPress,
}: {
  active: boolean;
  disabled: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled, selected: active }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.segmentButton,
        active ? styles.segmentButtonActive : null,
        disabled ? styles.segmentButtonDisabled : null,
      ]}
    >
      <Text style={[styles.segmentText, active ? styles.segmentTextActive : null]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  alertGroup: { borderColor: C.border, borderRadius: 8, borderWidth: 1, gap: 8, padding: 10 },
  alertPages: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  alertPace: { color: C.warning, fontSize: 12, fontWeight: '900' },
  alertRow: {
    alignItems: 'flex-start',
    backgroundColor: C.warningBg,
    borderRadius: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    padding: 12,
  },
  backButton: {
    alignItems: 'center',
    borderColor: C.border,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: 12,
  },
  backButtonText: { color: C.blue, fontSize: 13, fontWeight: '800' },
  cardTitle: { color: C.navy, fontSize: 14, fontWeight: '900' },
  compactCard: { gap: 10, padding: 16 },
  errorNotice: { backgroundColor: C.dangerBg, borderColor: C.dangerMid },
  errorText: { color: C.danger },
  eyebrow: { color: C.blue, fontSize: 12, fontWeight: '800', textTransform: 'uppercase' },
  fieldLabel: { color: C.textSecondary, fontSize: 12, fontWeight: '800' },
  modalBackdrop: {
    backgroundColor: 'rgba(10, 18, 40, 0.6)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: C.bg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '92%',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  modalContent: { gap: 12, paddingBottom: 20 },
  modalHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  modalHeading: { flex: 1, gap: 4 },
  keyboardAvoidingView: { flex: 1, justifyContent: 'flex-end' },
  rowBetween: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  rowBody: { flex: 1, gap: 2, minWidth: 0 },
  rowTitle: { color: C.navy, fontSize: 12, fontWeight: '900' },
  segmentButton: {
    alignItems: 'center',
    backgroundColor: C.surface,
    borderColor: C.border,
    borderRadius: 9,
    borderWidth: 1,
    flex: 1,
    minHeight: 40,
    minWidth: 48,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  segmentButtonActive: { backgroundColor: C.navy, borderColor: C.navy },
  segmentButtonDisabled: { opacity: 0.45 },
  segmentedRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  segmentText: { color: C.textSecondary, fontSize: 12, fontWeight: '900' },
  segmentTextActive: { color: C.surface },
  statusNotice: { borderRadius: 10, borderWidth: 1, padding: 12 },
  statusText: { fontSize: 12, fontWeight: '800', lineHeight: 17 },
  successNotice: { backgroundColor: C.successBg, borderColor: C.successMid },
  successText: { color: C.success },
  title: { color: C.navy, fontSize: 20, fontWeight: '900', lineHeight: 24 },
  titleGroup: { flex: 1, gap: 2 },
  topRow: { alignItems: 'center', flexDirection: 'row', gap: 12 },
});
