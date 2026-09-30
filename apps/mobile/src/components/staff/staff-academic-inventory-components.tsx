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
import { type RouterOutputs } from '../../lib/trpc';
import { C } from '../core/mobile-theme';
import { Badge, Card, ErrorText, Field, MobileButton, MutedText } from '../core/mobile-ui';
import {
  diagnosticPlacementLabel,
  nextOrderStatus,
  paceNumberValue,
} from './staff-academic-inventory-utils';

type InventorySummary = RouterOutputs['academicInventory']['summary'];
type InventoryStudent = InventorySummary['students'][number];
type InventoryAssignment = InventoryStudent['subjects'][number];
type InventoryOrder = InventorySummary['orders'][number];
type InventoryAlert = InventorySummary['alerts'][number];
type DiagnosticOutcome = 'Fail' | 'Pass';
export type InventoryStatusMessage = { message: string; tone: 'error' | 'success' };

export const diagnosticLevels = [1, 2, 3, 4, 5] as const;
export type DiagnosticLevel = (typeof diagnosticLevels)[number];
const diagnosticOutcomes: DiagnosticOutcome[] = ['Pass', 'Fail'];

function displayDate(value: string | Date): string {
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(new Date(value));
}

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
  return (
    <Card style={styles.compactCard}>
      <View style={styles.rowBetween}>
        <Text style={styles.cardTitle}>Reorder alerts</Text>
        <Badge variant={summary.alerts.length > 0 ? 'warning' : 'success'}>
          {String(summary.alerts.length)} open
        </Badge>
      </View>
      {summary.alerts.length === 0 ? (
        <MutedText>No assignments are within two PACEs of delivered stock.</MutedText>
      ) : (
        summary.alerts.map((alert) => {
          const student = summary.students.find((row) => row.id === alert.studentId);
          const assignment = student?.subjects.find((row) => row.subjectId === alert.subjectId);
          return (
            <View key={`${alert.studentId}:${alert.subjectId}`} style={styles.alertRow}>
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle}>{student?.fullName ?? 'Student'}</Text>
                <MutedText>
                  {assignment ? assignmentLabel(assignment) : 'Assigned subject'}
                </MutedText>
              </View>
              <Text style={styles.alertPace}>
                #{String(alert.currentPaceNumber)} · {String(alert.remainingPaceCount)} available
              </Text>
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
        })
      )}
    </Card>
  );
}

export function InventoryStudentPicker({
  onSelect,
  selectedStudentId,
  students,
}: {
  onSelect: (studentId: string) => void;
  selectedStudentId: string;
  students: InventoryStudent[];
}) {
  return (
    <Card style={styles.compactCard}>
      <Text style={styles.cardTitle}>Student</Text>
      <View style={styles.optionList}>
        {students.map((student) => (
          <OptionButton
            active={student.id === selectedStudentId}
            key={student.id}
            label={`${student.fullName} · ${student.yearGroup}`}
            onPress={() => {
              onSelect(student.id);
            }}
          />
        ))}
      </View>
    </Card>
  );
}

