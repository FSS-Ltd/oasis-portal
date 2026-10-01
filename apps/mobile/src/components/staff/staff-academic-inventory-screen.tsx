import { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useClerk } from '@clerk/clerk-expo';
import { api, type RouterOutputs } from '../../lib/trpc';
import { C } from '../core/mobile-theme';
import { Card, ErrorText, InlineSpinner, MutedText } from '../core/mobile-ui';
import { PortalMobileHeader } from '../core/portal-mobile-shell';
import {
  AcademicInventoryHeading,
  InventoryAlerts,
  InventoryDiagnosticCard,
  InventoryOrderForm,
  InventoryOrderList,
  InventoryQuickOrderModal,
  InventoryStatusNotice,
  InventoryStudentPicker,
  InventorySubjectPicker,
  type DiagnosticLevel,
  type InventoryStatusMessage,
} from './staff-academic-inventory-components';
import {
  canOpenAcademicInventory,
  diagnosticPlacementLabel,
  nextOrderStatus,
  paceNumberValue,
} from './staff-academic-inventory-utils';

type SessionUser = NonNullable<RouterOutputs['health']['me']['user']>;
type InventorySummary = RouterOutputs['academicInventory']['summary'];
type InventoryStudent = InventorySummary['students'][number];
type InventoryAssignment = InventoryStudent['subjects'][number];
type InventoryOrder = InventorySummary['orders'][number];
type DiagnosticOutcome = 'Fail' | 'Pass';

function friendlyError(error: unknown): string {
  return error instanceof Error ? error.message : 'Please try again.';
}

function findStudent(
  students: InventoryStudent[],
  selectedStudentId: string,
): InventoryStudent | null {
  return students.find((student) => student.id === selectedStudentId) ?? students[0] ?? null;
}

function findAssignment(
  student: InventoryStudent | null,
  selectedSubjectId: string,
): InventoryAssignment | null {
  if (!student) return null;
  return (
    student.subjects.find((assignment) => assignment.subjectId === selectedSubjectId) ??
    student.subjects[0] ??
    null
  );
}

