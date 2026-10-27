import { useEffect, useState } from 'react';
import { PACE_CATALOGUE } from '@oasis/domain';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useClerk } from '@clerk/clerk-expo';
import { api, type RouterOutputs } from '../../lib/trpc';
import { C } from '../core/mobile-theme';
import { Card, ErrorText, InlineSpinner, MobileButton, MutedText } from '../core/mobile-ui';
import { PortalMobileHeader } from '../core/portal-mobile-shell';
import {
  AcademicInventoryHeading,
  InventoryAlerts,
  InventoryDiagnosticCard,
  InventoryOrderForm,
  InventoryQuickOrderModal,
  InventoryStatusNotice,
  InventorySupplyStatus,
  type DiagnosticLevel,
  type DiagnosticSubmission,
  type InventoryStatusMessage,
} from './staff-academic-inventory-components';
import { InventoryStudentPicker, InventorySubjectPicker } from './staff-academic-inventory-pickers';
import { InventoryOrderList } from './staff-academic-inventory-order-list';
import { InventoryDiagnosticHistory, type DiagnosticRow } from './staff-academic-inventory-history';
import {
  canOpenAcademicInventory,
  describePlacement,
  nextOrderStatus,
  paceNumberValue,
} from './staff-academic-inventory-utils';
import { StaffAcademicGapPlan } from './staff-academic-gap-plan';