export function InventorySubjectPicker({
  assignments,
  onSelect,
  selectedSubjectId,
}: {
  assignments: InventoryAssignment[];
  onSelect: (subjectId: string) => void;
  selectedSubjectId: string;
}) {
  return (
    <Card style={styles.compactCard}>
      <Text style={styles.cardTitle}>Assigned subject</Text>
      {assignments.length === 0 ? (
        <MutedText>This student has no active subjects.</MutedText>
      ) : null}
      <View style={styles.optionList}>
        {assignments.map((assignment) => (
          <OptionButton
            active={assignment.subjectId === selectedSubjectId}
            key={assignment.id}
            label={`${assignmentLabel(assignment)} · Current #${String(assignment.currentPaceNumber)}`}
            onPress={() => {
              onSelect(assignment.subjectId);
            }}
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

export function InventoryOrderList({
  onAdvance,
  orders,
  students,
  updatingOrderId,
}: {
  onAdvance: (order: InventoryOrder) => void;
  orders: InventoryOrder[];
  students: InventoryStudent[];
  updatingOrderId: string | null;
}) {
  return (
    <Card style={styles.compactCard}>
      <View style={styles.rowBetween}>
        <Text style={styles.cardTitle}>Existing orders</Text>
        <Badge>{String(orders.length)} recent</Badge>
      </View>
      {orders.length === 0 ? <MutedText>No PACE orders have been created yet.</MutedText> : null}
      {orders.map((order) => {
        const student = students.find((row) => row.id === order.studentId);
        const assignment = student?.subjects.find((row) => row.subjectId === order.subjectId);
        const nextStatus = nextOrderStatus(order.status);
        const pending = updatingOrderId === order.id;
        return (
          <View key={order.id} style={styles.orderRow}>
            <View style={styles.rowBetween}>
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle}>
                  PACE #{String(order.paceNumber)} · {student?.fullName ?? 'Student'}
                </Text>
                <MutedText>
                  {assignment ? assignmentLabel(assignment) : 'Assigned subject'} ·{' '}
                  {displayDate(order.createdAt)}
                </MutedText>
              </View>
              <Badge variant={order.status === 'Delivered' ? 'success' : 'blue'}>
                {order.status}
              </Badge>
            </View>
            {nextStatus ? (
              <MobileButton
                compact
                disabled={updatingOrderId !== null}
                label={pending ? 'Updating...' : `Mark ${nextStatus}`}
                onPress={() => {
                  onAdvance(order);
                }}
                variant="blue"
              />
            ) : null}
          </View>
        );
      })}
    </Card>
  );
}

export function InventoryDiagnosticCard({
  assignment,
  level,
  onChangeLevel,
  onChangeOutcome,
  onSubmit,
  outcome,
  pending,
  student,
  submitted,
}: {
  assignment: InventoryAssignment | null;
  level: DiagnosticLevel;
  onChangeLevel: (level: DiagnosticLevel) => void;
  onChangeOutcome: (outcome: DiagnosticOutcome) => void;
  onSubmit: () => void;
  outcome: DiagnosticOutcome;
  pending: boolean;
  student: InventoryStudent | null;
  submitted: boolean;
}) {
  const validation = !student
    ? 'Select a student.'
    : !assignment
      ? 'Select an assigned subject.'
      : null;
  return (
    <Card style={styles.compactCard}>
      <Text style={styles.cardTitle}>Diagnostic placement</Text>
      <MutedText>
        Uses {student?.fullName ?? 'the selected student'} and{' '}
        {assignment ? assignmentLabel(assignment) : 'the selected subject'}.
      </MutedText>
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
      <MutedText>{diagnosticPlacementLabel(level)}</MutedText>
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
      {submitted && validation ? <ErrorText>{validation}</ErrorText> : null}
      <MobileButton
        disabled={pending}
        label={pending ? 'Recording diagnostic...' : 'Record diagnostic'}
        onPress={onSubmit}
        variant="navy"
      />
    </Card>
  );
}

function OptionButton({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.optionButton, active ? styles.optionButtonActive : null]}
    >
      <Text style={[styles.optionText, active ? styles.optionTextActive : null]}>{label}</Text>
    </Pressable>
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
  optionButton: {
    backgroundColor: C.bg,
    borderColor: C.border,
    borderRadius: 10,
    borderWidth: 1,
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  optionButtonActive: { backgroundColor: C.blueLight, borderColor: C.blue },
  optionList: { gap: 8 },
  optionText: { color: C.textSecondary, fontSize: 12, fontWeight: '800' },
  optionTextActive: { color: C.navy },
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
  orderRow: {
    backgroundColor: C.bg,
    borderColor: C.border,
    borderRadius: 10,
    borderWidth: 1,
    gap: 10,
    padding: 12,
  },
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