export function StaffAcademicInventoryScreen({
  onBack,
  user,
}: {
  onBack: () => void;
  user: SessionUser | undefined;
}) {
  const { signOut } = useClerk();
  const utils = api.useUtils();
  const canAccess = canOpenAcademicInventory(user);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [paceNumber, setPaceNumber] = useState('');
  const [quickOrderTarget, setQuickOrderTarget] = useState<{
    studentId: string;
    subjectId: string;
  } | null>(null);
  const [quickPaceNumber, setQuickPaceNumber] = useState('');
  const [quickOrderSubmitted, setQuickOrderSubmitted] = useState(false);
  const [quickOrderError, setQuickOrderError] = useState<string | null>(null);
  const [orderSubmitted, setOrderSubmitted] = useState(false);
  const [diagnosticSubmitted, setDiagnosticSubmitted] = useState(false);
  const [diagnosticLevel, setDiagnosticLevel] = useState<DiagnosticLevel>(1);
  const [diagnosticOutcome, setDiagnosticOutcome] = useState<DiagnosticOutcome>('Pass');
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<InventoryStatusMessage | null>(null);

  const summary = api.academicInventory.summary.useQuery(undefined, {
    enabled: canAccess,
    retry: false,
  });
  const students = summary.data?.students ?? [];
  const selectedStudent = findStudent(students, selectedStudentId);
  const selectedAssignment = findAssignment(selectedStudent, selectedSubjectId);
  const quickOrderStudent = quickOrderTarget
    ? (students.find((student) => student.id === quickOrderTarget.studentId) ?? null)
    : null;
  const quickOrderAssignment = quickOrderTarget
    ? (quickOrderStudent?.subjects.find(
        (assignment) => assignment.subjectId === quickOrderTarget.subjectId,
      ) ?? null)
    : null;

  async function invalidateAcademicInventory() {
    await Promise.all([
      utils.academicInventory.summary.invalidate(),
      utils.student.dashboard.invalidate(),
      utils.pace.forStudent.invalidate(),
      utils.pace.roster.invalidate(),
    ]);
  }

  const createOrder = api.academicInventory.createOrder.useMutation({
    onError: (error) => {
      setStatusMessage({
        message: `Order could not be created: ${friendlyError(error)}`,
        tone: 'error',
      });
    },
    onSuccess: async (_, variables) => {
      setStatusMessage({
        message: `PACE #${String(variables.paceNumber)} order created.`,
        tone: 'success',
      });
      await invalidateAcademicInventory();
    },
  });
  const updateOrderStatus = api.academicInventory.updateOrderStatus.useMutation({
    onError: (error) => {
      setStatusMessage({
        message: `Order status could not be updated: ${friendlyError(error)}`,
        tone: 'error',
      });
    },
    onSuccess: async (_, variables) => {
      setStatusMessage({ message: `Order moved to ${variables.status}.`, tone: 'success' });
      await invalidateAcademicInventory();
    },
    onSettled: () => {
      setUpdatingOrderId(null);
    },
  });
  const recordDiagnostic = api.academicInventory.recordDiagnostic.useMutation({
    onError: (error) => {
      setStatusMessage({
        message: `Diagnostic could not be recorded: ${friendlyError(error)}`,
        tone: 'error',
      });
    },
    onSuccess: async (_, variables) => {
      setDiagnosticSubmitted(false);
      setStatusMessage({
        message: `${diagnosticPlacementLabel(variables.level)} assigned after the ${variables.outcome.toLowerCase()} result.`,
        tone: 'success',
      });
      await invalidateAcademicInventory();
    },
  });

  function chooseStudent(studentId: string) {
    setSelectedStudentId(studentId);
    setSelectedSubjectId('');
    resetFormFeedback();
  }

  function chooseSubject(subjectId: string) {
    setSelectedSubjectId(subjectId);
    resetFormFeedback();
  }

  function resetFormFeedback() {
    setPaceNumber('');
    setOrderSubmitted(false);
    setDiagnosticSubmitted(false);
    setStatusMessage(null);
  }

  function changeDiagnosticLevel(level: DiagnosticLevel) {
    setDiagnosticLevel(level);
    setDiagnosticSubmitted(false);
    setStatusMessage(null);
  }

  function changeDiagnosticOutcome(outcome: DiagnosticOutcome) {
    setDiagnosticOutcome(outcome);
    setDiagnosticSubmitted(false);
    setStatusMessage(null);
  }

  function submitOrder() {
    setOrderSubmitted(true);
    setStatusMessage(null);
    const parsedPaceNumber = paceNumberValue(paceNumber);
    if (!selectedStudent || !selectedAssignment || parsedPaceNumber === null) return;
    createOrder.mutate(
      {
        paceNumber: parsedPaceNumber,
        studentId: selectedStudent.id,
        subjectId: selectedAssignment.subjectId,
      },
      {
        onSuccess: () => {
          setOrderSubmitted(false);
          setPaceNumber('');
        },
      },
    );
  }

  function openQuickOrder(alert: InventorySummary['alerts'][number]) {
    setQuickOrderTarget({ studentId: alert.studentId, subjectId: alert.subjectId });
    setQuickPaceNumber('');
    setQuickOrderSubmitted(false);
    setQuickOrderError(null);
  }

  function closeQuickOrder() {
    if (createOrder.isPending) return;
    setQuickOrderTarget(null);
    setQuickPaceNumber('');
    setQuickOrderSubmitted(false);
    setQuickOrderError(null);
  }

  function submitQuickOrder() {
    setQuickOrderSubmitted(true);
    setQuickOrderError(null);
    const parsedPaceNumber = paceNumberValue(quickPaceNumber);
    if (
      !quickOrderTarget ||
      !quickOrderStudent ||
      !quickOrderAssignment ||
      parsedPaceNumber === null
    ) {
      return;
    }
    createOrder.mutate(
      {
        paceNumber: parsedPaceNumber,
        studentId: quickOrderTarget.studentId,
        subjectId: quickOrderTarget.subjectId,
      },
      {
        onError: (error) => {
          setQuickOrderError(friendlyError(error));
        },
        onSuccess: () => {
          setQuickOrderTarget(null);
          setQuickPaceNumber('');
          setQuickOrderSubmitted(false);
          setQuickOrderError(null);
        },
      },
    );
  }

  function submitDiagnostic() {
    setDiagnosticSubmitted(true);
    setStatusMessage(null);
    if (!selectedStudent || !selectedAssignment) return;
    recordDiagnostic.mutate({
      level: diagnosticLevel,
      outcome: diagnosticOutcome,
      studentId: selectedStudent.id,
      subjectId: selectedAssignment.subjectId,
    });
  }

  function advanceOrder(order: InventoryOrder) {
    const status = nextOrderStatus(order.status);
    if (!status) return;
    setStatusMessage(null);
    setUpdatingOrderId(order.id);
    updateOrderStatus.mutate({ orderId: order.id, status });
  }

  const refreshing =
    summary.isFetching ||
    createOrder.isPending ||
    updateOrderStatus.isPending ||
    recordDiagnostic.isPending;

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
        subtitle={`${user?.role ?? 'Staff'} · PACE inventory`}
        title="Oasis Learning Centre"
        variant="dark"
      />
      <View style={styles.content}>
        <AcademicInventoryHeading onBack={onBack} />
        {!canAccess ? (
          <Card>
            <Text style={styles.cardTitle}>Access denied</Text>
            <MutedText>PACE inventory and diagnostics are available to Head staff only.</MutedText>
          </Card>
        ) : (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            refreshControl={
              <RefreshControl
                onRefresh={() => {
                  void summary.refetch();
                }}
                refreshing={refreshing}
              />
            }
            showsVerticalScrollIndicator={false}
          >
            {summary.isLoading ? <InlineSpinner label="Loading PACE inventory" /> : null}
            {summary.error ? <ErrorText>{summary.error.message}</ErrorText> : null}
            {statusMessage ? <InventoryStatusNotice status={statusMessage} /> : null}
            {summary.data ? (
              <InventoryAlerts onCreateOrder={openQuickOrder} summary={summary.data} />
            ) : null}

            {!summary.isLoading && !summary.error && students.length === 0 ? (
              <Card>
                <Text style={styles.cardTitle}>No students available</Text>
                <MutedText>
                  No active students with assigned subjects are available for inventory work.
                </MutedText>
              </Card>
            ) : null}

            {summary.data && students.length > 0 ? (
              <>
                <InventoryStudentPicker
                  onSelect={chooseStudent}
                  selectedStudentId={selectedStudent?.id ?? ''}
                  students={students}
                />
                <InventorySubjectPicker
                  assignments={selectedStudent?.subjects ?? []}
                  onSelect={chooseSubject}
                  selectedSubjectId={selectedAssignment?.subjectId ?? ''}
                />
                <InventoryOrderForm
                  assignment={selectedAssignment}
                  onChangePaceNumber={(value) => {
                    setPaceNumber(value);
                    setOrderSubmitted(false);
                    setStatusMessage(null);
                  }}
                  onSubmit={submitOrder}
                  paceNumber={paceNumber}
                  pending={createOrder.isPending}
                  student={selectedStudent}
                  submitted={orderSubmitted}
                />
                <InventoryOrderList
                  orders={summary.data.orders}
                  onAdvance={advanceOrder}
                  students={students}
                  updatingOrderId={updatingOrderId}
                />
                <InventoryDiagnosticCard
                  assignment={selectedAssignment}
                  level={diagnosticLevel}
                  onChangeLevel={changeDiagnosticLevel}
                  onChangeOutcome={changeDiagnosticOutcome}
                  onSubmit={submitDiagnostic}
                  outcome={diagnosticOutcome}
                  pending={recordDiagnostic.isPending}
                  student={selectedStudent}
                  submitted={diagnosticSubmitted}
                />
              </>
            ) : null}
          </ScrollView>
        )}
      </View>
      <InventoryQuickOrderModal
        assignment={quickOrderAssignment}
        errorMessage={quickOrderError}
        onChangePaceNumber={(value) => {
          setQuickPaceNumber(value);
          setQuickOrderSubmitted(false);
          setQuickOrderError(null);
        }}
        onClose={closeQuickOrder}
        onSubmit={submitQuickOrder}
        paceNumber={quickPaceNumber}
        pending={createOrder.isPending}
        student={quickOrderStudent}
        submitted={quickOrderSubmitted}
        visible={quickOrderTarget !== null}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  cardTitle: { color: C.navy, fontSize: 14, fontWeight: '900' },
  content: { flex: 1, gap: 14, padding: 16 },
  scrollContent: { gap: 14, paddingBottom: 36 },
  shell: { backgroundColor: C.bg, flex: 1 },
});