type SessionUser = NonNullable<RouterOutputs['health']['me']['user']>;
type InventorySummary = RouterOutputs['academicInventory']['summary'];
type InventoryStudent = InventorySummary['students'][number];
type InventoryAssignment = InventoryStudent['subjects'][number];
type InventoryOrder = InventorySummary['orders'][number];
type DiagnosticOutcome = 'Fail' | 'Pass';
type InventoryTab = 'attention' | 'planner' | 'orders' | 'diagnostics';
const inventoryTabs: Array<{ id: InventoryTab; label: string }> = [
  { id: 'attention', label: 'Needs attention' },
  { id: 'planner', label: 'Planner' },
  { id: 'orders', label: 'Orders' },
  { id: 'diagnostics', label: 'Diagnostics' },
];

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
  const [diagnosticTab, setDiagnosticTab] = useState<'results' | 'gaps'>('results');
  const [gapPrefill, setGapPrefill] = useState<{
    studentId: string;
    subjectId: string;
    gaps: number[];
    jumpTo: number;
  } | null>(null);
  const [activeTab, setActiveTab] = useState<InventoryTab>('attention');
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [statusMessage, setStatusMessage] = useState<InventoryStatusMessage | null>(null);

  const summary = api.academicInventory.summary.useQuery(
    { includeHistory: false },
    {
      enabled: canAccess,
      retry: false,
    },
  );
  const students = summary.data?.students ?? [];
  const eligibleOrderIds = new Set(
    summary.data?.orders
      .filter((order) => order.status !== 'Delivered' && PACE_CATALOGUE.includes(order.paceNumber))
      .map((order) => order.id) ?? [],
  );
  const selectedEligibleOrderIds = selectedOrderIds.filter((id) => eligibleOrderIds.has(id));
  const selectedTransitIds = selectedEligibleOrderIds.filter(
    (id) => summary.data?.orders.find((order) => order.id === id)?.status === 'Ordered',
  );
  const selectedDeliveryIds = selectedEligibleOrderIds.filter(
    (id) => summary.data?.orders.find((order) => order.id === id)?.status === 'InTransit',
  );
  const selectedStudent = findStudent(students, selectedStudentId);
  const selectedAssignment = findAssignment(selectedStudent, selectedSubjectId);
  const gapPrefillMatch =
    gapPrefill?.studentId === selectedStudent?.id &&
    gapPrefill?.subjectId === selectedAssignment?.subjectId
      ? gapPrefill
      : undefined;
  const quickOrderStudent = quickOrderTarget
    ? (students.find((student) => student.id === quickOrderTarget.studentId) ?? null)
    : null;
  const quickOrderAssignment = quickOrderTarget
    ? (quickOrderStudent?.subjects.find(
        (assignment) => assignment.subjectId === quickOrderTarget.subjectId,
      ) ?? null)
    : null;

  useEffect(() => {
    if (!summary.data) return;
    const eligibleIds = new Set(
      summary.data.orders
        .filter(
          (order) => order.status !== 'Delivered' && PACE_CATALOGUE.includes(order.paceNumber),
        )
        .map((order) => order.id),
    );
    setSelectedOrderIds((current) => current.filter((id) => eligibleIds.has(id)));
  }, [summary.data]);

  async function invalidateAcademicInventory() {
    await Promise.all([
      utils.academicInventory.summary.invalidate(),
      utils.academicInventory.ordersForStudent.invalidate(),
      utils.academicInventory.diagnosticsHistory.invalidate(),
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
  });
  const markOrdersInTransit = api.academicInventory.markOrdersInTransit.useMutation({
    onError: (error) => {
      setStatusMessage({
        message: `Orders could not be marked in transit: ${friendlyError(error)}`,
        tone: 'error',
      });
      void summary.refetch();
      void utils.academicInventory.ordersForStudent.invalidate();
    },
    onSuccess: async (result, variables) => {
      setSelectedOrderIds((current) => current.filter((id) => !variables.orderIds.includes(id)));
      setStatusMessage({
        message: `${String(result.count)} orders marked in transit.`,
        tone: 'success',
      });
      await invalidateAcademicInventory();
    },
  });
  const markOrdersDelivered = api.academicInventory.markOrdersDelivered.useMutation({
    onError: (error) => {
      setStatusMessage({
        message: `Orders could not be marked delivered: ${friendlyError(error)}`,
        tone: 'error',
      });
      void summary.refetch();
      void utils.academicInventory.ordersForStudent.invalidate();
    },
    onSuccess: async (result, variables) => {
      setSelectedOrderIds((current) => current.filter((id) => !variables.orderIds.includes(id)));
      setStatusMessage({
        message: `${String(result.count)} orders marked delivered.`,
        tone: 'success',
      });
      await invalidateAcademicInventory();
    },
  });
  const recordDiagnostic = api.academicInventory.recordDiagnostic.useMutation({
    onError: (error) => {
      setStatusMessage({
        message: `Diagnostic could not be recorded: ${friendlyError(error)}`,
        tone: 'error',
      });
    },
    onSuccess: async (result) => {
      setDiagnosticSubmitted(false);
      const summary = result.placement
        ? describePlacement(result.placement)
        : `Level ${String(result.level)} ${(result.outcome ?? '').toLowerCase()}.`;
      setStatusMessage({
        message: `Diagnostic result recorded. ${summary} This reference does not change PACE placement.`,
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

  function submitDiagnostic(submission: DiagnosticSubmission | null) {
    setDiagnosticSubmitted(true);
    setStatusMessage(null);
    if (!selectedStudent || !submission) return;
    recordDiagnostic.mutate({ studentId: selectedStudent.id, ...submission });
  }

  function setUpGapPaces(result: DiagnosticRow) {
    const placement = result.placement;
    if (!result.subjectId || !placement || placement.performanceLevelPace === null) return;
    setSelectedStudentId(result.studentId);
    setSelectedSubjectId(result.subjectId);
    setGapPrefill({
      studentId: result.studentId,
      subjectId: result.subjectId,
      gaps: placement.learningGaps,
      jumpTo: placement.performanceLevelPace,
    });
    setDiagnosticTab('gaps');
  }

  function advanceOrder(order: InventoryOrder) {
    if (
      markOrdersInTransit.isPending ||
      markOrdersDelivered.isPending ||
      updateOrderStatus.isPending
    )
      return;
    const status = nextOrderStatus(order.status);
    if (!status) return;
    setStatusMessage(null);
    updateOrderStatus.mutate({ orderId: order.id, status });
  }

  function markSelectedOrdersInTransit() {
    if (
      selectedTransitIds.length === 0 ||
      markOrdersInTransit.isPending ||
      markOrdersDelivered.isPending ||
      updateOrderStatus.isPending
    )
      return;
    setStatusMessage(null);
    markOrdersInTransit.mutate({ orderIds: selectedTransitIds });
  }

  function markSelectedOrdersDelivered() {
    if (
      selectedDeliveryIds.length === 0 ||
      markOrdersInTransit.isPending ||
      markOrdersDelivered.isPending ||
      updateOrderStatus.isPending
    )
      return;
    setStatusMessage(null);
    markOrdersDelivered.mutate({ orderIds: selectedDeliveryIds });
  }

  const refreshing =
    summary.isFetching ||
    createOrder.isPending ||
    updateOrderStatus.isPending ||
    markOrdersInTransit.isPending ||
    markOrdersDelivered.isPending ||
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
        {canAccess ? (
          <View
            accessibilityLabel="PACE inventory sections"
            accessibilityRole="tablist"
            style={styles.mainTabs}
          >
            {inventoryTabs.map((tab) => (
              <Pressable
                accessibilityRole="tab"
                accessibilityState={{ selected: activeTab === tab.id }}
                key={tab.id}
                onPress={() => {
                  setActiveTab(tab.id);
                  if (tab.id !== 'orders') setSelectedOrderIds([]);
                }}
                style={[styles.mainTab, activeTab === tab.id ? styles.mainTabSelected : null]}
              >
                <Text
                  style={[
                    styles.mainTabText,
                    activeTab === tab.id ? styles.mainTabTextSelected : null,
                  ]}
                >
                  {tab.label}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
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
            {summary.data && activeTab === 'attention' ? (
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

            {summary.data && students.length > 0 && activeTab === 'planner' ? (
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
                <InventorySupplyStatus
                  assignment={selectedAssignment}
                  student={selectedStudent}
                  summary={summary.data}
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
              </>
            ) : null}
            {summary.data && activeTab === 'orders' ? (
              <InventoryOrderList
                orders={summary.data.orders}
                onAdvance={advanceOrder}
                onSelectionChange={setSelectedOrderIds}
                pending={
                  markOrdersInTransit.isPending ||
                  markOrdersDelivered.isPending ||
                  updateOrderStatus.isPending
                }
                selectedOrderIds={selectedEligibleOrderIds}
                students={students}
                summary={summary.data}
              />
            ) : null}
            {summary.data && students.length > 0 && activeTab === 'diagnostics' ? (
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
                <View
                  style={styles.diagnosticTabs}
                  accessibilityRole="tablist"
                  accessibilityLabel="Diagnostic results and gap PACEs"
                >
                  {(['results', 'gaps'] as const).map((tab) => (
                    <Pressable
                      key={tab}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: diagnosticTab === tab }}
                      onPress={() => {
                        setDiagnosticTab(tab);
                      }}
                      style={[
                        styles.diagnosticTab,
                        diagnosticTab === tab ? styles.diagnosticTabSelected : null,
                      ]}
                    >
                      <Text
                        style={[
                          styles.diagnosticTabText,
                          diagnosticTab === tab ? styles.diagnosticTabTextSelected : null,
                        ]}
                      >
                        {tab === 'results' ? 'Results' : 'Gap PACEs'}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <View style={diagnosticTab === 'results' ? undefined : styles.hidden}>
                  <InventoryDiagnosticCard
                    level={diagnosticLevel}
                    onChangeLevel={changeDiagnosticLevel}
                    onChangeOutcome={changeDiagnosticOutcome}
                    onSubmit={submitDiagnostic}
                    outcome={diagnosticOutcome}
                    pending={recordDiagnostic.isPending}
                    student={selectedStudent}
                    submitted={diagnosticSubmitted}
                  />
                  <InventoryDiagnosticHistory
                    enabled={diagnosticTab === 'results'}
                    onSetUpGaps={setUpGapPaces}
                    students={students}
                  />
                </View>
                <View style={diagnosticTab === 'gaps' ? undefined : styles.hidden}>
                  <StaffAcademicGapPlan
                    initialGaps={gapPrefillMatch?.gaps}
                    initialJumpTo={gapPrefillMatch?.jumpTo}
                    studentId={selectedStudent?.id ?? ''}
                    subjectId={selectedAssignment?.subjectId ?? ''}
                  />
                </View>
              </>
            ) : null}
          </ScrollView>
        )}
        {canAccess &&
        activeTab === 'orders' &&
        (selectedEligibleOrderIds.length > 0 || statusMessage?.tone === 'error') ? (
          <View style={styles.bulkFooter}>
            <Text accessibilityLiveRegion="polite" style={styles.bulkCount}>
              {String(selectedEligibleOrderIds.length)} orders selected
            </Text>
            <View style={styles.bulkActions}>
              <MobileButton
                label="Clear"
                onPress={() => {
                  setSelectedOrderIds([]);
                }}
                variant="secondary"
              />
              <MobileButton
                disabled={selectedTransitIds.length === 0 || refreshing}
                label={`Mark ${String(selectedTransitIds.length)} in transit`}
                onPress={markSelectedOrdersInTransit}
                variant="blue"
              />
              <MobileButton
                disabled={selectedDeliveryIds.length === 0 || refreshing}
                label={`Mark ${String(selectedDeliveryIds.length)} delivered`}
                onPress={markSelectedOrdersDelivered}
                variant="navy"
              />
            </View>
            {statusMessage?.tone === 'error' ? (
              <Text accessibilityRole="alert" style={styles.bulkError}>
                {statusMessage.message}
              </Text>
            ) : null}
          </View>
        ) : null}
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
  bulkActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  bulkCount: { color: C.navy, fontSize: 13, fontWeight: '800' },
  bulkError: { color: C.danger, fontSize: 12 },
  bulkFooter: {
    backgroundColor: C.surface,
    borderColor: C.border,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
    padding: 12,
  },
  cardTitle: { color: C.navy, fontSize: 14, fontWeight: '900' },
  content: { flex: 1, gap: 14, padding: 16 },
  mainTab: {
    alignItems: 'center',
    borderColor: C.border,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 44,
    padding: 8,
    width: '48%',
  },
  mainTabSelected: { backgroundColor: C.navy, borderColor: C.navy },
  mainTabText: { color: C.navy, fontSize: 12, fontWeight: '700' },
  mainTabTextSelected: { color: C.surface },
  mainTabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  diagnosticTabs: {
    flexDirection: 'row',
    gap: 4,
    padding: 4,
    borderRadius: 12,
    backgroundColor: C.bg,
  },
  diagnosticTab: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
  },
  diagnosticTabSelected: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  diagnosticTabText: { color: C.textSecondary, fontSize: 15, fontWeight: '600' },
  diagnosticTabTextSelected: { color: C.navy, fontWeight: '800' },
  hidden: { display: 'none' },
  scrollContent: { gap: 14, paddingBottom: 36 },
  shell: { backgroundColor: C.bg, flex: 1 },
});
